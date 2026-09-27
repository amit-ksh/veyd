/**
 * Document review and rule status helpers for Milestone 4.
 * Enforces clear separation between extracted drafts awaiting review and published verified rules.
 */

export interface DocumentRuleStatusDisplay {
  label: string;
  subtext: string;
  variant: "failed" | "empty" | "drafts" | "published" | "mixed";
}

export function formatDocumentRuleStatus(doc: {
  processingStatus: string;
  extractedRuleCount: number;
  publishedRuleCount?: number;
}): DocumentRuleStatusDisplay {
  if (doc.processingStatus === "failed") {
    return {
      label: "Processing failed",
      subtext: "Rule extraction failed during processing",
      variant: "failed",
    };
  }

  if (doc.processingStatus === "processing") {
    return {
      label: "Processing PDF",
      subtext: "Extracting compliance obligations...",
      variant: "empty",
    };
  }

  if (doc.extractedRuleCount === 0) {
    return {
      label: "No rules extracted",
      subtext: "No normative requirements found in document",
      variant: "empty",
    };
  }

  const published = doc.publishedRuleCount ?? 0;
  const awaitingReview = Math.max(0, doc.extractedRuleCount - published);

  if (published === 0 && awaitingReview > 0) {
    return {
      label: `${awaitingReview} draft${awaitingReview === 1 ? "" : "s"} awaiting review`,
      subtext: "Extracted rules are pending human review in Sanity Studio",
      variant: "drafts",
    };
  }

  if (published > 0 && awaitingReview === 0) {
    return {
      label: `${published} published rule${published === 1 ? "" : "s"}`,
      subtext: "All extracted rules verified and published",
      variant: "published",
    };
  }

  return {
    label: `${published} published · ${awaitingReview} awaiting review`,
    subtext: `${published} active in search, ${awaitingReview} pending editorial review`,
    variant: "mixed",
  };
}
