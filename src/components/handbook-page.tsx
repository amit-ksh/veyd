import type {
  HandbookCitation,
  HandbookFigure,
  HandbookPage,
  ProjectHandbookSnapshot,
} from "@/lib/handbook/types";

export function CitationDetail({
  citation,
  projectId,
}: {
  citation: HandbookCitation;
  projectId: string;
}) {
  const url = citation.sourceUrl
    ? `${citation.sourceUrl}#page=${citation.sourcePages[0] || 1}`
    : `/projects/${projectId}/documents`;
  return (
    <div className="book-source-detail">
      <h3>{citation.documentTitle}</h3>
      <p>{citation.citation}</p>
      <p>
        {citation.sourcePages.length
          ? `PDF pages ${citation.sourcePages.join(", ")}`
          : "Page location not recorded"}{" "}
        · Edition not recorded
      </p>
      <p>
        {citation.freshness === "review-required"
          ? "Review required: not an active requirement."
          : "Published, human-reviewed source record."}
      </p>
      {citation.evidenceExcerpt && (
        <blockquote>{citation.evidenceExcerpt}</blockquote>
      )}
      <p>This reference supports the explanation beside its numbered marker.</p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        Open source ↗
      </a>
      <details>
        <summary>Source revision</summary>
        <p>
          Document: {citation.documentRevision || "Not recorded"}
          <br />
          Entry: {citation.ruleRevision || "Not recorded"}
          <br />
          Reviewed: {citation.lastReviewedAt || "Not recorded"}
        </p>
      </details>
    </div>
  );
}

export function BookFigure({ figure }: { figure: HandbookFigure }) {
  return (
    <figure className="book-figure">
      <div
        className="book-flow"
        role="img"
        aria-label={`${figure.title}: ${figure.steps.join(" then ")}`}
      >
        {figure.steps.map((step, index) => (
          <div key={index}>
            <span className="book-flow-number">{index + 1}</span>
            <span>{step}</span>
            {index < figure.steps.length - 1 && (
              <span className="book-flow-arrow" aria-hidden>
                ↓
              </span>
            )}
          </div>
        ))}
      </div>
      <figcaption>Illustrative diagram · {figure.caption}</figcaption>
    </figure>
  );
}

export function BookPageContent({
  page,
  snapshot,
  goTo,
  onCitation,
  onCitationLeave,
  onFigure,
}: {
  page: HandbookPage;
  snapshot: ProjectHandbookSnapshot;
  goTo: (page: number) => void;
  onCitation: (citation: HandbookCitation, button: HTMLButtonElement) => void;
  onCitationLeave: () => void;
  onFigure: (figure: HandbookFigure) => void;
}) {
  const references = (keys: string[]) =>
    keys.map((key) => {
      const index = snapshot.citations.findIndex((c) => c.sourceKey === key);
      if (index < 0) return null;
      const item = snapshot.citations[index];
      return (
        <button
          key={key}
          className="book-reference"
          aria-label={`Reference ${index + 1}: ${item.documentTitle}`}
          aria-haspopup="dialog"
          onClick={(event) => onCitation(item, event.currentTarget)}
          onFocus={(event) => onCitation(item, event.currentTarget)}
          onMouseEnter={(event) => onCitation(item, event.currentTarget)}
          onMouseLeave={onCitationLeave}
          onBlur={onCitationLeave}
        >
          [{index + 1}]
        </button>
      );
    });
  return (
    <>
      <p className="book-eyebrow">{page.chapter}</p>
      <h2>{page.title}</h2>
      {page.kind === "cover" ? (
        <>
          <div className="book-cover-line" />
          <p className="book-cover-purpose">{snapshot.reader?.purpose}</p>
          <p className="book-cover-edition">
            Edition{" "}
            {new Date(snapshot.generatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="book-small">{snapshot.reader?.scope}</p>
          <p className="book-small">
            {snapshot.documentCount} published documents · {snapshot.ruleCount}{" "}
            reviewed entries
          </p>
          <p className="book-small">
            AI-drafted learning reference. Not a new source review.
          </p>
        </>
      ) : (
        <>
          {page.entries && (
            <ol className="book-contents">
              {page.entries.map((entry) => (
                <li key={entry.page}>
                  <button onClick={() => goTo(entry.page)}>
                    <span>{entry.title}</span>
                    <span>{entry.page}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {page.blocks.map((block, index) => (
            <section
              key={index}
              className={`book-block book-block-${block.kind}`}
            >
              <div className="book-block-heading">
                {block.label && <h3>{block.label}</h3>}
                {block.evidence !== "source-backed" && (
                  <span className="book-evidence-label">
                    {block.evidence === "example"
                      ? "Illustrative example"
                      : block.evidence}
                  </span>
                )}
              </div>
              {block.text && <p>{block.text}</p>}
              {block.items.length > 0 && (
                <ul>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              )}
              <span className="book-references">
                {references(block.sourceKeys)}
              </span>
            </section>
          ))}
          {page.figure && (
            <>
              <button
                className="book-figure-enlarge"
                onClick={() => onFigure(page.figure!)}
                aria-label={`Enlarge figure: ${page.figure.title}`}
              >
                <BookFigure figure={page.figure} />
                <span>Enlarge figure ↗</span>
              </button>
              <span className="book-references">
                {references(page.figure.sourceKeys)}
              </span>
            </>
          )}
          {page.kind === "chapter" && (
            <p className="book-chapter-hint">Continue to the next page →</p>
          )}
        </>
      )}
    </>
  );
}
