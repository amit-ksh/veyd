import { PDFDocument, StandardFonts, rgb, RGB } from "pdf-lib";
import type { ProjectHandbookSnapshot } from "./types";

interface TextDrawOptions {
  fontSize?: number;
  font?: any;
  color?: RGB;
  lineHeight?: number;
  indent?: number;
}

/**
 * Builds an official, cited, printable PDF handbook from a validated ProjectHandbookSnapshot.
 * Generates cover page, table of contents, chapters, labeled rule blocks, source notes, and subject index.
 */
export async function generateHandbookPdf(snapshot: ProjectHandbookSnapshot): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612; // Letter width (8.5 x 11 in)
  const pageHeight = 792;
  const marginX = 54; // 0.75 in
  const marginTop = 54;
  const marginBottom = 54;
  const contentWidth = pageWidth - marginX * 2;

  let currentPage = doc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - marginTop;

  const colorPrimary = rgb(0.01, 0.04, 0.12); // #020618
  const colorSecondary = rgb(0.2, 0.25, 0.35); // Slate
  const colorMuted = rgb(0.4, 0.45, 0.55);
  const colorAccent = rgb(0, 0.56, 0.59); // Teal #008f96
  const colorAmber = rgb(0.72, 0.45, 0.05); // Amber
  const colorLine = rgb(0.85, 0.88, 0.92);

  const startNewPage = () => {
    currentPage = doc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - marginTop;
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < marginBottom) {
      startNewPage();
    }
  };

  const wrapText = (text: string, maxWidth: number, fontSize: number, font: any): string[] => {
    if (!text) return [];
    const paragraphs = text.split("\n");
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push("");
        continue;
      }
      const words = paragraph.split(/\s+/);
      let currentLine = words[0] || "";

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = `${currentLine} ${word}`;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  };

  const drawParagraph = (text: string, options: TextDrawOptions = {}) => {
    const fontSize = options.fontSize || 10;
    const font = options.font || fontRegular;
    const color = options.color || colorPrimary;
    const lineHeight = options.lineHeight || fontSize * 1.35;
    const indent = options.indent || 0;
    const effectiveWidth = contentWidth - indent;

    const lines = wrapText(text, effectiveWidth, fontSize, font);
    for (const line of lines) {
      ensureSpace(lineHeight);
      if (line.trim()) {
        currentPage.drawText(line, {
          x: marginX + indent,
          y: cursorY - fontSize,
          size: fontSize,
          font,
          color,
        });
      }
      cursorY -= lineHeight;
    }
  };

  // =========================================================================
  // 1. COVER PAGE
  // =========================================================================
  cursorY = pageHeight * 0.65;

  drawParagraph(snapshot.projectName.toUpperCase(), {
    fontSize: 14,
    font: fontBold,
    color: colorAccent,
    lineHeight: 20,
  });

  drawParagraph("Compliance Operating Handbook", {
    fontSize: 26,
    font: fontBold,
    color: colorPrimary,
    lineHeight: 32,
  });

  cursorY -= 8;
  currentPage.drawLine({
    start: { x: marginX, y: cursorY },
    end: { x: marginX + contentWidth, y: cursorY },
    thickness: 1.5,
    color: colorAccent,
  });
  cursorY -= 20;

  drawParagraph(
    "Universal Regulatory Standards, Procedural Obligations & Verified Citations",
    {
      fontSize: 12,
      font: fontRegular,
      color: colorSecondary,
      lineHeight: 18,
    }
  );

  cursorY -= 40;

  drawParagraph(`Project ID: ${snapshot.projectId}`, {
    fontSize: 10,
    font: fontRegular,
    color: colorMuted,
    lineHeight: 14,
  });

  drawParagraph(`Compilation Date: ${new Date(snapshot.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, {
    fontSize: 10,
    font: fontRegular,
    color: colorMuted,
    lineHeight: 14,
  });

  drawParagraph(
    `Scope: ${snapshot.ruleCount} verified rules (${snapshot.currentRuleCount} active obligations, ${snapshot.reviewRequiredRuleCount} review-required) compiled across ${snapshot.documentCount} chapters.`,
    {
      fontSize: 10,
      font: fontRegular,
      color: colorSecondary,
      lineHeight: 15,
    }
  );

  cursorY -= 30;

  drawParagraph(
    "Freshness Notice: This handbook reflects reviewed, human-approved compliance rules active at generation time. Expired, superseded, or tombstoned regulatory sources are excluded from active chapters.",
    {
      fontSize: 9,
      font: fontItalic,
      color: colorMuted,
      lineHeight: 13,
    }
  );

  // =========================================================================
  // 2. TABLE OF CONTENTS
  // =========================================================================
  startNewPage();

  drawParagraph("Table of Contents", {
    fontSize: 18,
    font: fontBold,
    color: colorPrimary,
    lineHeight: 28,
  });

  cursorY -= 10;

  for (const ch of snapshot.chapters) {
    ensureSpace(20);
    drawParagraph(`Chapter ${ch.number} — ${ch.title}`, {
      fontSize: 11,
      font: fontBold,
      color: colorPrimary,
      lineHeight: 16,
    });

    for (const sec of ch.currentRules) {
      ensureSpace(14);
      drawParagraph(`  Section ${sec.number}   ${sec.ruleName}`, {
        fontSize: 9.5,
        font: fontRegular,
        color: colorSecondary,
        lineHeight: 13,
      });
    }

    if (ch.reviewRequiredRules.length > 0) {
      ensureSpace(14);
      drawParagraph(`  [Review Required Sections]`, {
        fontSize: 9,
        font: fontBold,
        color: colorAmber,
        lineHeight: 13,
      });

      for (const sec of ch.reviewRequiredRules) {
        ensureSpace(14);
        drawParagraph(`  Section ${sec.number}   ${sec.ruleName} (Review Required)`, {
          fontSize: 9,
          font: fontRegular,
          color: colorAmber,
          lineHeight: 13,
        });
      }
    }

    cursorY -= 6;
  }

  // TOC entries for Source Notes and Subject Index
  ensureSpace(24);
  cursorY -= 8;
  drawParagraph("Source Notes & Legal Citations", {
    fontSize: 11,
    font: fontBold,
    color: colorPrimary,
    lineHeight: 16,
  });
  drawParagraph("Subject & Citation Index", {
    fontSize: 11,
    font: fontBold,
    color: colorPrimary,
    lineHeight: 16,
  });

  // =========================================================================
  // 3. CHAPTERS & RULE SECTIONS
  // =========================================================================
  for (const ch of snapshot.chapters) {
    startNewPage();

    drawParagraph(`CHAPTER ${ch.number}`, {
      fontSize: 10,
      font: fontBold,
      color: colorAccent,
      lineHeight: 14,
    });

    drawParagraph(ch.title, {
      fontSize: 18,
      font: fontBold,
      color: colorPrimary,
      lineHeight: 24,
    });

    drawParagraph(`Industry Sector: ${ch.industry}`, {
      fontSize: 9.5,
      font: fontItalic,
      color: colorMuted,
      lineHeight: 14,
    });

    cursorY -= 8;
    currentPage.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: marginX + contentWidth, y: cursorY },
      thickness: 0.75,
      color: colorLine,
    });
    cursorY -= 14;

    // Helper to render a section
    const renderSection = (sec: (typeof ch.currentRules)[0], isReviewRequired: boolean) => {
      ensureSpace(40);

      // Section Header
      drawParagraph(`Section ${sec.number}: ${sec.ruleName}`, {
        fontSize: 12,
        font: fontBold,
        color: isReviewRequired ? colorAmber : colorPrimary,
        lineHeight: 16,
      });

      // Status & metadata badge line
      const metaLine = `Jurisdiction: ${sec.jurisdiction}${
        sec.regulator ? `  |  Regulator: ${sec.regulator}` : ""
      }  |  Status: ${isReviewRequired ? "REVIEW REQUIRED" : "Current"}  |  Ref: [${sec.sourceKey}]`;

      drawParagraph(metaLine, {
        fontSize: 8.5,
        font: fontRegular,
        color: isReviewRequired ? colorAmber : colorAccent,
        lineHeight: 12,
      });

      cursorY -= 4;

      // Description Block
      if (sec.description) {
        drawParagraph("Description:", {
          fontSize: 9,
          font: fontBold,
          color: colorSecondary,
          lineHeight: 13,
        });
        drawParagraph(sec.description, {
          fontSize: 9.5,
          font: fontRegular,
          color: colorPrimary,
          lineHeight: 13.5,
          indent: 10,
        });
        cursorY -= 2;
      }

      // Requirement Block
      if (sec.requirement) {
        drawParagraph("Requirement & Operational Directive:", {
          fontSize: 9,
          font: fontBold,
          color: colorSecondary,
          lineHeight: 13,
        });
        drawParagraph(sec.requirement, {
          fontSize: 9.5,
          font: fontRegular,
          color: colorPrimary,
          lineHeight: 13.5,
          indent: 10,
        });
        cursorY -= 2;
      }

      // Applicability Block
      if (sec.applicability) {
        drawParagraph("Scope of Applicability:", {
          fontSize: 9,
          font: fontBold,
          color: colorSecondary,
          lineHeight: 13,
        });
        drawParagraph(sec.applicability, {
          fontSize: 9.5,
          font: fontRegular,
          color: colorPrimary,
          lineHeight: 13.5,
          indent: 10,
        });
      }

      // Keywords line
      if (sec.keywords && sec.keywords.length > 0) {
        drawParagraph(`Keywords: ${sec.keywords.join(", ")}`, {
          fontSize: 8,
          font: fontItalic,
          color: colorMuted,
          lineHeight: 11,
          indent: 10,
        });
      }

      cursorY -= 12;
    };

    // Render Current Rules
    for (const sec of ch.currentRules) {
      renderSection(sec, false);
    }

    // Render Review Required Rules
    if (ch.reviewRequiredRules.length > 0) {
      ensureSpace(35);
      cursorY -= 10;
      drawParagraph("Review Required Sections", {
        fontSize: 13,
        font: fontBold,
        color: colorAmber,
        lineHeight: 18,
      });
      drawParagraph(
        "Notice: The following rules are marked stale, superseded, or past their stated review date. They remain cited for provenance but should not be treated as active obligations without review.",
        {
          fontSize: 8.5,
          font: fontItalic,
          color: colorAmber,
          lineHeight: 12,
        }
      );
      cursorY -= 6;

      for (const sec of ch.reviewRequiredRules) {
        renderSection(sec, true);
      }
    }
  }

  // =========================================================================
  // 4. SOURCE NOTES & CITATIONS
  // =========================================================================
  startNewPage();

  drawParagraph("Source Notes & Legal Citations", {
    fontSize: 18,
    font: fontBold,
    color: colorPrimary,
    lineHeight: 26,
  });

  drawParagraph(
    "Every obligation in this handbook traces to human-reviewed regulatory records. Source keys map directly to internal document and rule entries.",
    {
      fontSize: 9,
      font: fontItalic,
      color: colorMuted,
      lineHeight: 13,
    }
  );

  cursorY -= 8;
  currentPage.drawLine({
    start: { x: marginX, y: cursorY },
    end: { x: marginX + contentWidth, y: cursorY },
    thickness: 0.75,
    color: colorLine,
  });
  cursorY -= 12;

  for (const cite of snapshot.citations) {
    ensureSpace(30);

    drawParagraph(`[${cite.sourceKey}]  ${cite.documentTitle}`, {
      fontSize: 10,
      font: fontBold,
      color: colorPrimary,
      lineHeight: 14,
    });

    const pagesStr =
      cite.sourcePages && cite.sourcePages.length > 0
        ? `Pages: ${cite.sourcePages.join(", ")}`
        : "Unpaginated / Whole Document";

    drawParagraph(`Formal Citation: ${cite.citation}   |   ${pagesStr}`, {
      fontSize: 8.5,
      font: fontRegular,
      color: colorSecondary,
      lineHeight: 12,
      indent: 12,
    });

    drawParagraph(`Source Document ID: ${cite.documentId}   |   Rule ID: ${cite.ruleId}`, {
      fontSize: 8,
      font: fontRegular,
      color: colorMuted,
      lineHeight: 11,
      indent: 12,
    });

    cursorY -= 6;
  }

  // =========================================================================
  // 5. SUBJECT & CITATION INDEX
  // =========================================================================
  startNewPage();

  drawParagraph("Subject & Citation Index", {
    fontSize: 18,
    font: fontBold,
    color: colorPrimary,
    lineHeight: 26,
  });

  drawParagraph(
    "Alphabetical subject directory compiled from rule classification keywords and formal citations.",
    {
      fontSize: 9,
      font: fontItalic,
      color: colorMuted,
      lineHeight: 13,
    }
  );

  cursorY -= 8;
  currentPage.drawLine({
    start: { x: marginX, y: cursorY },
    end: { x: marginX + contentWidth, y: cursorY },
    thickness: 0.75,
    color: colorLine,
  });
  cursorY -= 12;

  for (const entry of snapshot.subjectIndex) {
    ensureSpace(14);
    const targetSections = entry.targets.map((t) => `§${t.sectionNumber}`).join(", ");
    const line = `${entry.term} — ${targetSections}`;

    drawParagraph(line, {
      fontSize: 9,
      font: fontRegular,
      color: colorPrimary,
      lineHeight: 13,
    });
  }

  // =========================================================================
  // 6. TWO-PASS PAGE NUMBERS & RUNNING HEADERS
  // =========================================================================
  const totalPages = doc.getPageCount();

  for (let i = 0; i < totalPages; i++) {
    const page = doc.getPage(i);

    // Skip running header on cover page (page 0)
    if (i > 0) {
      // Header
      const headerText = `${snapshot.projectName} Compliance Handbook`;
      page.drawText(headerText, {
        x: marginX,
        y: pageHeight - 34,
        size: 8,
        font: fontRegular,
        color: colorMuted,
      });

      page.drawLine({
        start: { x: marginX, y: pageHeight - 38 },
        end: { x: pageWidth - marginX, y: pageHeight - 38 },
        thickness: 0.5,
        color: colorLine,
      });
    }

    // Footer on all pages
    const footerText = `Page ${i + 1} of ${totalPages}`;
    const footerWidth = fontRegular.widthOfTextAtSize(footerText, 8.5);

    page.drawText(footerText, {
      x: pageWidth - marginX - footerWidth,
      y: 32,
      size: 8.5,
      font: fontRegular,
      color: colorMuted,
    });

    const confText = "Confidential — Internal Compliance Use Only";
    page.drawText(confText, {
      x: marginX,
      y: 32,
      size: 7.5,
      font: fontItalic,
      color: colorMuted,
    });
  }

  return await doc.save();
}
