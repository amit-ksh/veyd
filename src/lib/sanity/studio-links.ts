/** Browser-safe Studio navigation; contains no client or credentials. */
export const RULE_REVIEW_PANE_ID = "rules-awaiting-review";

export function getDocumentReviewUrl(documentId: string, projectId: string): string {
  // Sanity encodes the entire pane segment after encoding its parameter values.
  const pane = [
    RULE_REVIEW_PANE_ID,
    `documentId=${encodeURIComponent(documentId)}`,
    `projectId=${encodeURIComponent(projectId)}`,
  ].join(",");

  return `https://sanity-zeta-six.vercel.app/structure/${encodeURIComponent(pane)}`;
}
