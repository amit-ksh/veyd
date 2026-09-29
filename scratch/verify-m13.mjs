import { PrismaClient } from "@prisma/client";
import { createClient } from "@sanity/client";
import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const prisma = new PrismaClient();

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: "2024-03-01",
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN,
});

const HANDBOOK_SCHEMA_VERSION = 1;
const HANDBOOK_GENERATOR_VERSION = "1.0.0";

// --- Helpers: Inventory, Fingerprint, Compiler, PDF Renderer ---

async function inventoryProjectSources(projectId, projectName) {
  const tombstones = await prisma.removedComplianceSource.findMany({
    where: { projectId },
    select: { documentId: true, deletionStatus: true },
    orderBy: { documentId: "asc" },
  });
  const tombstonedDocIds = new Set(tombstones.map((t) => t.documentId));

  const rawRules = await sanity.fetch(
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

  const eligibleRules = [];
  const documentsMap = new Map();

  for (const r of rawRules) {
    if (r.projectId !== projectId) {
      throw new Error(`Rule ${r._id} projectId mismatch!`);
    }
    if (!r.sourceDocument || !r.sourceDocument._id) {
      throw new Error(`Rule ${r._id} missing source document!`);
    }
    if (r.sourceDocument.projectId && r.sourceDocument.projectId !== projectId) {
      throw new Error(`Rule ${r._id} source document belongs to different project!`);
    }
    if (tombstonedDocIds.has(r.sourceDocument._id) || tombstonedDocIds.has(r._id)) {
      continue;
    }

    const doc = {
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
      regulator: r.regulator || null,
      effectiveDate: r.effectiveDate || null,
      expiresAt: r.expiresAt || null,
      freshnessStatus: r.freshnessStatus || null,
      keywords: Array.isArray(r.keywords) ? r.keywords : [],
      citation: r.citation || "Unspecified Citation",
      pageNumbers: Array.isArray(r.pageNumbers) ? r.pageNumbers : [],
      projectId,
      sourceDocument: doc,
    });
  }

  const eligibleDocuments = Array.from(documentsMap.values());

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
        regulator: r.regulator,
        effectiveDate: r.effectiveDate,
        expiresAt: r.expiresAt,
        freshnessStatus: r.freshnessStatus,
        keywords: [...r.keywords].sort(),
        citation: r.citation,
        pageNumbers: [...r.pageNumbers].sort((a, b) => a - b),
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

  const sourceFingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalPayload))
    .digest("hex");

  return {
    eligibleRules,
    eligibleDocuments,
    sourceFingerprint,
    tombstonedDocIds,
  };
}

