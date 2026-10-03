"use client";

import {
  FileText,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { ComplianceDocumentListItem } from "@/lib/sanity/types";
import { CircularLoader } from "@/components/ui/circular-loader";

export function DocumentRow({
  document: item,
  onRemove,
}: {
  document: ComplianceDocumentListItem;
  onRemove: () => void;
}) {
  const isReady = item.processingStatus === "ready";
  const isProcessing = item.processingStatus === "processing";
  const isFailed = item.processingStatus === "failed";

  return (
    <article className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs hover:border-slate-300 hover:shadow-card transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Document Info */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          {/* PDF Icon Badge */}
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100/80 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            <FileText aria-hidden="true" className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="break-words text-sm font-bold text-slate-900 leading-snug">
                {item.title}
              </h3>

              {/* Status Badge */}
              {isReady && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ready
                </span>
              )}
              {isProcessing && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <CircularLoader size="xs" variant="primary" />
                  Processing…
                </span>
              )}
              {isFailed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  Needs attention
                </span>
              )}
            </div>

            {/* Document Attributes */}
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="font-medium text-slate-700">
                {item.pageCount} page{item.pageCount === 1 ? "" : "s"}
              </span>
              <span className="text-slate-300">&bull;</span>
              <span>{((item.fileSizeBytes || 0) / 1024).toFixed(0)} KB</span>
              <span className="text-slate-300">&bull;</span>
              <span className="inline-flex items-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded-md text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">
                  {item.extractedRuleCount || 0}
                </span>{" "}
                extracted
              </span>
              <span className="inline-flex items-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded-md text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">
                  {item.publishedRuleCount || 0}
                </span>{" "}
                published
              </span>
            </div>

            {item.failureMessage && (
              <p
                className="text-xs text-rose-700 bg-rose-50/70 border border-rose-200/60 rounded-lg p-2"
                role="status"
              >
                {item.failureMessage}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-end">
          {item.fileUrl && (
            <a
              href={item.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition shadow-2xs focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
              aria-label={`Open PDF: ${item.title}`}
            >
              <span>Open PDF</span>
              <ExternalLink className="h-3 w-3 text-slate-500" />
            </a>
          )}

          <details className="document-actions relative">
            <summary
              aria-label={`More actions for ${item.title}`}
              className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
            >
              <MoreHorizontal className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 z-30 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
              <a
                href="https://sanity-zeta-six.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                <span>Review in Studio</span>
              </a>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                  onRemove();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 transition"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                <span>Remove from project</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}
