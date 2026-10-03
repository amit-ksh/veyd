import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  HandbookCitation,
  HandbookFigure,
  ProjectHandbookSnapshot,
} from "./types";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const figureMarkup = (figure: HandbookFigure) =>
  `<figure class="book-figure"><div class="book-flow" role="img" aria-label="${escape(figure.steps.join(" then "))}">${figure.steps.map((step, index) => `<div><span class="book-flow-number">${index + 1}</span><span>${escape(step)}</span>${index < figure.steps.length - 1 ? '<span class="book-flow-arrow" aria-hidden="true">↓</span>' : ""}</div>`).join("")}</div><figcaption>Illustrative diagram · ${escape(figure.caption)}</figcaption></figure>`;
const sourceMarkup = (source: HandbookCitation) =>
  `<div class="book-source-detail"><h3>${escape(source.documentTitle)}</h3><p>${escape(source.citation)}</p><p>PDF pages ${source.sourcePages.join(", ") || "not recorded"} · Edition not recorded</p><p>${source.freshness === "review-required" ? "Review required: not an active requirement." : "Published, human-reviewed source record."}</p>${source.evidenceExcerpt ? `<blockquote>${escape(source.evidenceExcerpt)}</blockquote>` : ""}<p>This reference supports the explanation beside its numbered marker.</p>${source.sourceUrl ? `<a target="_blank" rel="noopener noreferrer" href="${escape(source.sourceUrl)}#page=${source.sourcePages[0] || 1}">Open source ↗</a>` : "<p>Source URL not recorded.</p>"}<details><summary>Source revision</summary><p>Document: ${escape(source.documentRevision || "Not recorded")}<br>Entry: ${escape(source.ruleRevision || "Not recorded")}<br>Reviewed: ${escape(source.lastReviewedAt || "Not recorded")}</p></details></div>`;

/** Portable export: all reading content, diagrams, CSS and controls are inline; source links remain external. */
export async function generateHandbookHtml(
  snapshot: ProjectHandbookSnapshot,
): Promise<string> {
  const book = snapshot.reader;
  if (!book) throw new Error("Handbook reader structure is unavailable.");
  const [css, script] = await Promise.all([
    readFile(path.join(process.cwd(), "src/lib/handbook/reader.css"), "utf8"),
    readFile(
      path.join(process.cwd(), "src/lib/handbook/offline-reader.js"),
      "utf8",
    ),
  ]);
  const references = (keys: string[]) =>
    keys
      .map((key) => {
        const index = snapshot.citations.findIndex((c) => c.sourceKey === key);
        return `<button class="book-reference" data-reference="${index}" aria-haspopup="dialog" aria-label="Reference ${index + 1}">[${index + 1}]</button>`;
      })
      .join("");
  const pages = book.pages
    .map(
      (page, index) =>
        `<article class="book-paper book-${page.kind}" data-page="${index}" ${index ? "hidden" : ""} aria-label="Page ${index + 1}: ${escape(page.title)}"><div class="book-page-scroll" tabindex="0"><p class="book-eyebrow">${escape(page.chapter)}</p><h2>${escape(page.title)}</h2>${page.kind === "cover" ? `<div class="book-cover-line"></div><p class="book-cover-purpose">${escape(book.purpose)}</p><p class="book-cover-edition">Edition ${escape(snapshot.generatedAt.slice(0, 10))}</p><p class="book-small">${escape(book.scope)}</p><p class="book-small">${snapshot.documentCount} published documents · ${snapshot.ruleCount} reviewed entries</p><p class="book-small">AI-drafted learning reference. Verify important decisions against the sources.</p>` : `${page.entries ? `<ol class="book-contents">${page.entries.map((entry) => `<li><button data-goto="${entry.page - 1}"><span>${escape(entry.title)}</span><span>${entry.page}</span></button></li>`).join("")}</ol>` : ""}${page.blocks.map((block) => `<section class="book-block book-block-${block.kind}"><div class="book-block-heading">${block.label ? `<h3>${escape(block.label)}</h3>` : ""}${block.evidence !== "source-backed" ? `<span class="book-evidence-label">${block.evidence === "example" ? "Illustrative example" : escape(block.evidence)}</span>` : ""}</div>${block.text ? `<p>${escape(block.text)}</p>` : ""}${block.items.length ? `<ul>${block.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}<span class="book-references">${references(block.sourceKeys)}</span></section>`).join("")}${page.figure ? `<button class="book-figure-enlarge" data-figure="${index}" aria-label="Enlarge figure">${figureMarkup(page.figure)}<span>Enlarge figure ↗</span></button><span class="book-references">${references(page.figure.sourceKeys)}</span>` : ""}${page.kind === "chapter" ? '<p class="book-chapter-hint">Continue to the next page →</p>' : ""}`}</div><div class="book-page-number">${index + 1}</div></article>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(book.title)}</title><style>${css}\n*{box-sizing:border-box}body{margin:0;padding:24px;background:#f7f9fa}button,input,select{font:inherit}[hidden]{display:none!important}@media print{[data-page]{display:block!important}body{padding:0}}</style></head><body><main class="book-reader" data-storage="${escape(snapshot.projectId)}:${escape(snapshot.sourceFingerprint)}"><header class="book-toolbar"><div><h1>${escape(book.title)}</h1><p>Portable offline handbook · Edition ${escape(snapshot.generatedAt.slice(0, 10))}</p></div><div class="book-actions"><button class="book-button" data-goto="1">Contents</button><button class="book-button" id="open-references">References</button><button class="book-button" id="print">Print / Save PDF</button></div></header><div class="book-desk">${pages}</div><nav class="book-navigation" aria-label="Book pages"><button class="book-button" id="previous">← Previous</button><label class="book-page-select">Page <select id="page-selector" aria-label="Select page">${book.pages.map((page, index) => `<option value="${index}">${index + 1} — ${escape(page.title)}</option>`).join("")}</select>of ${book.pages.length}</label><button class="book-button" id="next">Next →</button></nav><p class="book-edition">AI-drafted from published, reviewed extracts. External source links require internet access.</p><aside id="reference-popup" class="book-citation-popup" role="dialog" aria-label="Citation details" hidden><button class="book-close" id="close-popup" aria-label="Close citation">×</button><div id="popup-content"></div></aside><aside id="explorer" class="book-explorer" aria-label="Reference explorer" hidden><header><h2>Reference explorer</h2><button class="book-button" id="close-explorer">Close</button></header><label>Search sources<input id="reference-search" placeholder="Title, location or evidence"></label><p class="book-eyebrow" id="reference-count"></p><div id="reference-item"></div><div class="book-actions"><button class="book-button" id="reference-previous">Previous</button><button class="book-button" id="reference-next">Next</button></div><details><summary>Edition and evidence limits</summary><p>Model: ${escape(book.model)}. Generator: ${escape(book.generatorVersion)}.</p><p>Source fingerprint: ${escape(snapshot.sourceFingerprint)}</p>${book.limitations.map((text) => `<p>${escape(text)}</p>`).join("")}</details></aside><div id="sources" hidden>${snapshot.citations.map((c) => `<div>${sourceMarkup(c)}</div>`).join("")}</div><dialog id="figure-dialog" class="book-figure-dialog"><button class="book-button" id="close-figure">Close</button><div id="figure-content"></div></dialog></main><script>${script}</script></body></html>`;
}
