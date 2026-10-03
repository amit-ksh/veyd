"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { FilePlus2, FileText, Loader2, X } from "lucide-react";
import { useChatFileImport } from "@/hooks/use-app-queries";
import { apiErrorMessage } from "@/lib/client-api";
import type { ChatFile, ChatFileResult } from "@/lib/chat-files/types";

type WebTarget = { file: ChatFile; messageId: string };
export function ChatFileIngestion({
  userId,
  projectId,
  projectName,
  conversationId,
  disabled,
  webTarget,
  onClearWebTarget,
  onImported,
  onBusyChange,
}: {
  userId: string;
  projectId: string;
  projectName: string;
  conversationId: string | null;
  disabled: boolean;
  webTarget: WebTarget | null;
  onClearWebTarget: () => void;
  onImported: (result: ChatFileResult) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const mutation = useChatFileImport(userId);
  const [local, setLocal] = useState<{ file: File; id: string } | null>(null);
  const [target, setTarget] = useState<"upload" | WebTarget | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const blob = useRef<{ id: string; url: string } | null>(null);
  const scope = useRef({ projectId, conversationId });
  scope.current = { projectId, conversationId };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onBusyChange(false);
    };
  }, [onBusyChange]);
  useEffect(() => {
    if (webTarget) {
      setTarget(webTarget);
      setTitle(webTarget.file.title);
      setError(null);
      onClearWebTarget();
    }
  }, [webTarget, onClearWebTarget]);
  useEffect(() => {
    if (target) {
      if (!dialog.current?.open) dialog.current?.showModal();
      cancel.current?.focus();
    } else dialog.current?.close();
  }, [target]);

  const close = () => {
    if (!busy) {
      setTarget(null);
      setError(null);
    }
  };
  const select = (file: File | null) => {
    if (!file) return;
    setError(null);
    if (
      (!file.name.toLowerCase().endsWith(".pdf") &&
        file.type !== "application/pdf") ||
      file.size === 0
    ) {
      setError("Choose a non-empty PDF file.");
      return;
    }
    if (file.size > 10_485_760) {
      setError("This PDF exceeds the 10 MB limit.");
      return;
    }
    setLocal({ file, id: crypto.randomUUID() });
    blob.current = null;
  };
  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || !title.trim() || busy || inFlight.current || disabled)
      return;
    inFlight.current = true;
    const startingScope = { projectId, conversationId };
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      let source:
        | {
            kind: "upload";
            blobUrl: string;
            fileName: string;
            byteSize: number;
          }
        | { kind: "web"; messageId: string; fileId: string };
      let requestId: string;
      if (target === "upload") {
        if (!local) return;
        requestId = local.id;
        setPhase("Uploading PDF…");
        if (blob.current?.id !== local.id) {
          const uploaded = await upload(
            "chat/" + projectId + "/" + local.id + ".pdf",
            local.file,
            {
              access: "private",
              contentType: "application/pdf",
              handleUploadUrl:
                "/api/projects/" +
                encodeURIComponent(projectId) +
                "/chat-files/upload",
              clientPayload: JSON.stringify({ requestId: local.id }),
            },
          );
          blob.current = { id: local.id, url: uploaded.url };
        }
        source = {
          kind: "upload",
          blobUrl: blob.current.url,
          fileName: local.file.name,
          byteSize: local.file.size,
        };
      } else {
        requestId = target.file.id;
        source = {
          kind: "web",
          messageId: target.messageId,
          fileId: target.file.id,
        };
      }
      if (mounted.current) setPhase("Adding document…");
      const result = await mutation.ingest({
        projectId,
        confirmProjectId: projectId,
        requestId,
        title: title.trim(),
        conversationId: conversationId || undefined,
        source,
      });
      if (
        !mounted.current ||
        scope.current.projectId !== startingScope.projectId ||
        scope.current.conversationId !== startingScope.conversationId
      )
        return;
      onImported(result);
      if (target === "upload") {
        setLocal(null);
        blob.current = null;
      }
      if (result.file.status === "ready") setTarget(null);
      else {
        setError(
          result.file.error ||
            "Import is pending. Review Documents before starting another import.",
        );
        // The durable card carries the failed receipt; another attempt requires a new confirmation.
        setTarget(null);
      }
    } catch (caught) {
      if (mounted.current)
        setError(
          apiErrorMessage(
            caught,
            "Could not add this PDF. Check its status in Documents and retry safely.",
          ),
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  };
  const candidate = target && target !== "upload" ? target.file : null;

  return (
    <section aria-label="Add PDFs from chat" className="space-y-3">
      <input
        ref={picker}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a PDF to add to this project"
        disabled={busy || disabled}
        onChange={(event) => {
          select(event.target.files?.[0] || null);
          event.target.value = "";
        }}
      />
      <div className="w-full flex flex-wrap justify-center items-center gap-3">
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => picker.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50"
        >
          <FilePlus2 aria-hidden className="h-4 w-4" /> Attach PDF
        </button>
        <p className="text-xs text-slate-600">PDF only · 10 MB · 100 pages.</p>
      </div>
      {local && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <FileText aria-hidden className="h-4 w-4 shrink-0 text-slate-600" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold text-slate-900">
              {local.file.name}
            </p>
            <p className="text-xs text-slate-600">
              {(local.file.size / 1024).toFixed(1)} KB ·{" "}
              {busy
                ? phase
                : blob.current
                  ? "Uploaded temporarily — confirm to finish"
                  : "Selected locally, not uploaded"}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              setTarget("upload");
              setTitle(local.file.name.replace(/\.pdf$/i, "").slice(0, 200));
              setError(null);
            }}
            className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-600"
          >
            Add to project knowledge
          </button>
          <button
            type="button"
            disabled={busy}
            aria-label="Remove selected PDF"
            onClick={() => {
              setLocal(null);
              blob.current = null;
              setError(null);
            }}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && !target && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="chat-file-confirm-title"
        aria-describedby="chat-file-confirm-description"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
      >
        <form onSubmit={confirm} className="space-y-5 p-5 sm:p-6">
          <h2 id="chat-file-confirm-title" className="text-lg font-semibold">
            Add document to project?
          </h2>
          <p
            id="chat-file-confirm-description"
            className="text-sm leading-relaxed text-slate-600"
          >
            This adds the PDF to Documents in{" "}
            <strong className="text-slate-900">{projectName}</strong>. Extracted
            entries need review and publication before chat, handbook or MCP can
            use them.
          </p>
          <div className="space-y-1">
            <label
              htmlFor="chat-file-document-name"
              className="text-sm font-medium"
            >
              Document name
            </label>
            <input
              id="chat-file-document-name"
              required
              maxLength={200}
              value={title}
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 disabled:opacity-60"
            />
          </div>
          {candidate?.url && (
            <div className="space-y-1 text-xs text-slate-600">
              <p>
                {candidate.origin === "secondary-web"
                  ? "Secondary web source — verify before publishing."
                  : "Official web source — file validity will be checked."}
              </p>
              <a
                href={candidate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-slate-800 underline underline-offset-4"
              >
                {candidate.url}
              </a>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              ref={cancel}
              type="button"
              disabled={busy}
              onClick={close}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || disabled || !title.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50"
            >
              {busy && (
                <Loader2
                  aria-hidden
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                />
              )}
              {busy ? phase : "Confirm and add document"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
