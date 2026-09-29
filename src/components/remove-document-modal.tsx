"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, Trash2, Loader2, X, AlertCircle } from "lucide-react";
import type { ComplianceDocumentListItem } from "@/lib/sanity/types";

interface RemoveDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentItem: ComplianceDocumentListItem | null;
  projectId: string;
  onDocumentRemoved: (documentId: string, documentTitle: string) => void;
}

export function RemoveDocumentModal({
  isOpen,
  onClose,
  documentItem,
  projectId,
  onDocumentRemoved,
}: RemoveDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(false);
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen || !documentItem) return null;

  const handleConfirmRemove = async () => {
    if (!projectId || !documentItem._id) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/documents/${encodeURIComponent(documentItem._id)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmDocumentId: documentItem._id,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(
            data.message ||
              "Document removal is already in progress. Please wait a moment and refresh."
          );
        }
        throw new Error(
          data.message ||
            data.error ||
            `Failed to remove document (${res.status})`
        );
      }

      onDocumentRemoved(documentItem._id, documentItem.title);
      onClose();
    } catch (err: any) {
      console.error("Remove document error:", err);
      setError(
        err.message || "Failed to remove compliance document. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const ruleCount = documentItem.extractedRuleCount ?? 0;
  const publishedCount = documentItem.publishedRuleCount ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="remove-doc-title"
      aria-describedby="remove-doc-desc"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="remove-doc-title"
                className="text-base font-bold text-[#020618]"
              >
                Remove from Project
              </h2>
              <p className="text-xs text-slate-500">
                Active context and rule removal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
          <p id="remove-doc-desc" className="text-slate-800 text-sm">
            Are you sure you want to remove{" "}
            <strong className="text-[#020618] font-bold">
              &quot;{documentItem.title}&quot;
            </strong>{" "}
            from this project?
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
              <span>What happens when you remove this document:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>
                <strong>Active Retrieval:</strong> The document and its{" "}
                <strong className="text-slate-900">
                  {ruleCount} rule{ruleCount === 1 ? "" : "s"}
                </strong>{" "}
                ({publishedCount} published) will be immediately excluded from
                research chat, search, and MCP tools.
              </li>
              <li>
                <strong>Historical Conversations:</strong> Past chat messages
                that cited this document will remain intact, with the citation
                marked as{" "}
                <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                  Source removed
                </span>{" "}
                and internal document links disabled.
              </li>
              <li>
                <strong>Asset Cleanup:</strong> The durable PDF file asset will
                be permanently deleted unless shared by another document in
                the repository.
              </li>
            </ul>
          </div>

          <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2.5">
            <strong>Warning:</strong> This action cannot be undone. You will need
            to re-upload and re-extract the document to use its rules in active
            retrieval again.
          </p>

          {error && (
            <div
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-300 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmRemove}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition shadow-xs focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Removing document and active rules…</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove from Project</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
