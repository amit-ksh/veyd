"use client";

import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import type { ChatFile } from "@/lib/chat-files/types";

export function ChatFileCards({
  files,
  projectId,
  disabled,
  onIngest,
}: {
  files: ChatFile[];
  projectId: string;
  disabled?: boolean;
  onIngest: (file: ChatFile) => void;
}) {
  return (
    <div className="space-y-2" aria-label="Chat files">
      {files.map((file) => {
        const canImport =
          file.origin !== "upload" &&
          (file.status === "available" ||
            (file.status === "failed" && file.retryable));
        const label =
          file.status === "ready"
            ? "Added to Documents · review required"
            : file.status === "removed"
              ? "Source removed"
              : file.status === "processing"
                ? "Import started · check Documents"
                : file.status === "failed"
                  ? "Could not add document"
                  : "PDF link · not yet validated";
        return (
          <article
            key={file.id}
            className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
          >
            <div className="flex items-start gap-3">
              <FileText
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-600"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="break-words font-semibold text-slate-900">
                  {file.title}
                </h3>
                <p className="text-xs text-slate-600">
                  {file.origin === "upload"
                    ? file.fileName || "Uploaded PDF"
                    : file.origin === "official-web"
                      ? "Official web source"
                      : "Secondary web source · verify against the original"}
                  {file.byteSize !== undefined
                    ? " · " + (file.byteSize / 1024).toFixed(1) + " KB"
                    : ""}
                </p>
                <p className="text-xs text-slate-600">
                  {label}
                  {file.pageCount ? " · " + file.pageCount + " pages" : ""}
                </p>
                {file.error && (
                  <p role="status" className="text-xs text-rose-700">
                    {file.error}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 pl-7">
              {file.url && file.status !== "removed" && (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-700 underline underline-offset-4"
                >
                  PDF link <ExternalLink aria-hidden className="h-3 w-3" />
                </a>
              )}
              {file.sourcePageUrl &&
                file.sourcePageUrl !== file.url &&
                file.status !== "removed" && (
                  <a
                    href={file.sourcePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-700 underline underline-offset-4"
                  >
                    Discovery source
                  </a>
                )}
              {canImport && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onIngest(file)}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add to project knowledge
                </button>
              )}
              {file.status !== "removed" &&
                (file.documentId ||
                  file.status === "processing" ||
                  (file.status === "failed" && !file.retryable)) && (
                  <Link
                    href={"/projects/" + projectId + "/documents"}
                    className="text-xs font-semibold text-slate-800 underline underline-offset-4"
                  >
                    Open in Documents
                  </Link>
                )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