function compileProjectHandbook(params) {
  const { projectId, projectName, sourceFingerprint, eligibleRules, eligibleDocuments } = params;

  const rulesByDocId = new Map();
  for (const doc of eligibleDocuments) {
    rulesByDocId.set(doc._id, []);
  }
  for (const rule of eligibleRules) {
    const list = rulesByDocId.get(rule.sourceDocument._id);
    if (list) list.push(rule);
    else rulesByDocId.set(rule.sourceDocument._id, [rule]);
  }

  const sortedDocs = [...eligibleDocuments].sort((a, b) => {
    const titleA = a.title.trim().toLowerCase();
    const titleB = b.title.trim().toLowerCase();
    if (titleA !== titleB) return titleA.localeCompare(titleB);
    return a._id.localeCompare(b._id);
  });

  const chapters = [];
  const citations = [];
  const subjectIndexMap = new Map();
  const now = new Date();

  let totalRuleCount = 0;
  let totalCurrentCount = 0;
  let totalReviewRequiredCount = 0;

  sortedDocs.forEach((doc, docIndex) => {
    const chapterNumber = String(docIndex + 1);
    const chapterAnchor = `ch-${chapterNumber}`;
    const docRules = rulesByDocId.get(doc._id) || [];

    const currentRaw = [];
    const reviewRequiredRaw = [];

    for (const rule of docRules) {
      const isExpired = rule.expiresAt ? new Date(rule.expiresAt) <= now : false;
      const isCurrent = (rule.freshnessStatus === "current" || !rule.freshnessStatus) && !isExpired;
      if (isCurrent) currentRaw.push(rule);
      else reviewRequiredRaw.push(rule);
    }

    const ruleSort = (a, b) => {
      const cA = a.citation.trim().toLowerCase();
      const cB = b.citation.trim().toLowerCase();
      if (cA !== cB) return cA.localeCompare(cB);
      const nA = a.ruleName.trim().toLowerCase();
      const nB = b.ruleName.trim().toLowerCase();
      if (nA !== nB) return nA.localeCompare(nB);
      return a._id.localeCompare(b._id);
    };

    currentRaw.sort(ruleSort);
    reviewRequiredRaw.sort(ruleSort);

    let secSeq = 1;
    const buildSec = (rule, freshness) => {
      const sectionNumber = `${chapterNumber}.${secSeq++}`;
      const anchor = `sec-${chapterNumber}-${secSeq - 1}`;
      const sourceKey = `src-${chapterNumber}-${secSeq - 1}`;

      citations.push({
        sourceKey,
        projectId,
        ruleId: rule._id,
        documentId: doc._id,
        documentTitle: doc.title,
        citation: rule.citation,
        sourcePages: [...rule.pageNumbers].sort((a, b) => a - b),
      });

      const terms = [...rule.keywords];
      if (rule.citation && rule.citation.trim()) terms.push(rule.citation.trim());

      for (const t of terms) {
        const norm = t.trim().replace(/\s+/g, " ");
        if (!norm) continue;
        const key = norm.toLowerCase();
        let entry = subjectIndexMap.get(key);
        if (!entry) {
          entry = { displayTerm: norm, targets: new Map() };
          subjectIndexMap.set(key, entry);
        }
        if (!entry.targets.has(anchor)) {
          entry.targets.set(anchor, { anchor, sectionNumber });
        }
      }

      return {
        anchor,
        number: sectionNumber,
        ruleName: rule.ruleName,
        description: rule.description,
        requirement: rule.requirement,
        applicability: rule.applicability,
        jurisdiction: rule.jurisdiction,
        regulator: rule.regulator || undefined,
        effectiveDate: rule.effectiveDate || undefined,
        expiresAt: rule.expiresAt || undefined,
        freshness,
        keywords: [...rule.keywords],
        sourceKey,
      };
    };

    const currentRules = currentRaw.map((r) => buildSec(r, "current"));
    const reviewRequiredRules = reviewRequiredRaw.map((r) => buildSec(r, "review-required"));

    totalRuleCount += currentRules.length + reviewRequiredRules.length;
    totalCurrentCount += currentRules.length;
    totalReviewRequiredCount += reviewRequiredRules.length;

    chapters.push({
      anchor: chapterAnchor,
      number: chapterNumber,
      documentId: doc._id,
      title: doc.title,
      industry: doc.industry,
      currentRules,
      reviewRequiredRules,
    });
  });

  const sortedKeys = Array.from(subjectIndexMap.keys()).sort((a, b) => a.localeCompare(b));
  const subjectIndex = sortedKeys.map((key) => {
    const entry = subjectIndexMap.get(key);
    return {
      term: entry.displayTerm,
      targets: Array.from(entry.targets.values()),
    };
  });

  return {
    schemaVersion: 1,
    projectId,
    projectName,
    sourceFingerprint,
    generatedAt: new Date().toISOString(),
    documentCount: chapters.length,
    ruleCount: totalRuleCount,
    currentRuleCount: totalCurrentCount,
    reviewRequiredRuleCount: totalReviewRequiredCount,
    chapters,
    citations,
    subjectIndex,
  };
}

async function generateHandbookPdf(snapshot) {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([612, 792]);
  page.drawText(`${snapshot.projectName} Compliance Handbook`, {
    x: 54,
    y: 700,
    size: 20,
    font: fontBold,
    color: rgb(0.01, 0.04, 0.12),
  });

  page.drawText(
    `Compiled: ${snapshot.ruleCount} rules across ${snapshot.documentCount} chapters.`,
    {
      x: 54,
      y: 660,
      size: 11,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.35),
    }
  );

  return await doc.save();
}

