import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFName,
  PDFString,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { HandbookCitation, ProjectHandbookSnapshot } from "./types";

/** Renders the stored book, preserving its A5 page numbers; never calls AI. */
export async function generateHandbookPdf(
  snapshot: ProjectHandbookSnapshot,
): Promise<Uint8Array> {
  const book = snapshot.reader;
  if (!book) throw new Error("Handbook reader structure is unavailable.");
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf")),
  ]);
  const regular = await document.embedFont(regularBytes);
  const bold = await document.embedFont(boldBytes);
  const supported = new Set(regular.getCharacterSet());
  const assertGlyphs = (text: string) => {
    for (const char of text)
      if (!/\s/.test(char) && !supported.has(char.codePointAt(0)!))
        throw new Error(
          "A character is not supported by the PDF font. Use the offline HTML export for this edition.",
        );
    return text;
  };
  const width = 419.53,
    height = 595.28,
    left = 38,
    contentWidth = width - left * 2;
  const ink = rgb(0.09, 0.14, 0.2),
    accent = rgb(0, 0.45, 0.48),
    muted = rgb(0.39, 0.44, 0.49);
  const bookPages = book.pages.map(() => document.addPage([width, height]));
  const sourcePages = snapshot.citations.map(() =>
    document.addPage([width, height]),
  );
  const wrap = (
    text: string,
    size: number,
    font: PDFFont,
    maxWidth = contentWidth,
  ) => {
    const lines: string[] = [];
    for (const paragraph of assertGlyphs(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (
          line &&
          font.widthOfTextAtSize(line + " " + word, size) > maxWidth
        ) {
          lines.push(line);
          line = "";
        }
        // Long source IDs/URLs are split by character, never clipped.
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > maxWidth) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
        line += " ";
      }
      lines.push(line.trimEnd());
    }
    return lines;
  };
  const link = (
    page: PDFPage,
    y: number,
    destination: PDFPage | string,
    boxWidth = contentWidth,
  ) => {
    const annotation = document.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [left, y - 3, left + boxWidth, y + 15],
      Border: [0, 0, 0],
      ...(typeof destination === "string"
        ? { A: { Type: "Action", S: "URI", URI: PDFString.of(destination) } }
        : { Dest: [destination.ref, PDFName.of("Fit")] }),
    });
    page.node.addAnnot(document.context.register(annotation));
  };
  const refs = (keys: string[]) =>
    keys
      .map(
        (key) =>
          "[" +
          (snapshot.citations.findIndex((c) => c.sourceKey === key) + 1) +
          "]",
      )
      .join(" ");
  for (const [index, stored] of book.pages.entries()) {
    const page = bookPages[index];
    let y = height - 50;
    const paragraph = (
      text: string,
      size = 10.5,
      font = regular,
      color = ink,
      lineHeight = size * 1.5,
    ) => {
      for (const line of wrap(text, size, font)) {
        if (y - lineHeight < 42)
          throw new Error(
            "PDF page is too dense. Download the offline HTML instead.",
          );
        page.drawText(line, { x: left, y: y - size, size, font, color });
        y -= lineHeight;
      }
    };
    const sourceMarkers = (keys: string[]) => {
      const start = y;
      paragraph(refs(keys), 8, bold, accent);
      let refX = left;
      for (const key of keys) {
        const sourceIndex = snapshot.citations.findIndex(
          (citation) => citation.sourceKey === key,
        );
        if (sourceIndex < 0) throw new Error("Unknown PDF source reference.");
        const markerWidth = bold.widthOfTextAtSize(
          "[" + (sourceIndex + 1) + "] ",
          8,
        );
        const annotation = document.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [refX, start - 10, refX + markerWidth, start + 2],
          Border: [0, 0, 0],
          Dest: [sourcePages[sourceIndex].ref, PDFName.of("Fit")],
        });
        page.node.addAnnot(document.context.register(annotation));
        refX += markerWidth;
      }
    };
    paragraph(stored.chapter, 8, bold, accent);
    y -= 16;
    if (stored.kind === "cover") y -= 65;
    if (stored.kind === "chapter") y -= 95;
    paragraph(
      stored.title,
      stored.kind === "cover" || stored.kind === "chapter" ? 26 : 22,
      bold,
      ink,
      32,
    );
    y -= 20;
    if (stored.kind === "cover") {
      page.drawLine({
        start: { x: left, y },
        end: { x: left + 40, y },
        thickness: 2,
        color: accent,
      });
      y -= 22;
      paragraph(book.purpose, 13);
      y -= 26;
      paragraph(
        "Edition " + snapshot.generatedAt.slice(0, 10),
        9,
        regular,
        muted,
      );
      y -= 12;
      paragraph(book.scope, 10);
      y -= 12;
      paragraph(
        snapshot.documentCount +
          " published documents · " +
          snapshot.ruleCount +
          " reviewed entries",
        9,
        regular,
        muted,
      );
      y -= 12;
      paragraph(
        "AI-drafted learning reference. Verify decisions against cited sources.",
        9,
        regular,
        muted,
      );
    }
    if (stored.entries)
      for (const entry of stored.entries) {
        const start = y;
        paragraph(entry.title + "  ·  " + entry.page, 11);
        link(page, start - 11, bookPages[entry.page - 1]);
        y -= 14;
      }
    for (const block of stored.blocks) {
      if (stored.kind === "cover") continue;
      if (block.label) {
        paragraph(block.label, 10, bold);
        y -= 4;
      }
      if (block.evidence !== "source-backed") {
        paragraph(
          block.evidence === "example"
            ? "Illustrative example"
            : block.evidence,
          8,
          regular,
          muted,
        );
        y -= 4;
      }
      if (block.text) paragraph(block.text);
      for (const item of block.items) paragraph("• " + item);
      if (block.sourceKeys.length) {
        y -= 4;
        sourceMarkers(block.sourceKeys);
      }
      y -= 18;
    }
    if (stored.figure) {
      for (const [stepIndex, step] of stored.figure.steps.entries()) {
        const lines = wrap(step, 11, regular, contentWidth - 32);
        const boxHeight = Math.max(40, lines.length * 16 + 18);
        if (y - boxHeight < 72)
          throw new Error("PDF diagram exceeds page bounds.");
        page.drawRectangle({
          x: left,
          y: y - boxHeight,
          width: contentWidth,
          height: boxHeight,
          color: rgb(0.97, 0.98, 0.99),
          borderColor: rgb(0.8, 0.85, 0.87),
          borderWidth: 1,
        });
        for (const [lineIndex, line] of lines.entries())
          page.drawText(
            (lineIndex === 0 ? stepIndex + 1 + ". " : "   ") + line,
            {
              x: left + 12,
              y: y - 19 - lineIndex * 16,
              size: 11,
              font: regular,
              color: ink,
            },
          );
        y -= boxHeight + 18;
      }
      paragraph(
        "Illustrative diagram · " + stored.figure.caption,
        8,
        regular,
        muted,
      );
      sourceMarkers(stored.figure.sourceKeys);
    }
  }
  const renderSource = (
    citation: HandbookCitation,
    page: PDFPage,
    index: number,
  ) => {
    let y = height - 50;
    const text = (value: string, size = 10, font = regular, color = ink) => {
      for (const line of wrap(value, size, font)) {
        if (y < 42) throw new Error("PDF reference exceeds page bounds.");
        page.drawText(line, { x: left, y: y - size, size, font, color });
        y -= size * 1.5;
      }
      y -= 12;
    };
    text("SOURCE [" + (index + 1) + "]", 8, bold, accent);
    text(citation.documentTitle, 18, bold);
    text(citation.citation);
    text(
      "PDF pages: " +
        (citation.sourcePages.join(", ") || "Not recorded") +
        ". Edition: not recorded.",
      9,
    );
    text(
      citation.freshness === "review-required"
        ? "Review required; not an active requirement."
        : "Published, human-reviewed source record.",
      9,
    );
    if (citation.evidenceExcerpt) text(citation.evidenceExcerpt, 9);
    text(
      "Document revision: " + (citation.documentRevision || "Not recorded"),
      8,
      regular,
      muted,
    );
    text(
      "Entry revision: " + (citation.ruleRevision || "Not recorded"),
      8,
      regular,
      muted,
    );
    text(
      "Reviewed: " + (citation.lastReviewedAt || "Not recorded"),
      8,
      regular,
      muted,
    );
    if (citation.sourceUrl) {
      const start = y;
      text("Open source PDF", 9, bold, accent);
      link(
        page,
        start - 9,
        citation.sourceUrl + "#page=" + (citation.sourcePages[0] || 1),
      );
    }
    const mentions = book.pages.flatMap((p, i) =>
      p.blocks.some((b) => b.sourceKeys.includes(citation.sourceKey)) ||
      p.figure?.sourceKeys.includes(citation.sourceKey)
        ? [i + 1]
        : [],
    );
    text("Referenced on handbook pages: " + mentions.join(", "), 9);
  };
  snapshot.citations.forEach((citation, index) =>
    renderSource(citation, sourcePages[index], index),
  );
  document.getPages().forEach((page, index) =>
    page.drawText(String(index + 1), {
      x: width / 2 - 4,
      y: 20,
      size: 8,
      font: regular,
      color: muted,
    }),
  );
  document.setTitle(book.title);
  document.setSubject(book.purpose);
  document.setProducer("Veyd handbook generator " + book.generatorVersion);
  return document.save();
}
