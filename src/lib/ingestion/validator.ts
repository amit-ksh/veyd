import { PDFDocument } from "pdf-lib";
import {
  FileTooLargeError,
  UnsupportedFileError,
  PageLimitExceededError,
  InvalidRequestError,
} from "../errors.ts";

export const MAX_FILE_SIZE_BYTES = 10_485_760; // 10 MB
export const MAX_PAGE_COUNT = 100;
export const MIN_PAGE_COUNT = 1;

export interface ValidatedPdf {
  pageCount: number;
  fileSizeBytes: number;
}

/**
 * Validates a binary buffer as an unencrypted PDF with 1–100 pages and <= 10MB size.
 */
export async function validatePdfBuffer(buffer: Buffer): Promise<ValidatedPdf> {
  const fileSizeBytes = buffer.length;

  // 1. Max size enforcement (10 MB)
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(
      `File size (${fileSizeBytes} bytes) exceeds maximum limit of ${MAX_FILE_SIZE_BYTES} bytes (10 MB)`
    );
  }

  if (fileSizeBytes < 5) {
    throw new UnsupportedFileError("File is empty or too small to be a valid PDF");
  }

  // 2. Binary magic bytes signature check: %PDF-
  const magic = buffer.subarray(0, 5).toString("utf8");
  if (magic !== "%PDF-") {
    throw new UnsupportedFileError("File content does not match PDF binary signature (%PDF-)");
  }

  // 3. Load with pdf-lib to verify readability and page count
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  } catch (err) {
    const message = (err as Error).message || "";
    if (message.toLowerCase().includes("encrypt")) {
      throw new InvalidRequestError("Encrypted or password-protected PDFs are not supported");
    }
    throw new InvalidRequestError("Corrupted or unreadable PDF document");
  }

  // 4. Page count enforcement (1–100)
  const pageCount = pdfDoc.getPageCount();
  if (pageCount < MIN_PAGE_COUNT || pageCount > MAX_PAGE_COUNT) {
    throw new PageLimitExceededError(
      `PDF page count (${pageCount}) must be between ${MIN_PAGE_COUNT} and ${MAX_PAGE_COUNT} pages`
    );
  }

  return {
    pageCount,
    fileSizeBytes,
  };
}
