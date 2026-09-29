import crypto from "crypto";
import { publishedClient } from "@/lib/sanity/clients";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const HANDBOOK_SCHEMA_VERSION = 1;
export const HANDBOOK_GENERATOR_VERSION = "1.0.0";

export class RuleSourceMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleSourceMismatchError";
  }
}

export interface RawEligibleDocument {
  _id: string;
  _rev: string;
  title: string;
  industry: string;
  projectId: string;
}

export interface RawEligibleRule {
  _id: string;
  _rev: string;
  ruleName: string;
  description: string;
  requirement: string;
  applicability: string;
  jurisdiction: string;
  regulator?: string | null;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  freshnessStatus?: "current" | "stale" | "superseded" | null;
  keywords?: string[] | null;
  citation: string;
  pageNumbers?: number[] | null;
  projectId: string;
  sourceDocument: RawEligibleDocument;
}

export interface SourceInventoryResult {
  eligibleRules: RawEligibleRule[];
  eligibleDocuments: RawEligibleDocument[];
  sourceFingerprint: string;
  tombstonedDocIds: Set<string>;
}

/**
 * Inventories eligible published rules and source documents for a project,
 * verifies strict project boundary invariants, and computes the deterministic source fingerprint.
 */
export async function inventoryProjectSources(params: {
  projectId: string;
  projectName: string;
  correlationId?: string;
}): Promise<SourceInventoryResult> {
  const { projectId, projectName, correlationId } = params;

  // 1. Fetch all project tombstones from PostgreSQL
  const tombstones = await prisma.removedComplianceSource.findMany({
    where: { projectId },
    select: { documentId: true, deletionStatus: true },
    orderBy: { documentId: "asc" },
  });

  const tombstonedDocIds = new Set(tombstones.map((t) => t.documentId));

  // 2. Fetch published rules for this project with dereferenced sourceDocument (uncached)
  const rawRules = await publishedClient.fetch<
    Array<{
      _id: string;
      _rev: string;
      ruleName: string;
      description?: string | null;
      requirement?: string | null;
      applicability?: string | null;
      jurisdiction?: string | null;
      regulator?: string | null;
      effectiveDate?: string | null;
      expiresAt?: string | null;
      freshnessStatus?: "current" | "stale" | "superseded" | null;
      keywords?: string[] | null;
      citation?: string | null;
      pageNumbers?: number[] | null;
      projectId?: string | null;
      sourceDocument?: {
        _id: string;
        _rev: string;
        title?: string | null;
        industry?: string | null;
        projectId?: string | null;
      } | null;
    }>
  >(
    `*[_type == "complianceRule" && !(_id in path("drafts.**")) && defined(lastReviewedAt) && projectId == $projectId]{
      _id,
      _rev,
      ruleName,
      description,
      requirement,
      applicability,
      jurisdiction,
      regulator,
      effectiveDate,
      expiresAt,
      freshnessStatus,
      keywords,
      citation,
      pageNumbers,
      projectId,
      sourceDocument->{
        _id,
        _rev,
        title,
        industry,
        projectId
      }
    }`,
    { projectId }
  );

  const eligibleRules: RawEligibleRule[] = [];
  const documentsMap = new Map<string, RawEligibleDocument>();

  for (const r of rawRules) {
    // Invariant 1: rule.projectId matches project
    if (r.projectId !== projectId) {
      logger.error("handbook_source_rule_project_mismatch", {
        correlationId,
        projectId,
        ruleId: r._id,
        ruleProjectId: r.projectId,
      });
      throw new RuleSourceMismatchError(
        `Invalid source data: Rule ${r._id} has projectId "${r.projectId}" which does not match authorized project "${projectId}".`
      );
    }

    // Invariant 2: source document exists and is not missing
    if (!r.sourceDocument || !r.sourceDocument._id) {
      logger.error("handbook_source_document_missing", {
        correlationId,
        projectId,
        ruleId: r._id,
      });
      throw new RuleSourceMismatchError(
        `Invalid source data: Published rule ${r._id} references a missing or unresolvable source document.`
      );
    }

    // Invariant 3: source document project matches
    if (r.sourceDocument.projectId && r.sourceDocument.projectId !== projectId) {
      logger.error("handbook_source_document_project_mismatch", {
        correlationId,
        projectId,
        ruleId: r._id,
        documentId: r.sourceDocument._id,
        documentProjectId: r.sourceDocument.projectId,
      });
      throw new RuleSourceMismatchError(
        `Invalid source data: Rule ${r._id} references document ${r.sourceDocument._id} belonging to project "${r.sourceDocument.projectId}" instead of "${projectId}".`
      );
    }

    // Invariant 4: exclude tombstoned documents and their rules
    if (tombstonedDocIds.has(r.sourceDocument._id) || tombstonedDocIds.has(r._id)) {
      continue;
    }

    const doc: RawEligibleDocument = {
      _id: r.sourceDocument._id,
      _rev: r.sourceDocument._rev || "",
      title: r.sourceDocument.title || "Untitled Document",
      industry: r.sourceDocument.industry || "General Compliance",
      projectId,
    };
    documentsMap.set(doc._id, doc);

    eligibleRules.push({
      _id: r._id,
      _rev: r._rev || "",
      ruleName: r.ruleName || "Untitled Rule",
      description: r.description || "",
      requirement: r.requirement || "",
      applicability: r.applicability || "",
      jurisdiction: r.jurisdiction || "Federal",
      regulator: r.regulator,
      effectiveDate: r.effectiveDate,
      expiresAt: r.expiresAt,
      freshnessStatus: r.freshnessStatus,
      keywords: Array.isArray(r.keywords) ? r.keywords : [],
      citation: r.citation || "Unspecified Citation",
      pageNumbers: Array.isArray(r.pageNumbers) ? r.pageNumbers : [],
      projectId,
      sourceDocument: doc,
    });
  }

  const eligibleDocuments = Array.from(documentsMap.values());

  // 3. Compute deterministic SHA-256 fingerprint
  const canonicalPayload = {
    schemaVersion: HANDBOOK_SCHEMA_VERSION,
    generatorVersion: HANDBOOK_GENERATOR_VERSION,
    projectId,
    projectName,
    rules: eligibleRules
      .map((r) => ({
        _id: r._id,
        _rev: r._rev,
        ruleName: r.ruleName,
        description: r.description,
        requirement: r.requirement,
        applicability: r.applicability,
        jurisdiction: r.jurisdiction,
        regulator: r.regulator || null,
        effectiveDate: r.effectiveDate || null,
        expiresAt: r.expiresAt || null,
        freshnessStatus: r.freshnessStatus || null,
        keywords: Array.isArray(r.keywords) ? [...r.keywords].sort() : [],
        citation: r.citation,
        pageNumbers: Array.isArray(r.pageNumbers) ? [...r.pageNumbers].sort((a, b) => a - b) : [],
        docId: r.sourceDocument._id,
        docRev: r.sourceDocument._rev,
      }))
      .sort((a, b) => a._id.localeCompare(b._id)),
    documents: eligibleDocuments
      .map((d) => ({
        _id: d._id,
        _rev: d._rev,
        title: d.title,
        industry: d.industry,
      }))
      .sort((a, b) => a._id.localeCompare(b._id)),
    tombstones: tombstones
      .map((t) => ({
        documentId: t.documentId,
        deletionStatus: t.deletionStatus,
      }))
      .sort((a, b) => a.documentId.localeCompare(b.documentId)),
  };

  const serialized = JSON.stringify(canonicalPayload);
  const sourceFingerprint = crypto.createHash("sha256").update(serialized).digest("hex");

  return {
    eligibleRules,
    eligibleDocuments,
    sourceFingerprint,
    tombstonedDocIds,
  };
}