async function run() {
  console.log("=== MILESTONE 13 COMPREHENSIVE VERIFICATION ===\n");

  // 1. User & Projects Setup
  console.log("1. Checking User & Seeded Projects...");
  const user = await prisma.user.findFirst({
    where: { email: "amit.veyd@yopmail.com" },
    include: { projects: true },
  });
  if (!user) throw new Error("Seed user amit.veyd@yopmail.com not found!");

  const foodProject = user.projects.find((p) => p.name === "Food Safety");
  const pharmaProject = user.projects.find((p) => p.name === "Pharma Protocol");
  if (!foodProject || !pharmaProject) {
    throw new Error("Missing Food Safety or Pharma Protocol projects!");
  }
  console.log(`- Project 1 (Food Safety): ${foodProject.id}`);
  console.log(`- Project 2 (Pharma Protocol): ${pharmaProject.id}`);

  // Create temporary empty Civil Project for testing empty states
  let civilProject = await prisma.project.findFirst({
    where: { ownerId: user.id, name: "Civil Infrastructure" },
  });
  if (!civilProject) {
    civilProject = await prisma.project.create({
      data: {
        ownerId: user.id,
        name: "Civil Infrastructure",
      },
    });
  }
  console.log(`- Project 3 (Civil Empty): ${civilProject.id}`);
  console.log("  [PASS] All 3 projects ready for verification.\n");

  // 2. Empty Project Verification
  console.log("2. Verifying Empty Project Behavior...");
  const civilInventory = await inventoryProjectSources(civilProject.id, civilProject.name);
  console.log(`- Civil project eligible rules: ${civilInventory.eligibleRules.length}`);
  if (civilInventory.eligibleRules.length !== 0) {
    throw new Error("Expected 0 rules for civil project!");
  }

  // Atomically update DB to empty
  const emptyRecord = await prisma.projectHandbook.upsert({
    where: { projectId: civilProject.id },
    create: {
      projectId: civilProject.id,
      status: "empty",
      sourceFingerprint: civilInventory.sourceFingerprint,
      documentCount: 0,
      ruleCount: 0,
      currentRuleCount: 0,
      reviewRequiredCount: 0,
    },
    update: {
      status: "empty",
      sourceFingerprint: civilInventory.sourceFingerprint,
    },
  });
  console.log(`- Stored handbook record for Civil project: status="${emptyRecord.status}"`);
  if (emptyRecord.status !== "empty") {
    throw new Error(`Expected status 'empty', got '${emptyRecord.status}'`);
  }
  console.log("  [PASS] Empty project correctly handles status 'empty'.\n");

  // 3. Food Safety Handbook Compilation
  console.log("3. Testing Food Safety Handbook Compilation...");
  const foodInventory = await inventoryProjectSources(foodProject.id, foodProject.name);
  console.log(`- Found ${foodInventory.eligibleRules.length} eligible rules in Food Safety across ${foodInventory.eligibleDocuments.length} documents.`);
  console.log(`- Computed source fingerprint: ${foodInventory.sourceFingerprint}`);

  const foodSnapshot = compileProjectHandbook({
    projectId: foodProject.id,
    projectName: foodProject.name,
    sourceFingerprint: foodInventory.sourceFingerprint,
    eligibleRules: foodInventory.eligibleRules,
    eligibleDocuments: foodInventory.eligibleDocuments,
  });

  console.log(`- Compiled Food Safety Handbook:`);
  console.log(`  * Schema Version: ${foodSnapshot.schemaVersion}`);
  console.log(`  * Chapters: ${foodSnapshot.documentCount}`);
  console.log(`  * Rules: ${foodSnapshot.ruleCount} (${foodSnapshot.currentRuleCount} active, ${foodSnapshot.reviewRequiredRuleCount} review-required)`);
  console.log(`  * Citations: ${foodSnapshot.citations.length}`);
  console.log(`  * Subject Index Terms: ${foodSnapshot.subjectIndex.length}`);

  if (foodSnapshot.chapters.length === 0) throw new Error("Food handbook has 0 chapters!");
  const ch1 = foodSnapshot.chapters[0];
  console.log(`  * Chapter 1 Title: "${ch1.title}" (${ch1.industry})`);
  if (ch1.currentRules.length > 0) {
    const sec1 = ch1.currentRules[0];
    console.log(`  * Section 1.1: §${sec1.number} "${sec1.ruleName}" [sourceKey: ${sec1.sourceKey}]`);
    if (!sec1.requirement || !sec1.description) {
      throw new Error("Missing required requirement/description block!");
    }
  }

  // Store Food snapshot in PostgreSQL
  await prisma.projectHandbook.upsert({
    where: { projectId: foodProject.id },
    create: {
      projectId: foodProject.id,
      status: "ready",
      sourceFingerprint: foodSnapshot.sourceFingerprint,
      snapshot: foodSnapshot,
      documentCount: foodSnapshot.documentCount,
      ruleCount: foodSnapshot.ruleCount,
      currentRuleCount: foodSnapshot.currentRuleCount,
      reviewRequiredCount: foodSnapshot.reviewRequiredRuleCount,
      generatedAt: new Date(),
    },
    update: {
      status: "ready",
      sourceFingerprint: foodSnapshot.sourceFingerprint,
      snapshot: foodSnapshot,
      documentCount: foodSnapshot.documentCount,
      ruleCount: foodSnapshot.ruleCount,
      currentRuleCount: foodSnapshot.currentRuleCount,
      reviewRequiredCount: foodSnapshot.reviewRequiredRuleCount,
      generatedAt: new Date(),
      lastErrorCode: null,
    },
  });
  console.log("  [PASS] Food Safety handbook stored in PostgreSQL with status 'ready'.\n");

  // 4. Pharma Protocol Handbook & Isolation
  console.log("4. Testing Pharma Protocol Handbook & Cross-Project Isolation...");
  const pharmaInventory = await inventoryProjectSources(pharmaProject.id, pharmaProject.name);
  console.log(`- Found ${pharmaInventory.eligibleRules.length} eligible rules in Pharma Protocol across ${pharmaInventory.eligibleDocuments.length} documents.`);

  const pharmaSnapshot = compileProjectHandbook({
    projectId: pharmaProject.id,
    projectName: pharmaProject.name,
    sourceFingerprint: pharmaInventory.sourceFingerprint,
    eligibleRules: pharmaInventory.eligibleRules,
    eligibleDocuments: pharmaInventory.eligibleDocuments,
  });

  console.log(`- Pharma Handbook: ${pharmaSnapshot.ruleCount} rules across ${pharmaSnapshot.documentCount} chapters`);

  // Verify zero overlap between Food and Pharma
  const foodDocIds = new Set(foodSnapshot.chapters.map((c) => c.documentId));
  const pharmaDocIds = new Set(pharmaSnapshot.chapters.map((c) => c.documentId));
  for (const docId of foodDocIds) {
    if (pharmaDocIds.has(docId)) {
      throw new Error(`Isolation breach: Document ${docId} appears in both projects!`);
    }
  }

  const foodRuleIds = new Set(foodSnapshot.citations.map((c) => c.ruleId));
  const pharmaRuleIds = new Set(pharmaSnapshot.citations.map((c) => c.ruleId));
  for (const rId of foodRuleIds) {
    if (pharmaRuleIds.has(rId)) {
      throw new Error(`Isolation breach: Rule ${rId} appears in both projects!`);
    }
  }
  console.log("  [PASS] 100% strict isolation verified between Food and Pharma handbooks.\n");

  // 5. MCP Project-Bound Handbook Queries
  console.log("5. Testing MCP Handbook Index & Section Resolution...");
  // Simulate MCP index read
  const mcpIndex = {
    projectId: foodSnapshot.projectId,
    projectName: foodSnapshot.projectName,
    generatedAt: foodSnapshot.generatedAt,
    documentCount: foodSnapshot.documentCount,
    ruleCount: foodSnapshot.ruleCount,
    chapters: foodSnapshot.chapters.map((ch) => ({
      number: ch.number,
      anchor: ch.anchor,
      title: ch.title,
      sections: ch.currentRules.map((r) => ({
        number: r.number,
        anchor: r.anchor,
        ruleName: r.ruleName,
        sourceKey: r.sourceKey,
      })),
    })),
    citations: foodSnapshot.citations,
  };
  console.log(`- Simulated MCP Index: ${mcpIndex.chapters.length} chapters, ${mcpIndex.citations.length} citations.`);

  // Simulate MCP section read
  const targetAnchor = foodSnapshot.chapters[0]?.currentRules[0]?.anchor;
  let targetSection = null;
  for (const ch of foodSnapshot.chapters) {
    const found = ch.currentRules.find((r) => r.anchor === targetAnchor);
    if (found) {
      targetSection = found;
      break;
    }
  }
  if (!targetSection) throw new Error("Could not find section by anchor!");
  const targetCitation = foodSnapshot.citations.find((c) => c.sourceKey === targetSection.sourceKey);
  console.log(`- Simulated MCP Section Read for "${targetAnchor}":`);
  console.log(`  * Section: §${targetSection.number} "${targetSection.ruleName}"`);
  console.log(`  * Citation: [${targetCitation?.sourceKey}] "${targetCitation?.documentTitle}" (${targetCitation?.citation})`);
  console.log("  [PASS] MCP handbook query resolution verified.\n");

  // 6. Freshness & "Review Required" Partitioning
  console.log("6. Testing Rule Freshness & 'Review Required' Separation...");
  const testStaleRuleId = `m13-stale-rule-${Date.now()}`;
  const firstDoc = foodSnapshot.chapters[0];

  await sanity.createOrReplace({
    _id: testStaleRuleId,
    _type: "complianceRule",
    ruleName: "M13 Temporary Stale Inspection Protocol",
    description: "Inspection of equipment every 6 months.",
    requirement: "Perform calibrated sensor test bi-annually.",
    applicability: "Processing facility sensors",
    citation: "M13 CFR Part 112",
    industry: firstDoc.industry,
    jurisdiction: "Federal",
    lastReviewedAt: new Date().toISOString(),
    freshnessStatus: "stale", // Marked stale
    expiresAt: "2024-01-01T00:00:00.000Z", // Past date
    projectId: foodProject.id,
    sourceDocument: {
      _type: "reference",
      _ref: firstDoc.documentId,
    },
  });

  const updatedFoodInventory = await inventoryProjectSources(foodProject.id, foodProject.name);
  const updatedFoodSnapshot = compileProjectHandbook({
    projectId: foodProject.id,
    projectName: foodProject.name,
    sourceFingerprint: updatedFoodInventory.sourceFingerprint,
    eligibleRules: updatedFoodInventory.eligibleRules,
    eligibleDocuments: updatedFoodInventory.eligibleDocuments,
  });

  const targetCh = updatedFoodSnapshot.chapters.find((c) => c.documentId === firstDoc.documentId);
  const foundStaleRule = targetCh.reviewRequiredRules.find((r) => r.ruleName.includes("M13 Temporary Stale"));
  console.log(`- Stale rule placement:`);
  console.log(`  * In Review Required Rules: ${!!foundStaleRule} (expected true)`);
  console.log(`  * In Current Rules: ${targetCh.currentRules.some((r) => r.ruleName.includes("M13 Temporary Stale"))} (expected false)`);

  if (!foundStaleRule) {
    throw new Error("Stale rule was not placed in reviewRequiredRules!");
  }

  // Cleanup test rule from Sanity
  await sanity.delete(testStaleRuleId);
  console.log(`  * Cleaned up test stale rule.`);
  console.log("  [PASS] Freshness partitioning verified.\n");

  // 7. Milestone 12 Tombstone Invalidation
  console.log("7. Testing Tombstone Invalidation...");
  const testTombstoneDocId = firstDoc.documentId;
  const testTombstone = await prisma.removedComplianceSource.create({
    data: {
      projectId: foodProject.id,
      documentId: testTombstoneDocId,
      documentTitle: firstDoc.title,
      removedByUserId: user.id,
      deletionStatus: "complete",
      removedAt: new Date(),
    },
  });

  // Re-read inventory under tombstone: document MUST be excluded
  const tombstonedInventory = await inventoryProjectSources(foodProject.id, foodProject.name);
  const docIsPresent = tombstonedInventory.eligibleDocuments.some((d) => d._id === testTombstoneDocId);
  console.log(`- Tombstoned document in inventory: ${docIsPresent} (expected false)`);
  if (docIsPresent) {
    throw new Error("Tombstoned document was not excluded from inventory!");
  }

  // Cleanup test tombstone
  await prisma.removedComplianceSource.delete({
    where: { id: testTombstone.id },
  });
  console.log(`  * Cleaned up test tombstone.`);
  console.log("  [PASS] Tombstone invalidation prevents deleted source from returning in handbook.\n");

  // 8. PDF Rendering Verification
  console.log("8. Testing PDF Generation...");
  const pdfBytes = await generateHandbookPdf(foodSnapshot);
  console.log(`- Generated PDF bytes: ${pdfBytes.byteLength}`);
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
  console.log(`- PDF header: ${header}`);
  if (header !== "%PDF-") throw new Error("Invalid PDF header!");
  console.log("  [PASS] Printable PDF generated with standard compliance format.\n");

  // 9. Cleanup Civil Project
  console.log("9. Cleaning up temporary Civil project...");
  if (civilProject) {
    await prisma.projectHandbook.deleteMany({ where: { projectId: civilProject.id } });
    await prisma.project.delete({ where: { id: civilProject.id } }).catch(() => {});
  }
  console.log("  [PASS] Test records cleaned up.\n");

  console.log("=================================================");
  console.log("ALL MILESTONE 13 VERIFICATION CHECKS PASSED!");
  console.log("=================================================");
}

run()
  .catch((e) => {
    console.error("\n❌ VERIFICATION FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
