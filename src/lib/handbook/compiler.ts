import type {
  HandbookChapter,
  HandbookCitation,
  HandbookRuleSection,
  ProjectHandbookSnapshot,
  SubjectIndexEntry,
} from "./types";
import type { RawEligibleDocument, RawEligibleRule } from "./fingerprint";

/**
 * Deterministically compiles eligible rules and documents into a structured ProjectHandbookSnapshot.
 */
export function compileProjectHandbook(params: {
  projectId: string;
  projectName: string;
  sourceFingerprint: string;
  eligibleRules: RawEligibleRule[];
  eligibleDocuments: RawEligibleDocument[];
  generatedAt?: string;
}): ProjectHandbookSnapshot {
  const {
    projectId,
    projectName,
    sourceFingerprint,
    eligibleRules,
    eligibleDocuments,
    generatedAt = new Date().toISOString(),
  } = params;

  // 1. Group rules by source document
  const rulesByDocId = new Map<string, RawEligibleRule[]>();
  for (const doc of eligibleDocuments) {
    rulesByDocId.set(doc._id, []);
  }

  for (const rule of eligibleRules) {
    const list = rulesByDocId.get(rule.sourceDocument._id);
    if (list) {
      list.push(rule);
    } else {
      rulesByDocId.set(rule.sourceDocument._id, [rule]);
    }
  }

  // 2. Order chapters by normalized document title ascending, then document ID ascending
  const sortedDocs = [...eligibleDocuments].sort((a, b) => {
    const titleA = a.title.trim().toLowerCase();
    const titleB = b.title.trim().toLowerCase();
    if (titleA !== titleB) {
      return titleA.localeCompare(titleB);
    }
    return a._id.localeCompare(b._id);
  });

  const chapters: HandbookChapter[] = [];
  const citations: HandbookCitation[] = [];
  const subjectIndexMap = new Map<
    string,
    {
      displayTerm: string;
      targets: Map<string, { anchor: string; sectionNumber: string }>;
    }
  >();

  let totalRuleCount = 0;
  let totalCurrentCount = 0;
  let totalReviewRequiredCount = 0;

  const now = new Date();

  // 3. Compile each chapter and its rules
  sortedDocs.forEach((doc, docIndex) => {
    const chapterNumber = String(docIndex + 1);
    const chapterAnchor = `ch-${doc._id}`;
    const docRules = rulesByDocId.get(doc._id) || [];

    // Separate current vs review-required rules
    const currentRaw: RawEligibleRule[] = [];
    const reviewRequiredRaw: RawEligibleRule[] = [];

    for (const rule of docRules) {
      const isExpired = rule.expiresAt
        ? new Date(rule.expiresAt) <= now
        : false;
      const isCurrentStatus =
        rule.freshnessStatus === "current" || !rule.freshnessStatus;

      if (isCurrentStatus && !isExpired) {
        currentRaw.push(rule);
      } else {
        reviewRequiredRaw.push(rule);
      }
    }

    // Stable rule sorting: citation asc, then ruleName asc, then _id asc
    const ruleComparator = (a: RawEligibleRule, b: RawEligibleRule) => {
      const citeA = a.citation.trim().toLowerCase();
      const citeB = b.citation.trim().toLowerCase();
      if (citeA !== citeB) return citeA.localeCompare(citeB);

      const nameA = a.ruleName.trim().toLowerCase();
      const nameB = b.ruleName.trim().toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);

      return a._id.localeCompare(b._id);
    };

    currentRaw.sort(ruleComparator);
    reviewRequiredRaw.sort(ruleComparator);

    let sectionSeq = 1;

    const buildSection = (
      rule: RawEligibleRule,
      freshness: "current" | "review-required",
    ): HandbookRuleSection => {
      const sectionNumber = `${chapterNumber}.${sectionSeq++}`;
      const anchor = `sec-${rule._id}`;
      const sourceKey = `src-${rule._id}`;

      // Register Citation
      citations.push({
        sourceKey,
        projectId,
        ruleId: rule._id,
        documentId: doc._id,
        documentTitle: doc.title,
        citation: rule.citation,
        sourcePages: rule.sourcePages
          ? [...rule.sourcePages].sort((a, b) => a - b)
          : [],
        // GROQ returns null for a missing asset. Absence is valid; a fake URL is not.
        sourceUrl: doc.fileUrl ?? undefined,
        evidenceExcerpt: rule.evidenceExcerpt || undefined,
        documentRevision: doc._rev,
        ruleRevision: rule._rev,
        lastReviewedAt: rule.lastReviewedAt || undefined,
        freshness,
      });

      // Extract subject index terms (keywords and formal citation)
      const indexTerms = Array.isArray(rule.keywords) ? [...rule.keywords] : [];
      if (rule.citation && rule.citation.trim()) {
        indexTerms.push(rule.citation.trim());
      }

      for (const term of indexTerms) {
        const normalized = term.trim().replace(/\s+/g, " ");
        if (!normalized) continue;
        const lookupKey = normalized.toLowerCase();

        let entry = subjectIndexMap.get(lookupKey);
        if (!entry) {
          entry = {
            displayTerm: normalized,
            targets: new Map(),
          };
          subjectIndexMap.set(lookupKey, entry);
        }

        if (!entry.targets.has(anchor)) {
          entry.targets.set(anchor, {
            anchor,
            sectionNumber,
          });
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
        keywords: Array.isArray(rule.keywords) ? [...rule.keywords] : [],
        sourceKey,
      };
    };

    const currentRules = currentRaw.map((r) => buildSection(r, "current"));
    const reviewRequiredRules = reviewRequiredRaw.map((r) =>
      buildSection(r, "review-required"),
    );

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

  // 4. Sort and compile Subject Index entries
  const sortedKeys = Array.from(subjectIndexMap.keys()).sort((a, b) =>
    a.localeCompare(b),
  );
  const subjectIndex: SubjectIndexEntry[] = sortedKeys.map((key) => {
    const entry = subjectIndexMap.get(key)!;
    const sortedTargets = Array.from(entry.targets.values()).sort((a, b) => {
      // Sort targets by section number (e.g., "1.2" vs "1.10")
      const partsA = a.sectionNumber.split(".").map(Number);
      const partsB = b.sectionNumber.split(".").map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] ?? 0;
        const numB = partsB[i] ?? 0;
        if (numA !== numB) return numA - numB;
      }
      return a.anchor.localeCompare(b.anchor);
    });

    return {
      term: entry.displayTerm,
      targets: sortedTargets,
    };
  });

  return {
    schemaVersion: 2,
    projectId,
    projectName,
    sourceFingerprint,
    generatedAt,
    documentCount: chapters.length,
    ruleCount: totalRuleCount,
    currentRuleCount: totalCurrentCount,
    reviewRequiredRuleCount: totalReviewRequiredCount,
    chapters,
    citations,
    subjectIndex,
  };
}
