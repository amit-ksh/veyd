"use client";

import { FileText, MoreHorizontal, ExternalLink, Trash2 } from "lucide-react";
import type { ComplianceDocumentListItem } from "@/lib/sanity/types";

export function DocumentRow({
  document: item,
  onRemove,
}: {
  document: ComplianceDocumentListItem;
  onRemove: () => void;
}) {
  return (
    <article className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-5 last:border-b-0 sm:flex sm:gap-4 sm:px-5">
      <FileText
        aria-hidden="true"
        className="mt-1 h-5 w-5 shrink-0 text-slate-400"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="break-words text-sm font-semibold text-slate-950">
          {item.title}
        </h3>
        <p className="break-words text-xs text-slate-500">
          {item.pageCount} pages ·{" "}
          {((item.fileSizeBytes || 0) / 1024).toFixed(0)} KB
        </p>
        <p className="text-xs text-slate-600">
          <span
            className={
              item.processingStatus === "failed"
                ? "text-rose-700"
                : item.processingStatus === "processing"
                  ? "text-amber-700"
                  : "text-emerald-700"
            }
          >
            {item.processingStatus === "ready"
              ? "Ready"
              : item.processingStatus === "processing"
                ? "Processing…"
                : "Needs attention"}
          </span>
          <span className="text-slate-300"> · </span>
          {item.extractedRuleCount || 0} extracted ·{" "}
          {item.publishedRuleCount || 0} published
        </p>
        {item.failureMessage && (
          <p className="text-xs text-rose-700" role="status">
            {item.failureMessage}
          </p>
        )}
      </div>
      <div className="col-start-2 flex shrink-0 items-center gap-1">
        {item.fileUrl && (
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            aria-label={`Open PDF: ${item.title}`}
          >
            Open PDF
          </a>
        )}
        <details className="document-actions relative">
          <summary
            aria-label={`More actions for ${item.title}`}
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            <a
              href="http://localhost:3333"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg p-2.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Review in Studio
            </a>
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                onRemove();
              }}
              className="flex w-full items-center gap-2 rounded-lg p-2.5 text-left text-xs text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove from project
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}
