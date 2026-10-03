"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, RefreshCw, X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { apiErrorMessage } from "@/lib/client-api";
import {
  useDocumentReview,
  usePublishReviewedEntries,
} from "@/hooks/use-document-review";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { CircularLoader } from "@/components/ui/circular-loader";
import { getDocumentReviewUrl } from "@/lib/sanity/studio-links";
import {
  MAX_REVIEW_SELECTION,
  reviewFieldIssues,
  type DocumentReviewResponse,
  type ReviewEntry,
  type ReviewFields,
} from "@/lib/review/types";

const inputStyle =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 disabled:bg-slate-50";
const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const checkStyle = "h-4 w-4 shrink-0 accent-slate-900";

function ReviewEntryEditor({
  entry,
  fields,
  selected,
  disabled,
  selectionFull,
  pageCount,
  fileUrl,
  onSelect,
  onEdit,
}: {
  entry: ReviewEntry;
  fields: ReviewFields;
  selected: boolean;
  disabled: boolean;
  selectionFull: boolean;
  pageCount: number;
  fileUrl: string | null;
  onSelect: () => void;
  onEdit: (fields: ReviewFields) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pages, setPages] = useState(fields.sourcePages.join(", "));
  const [keywords, setKeywords] = useState(fields.keywords.join(", "));
  const panelId = useId();
  const issues = reviewFieldIssues(fields, pageCount);
  const update = <K extends keyof ReviewFields>(
    key: K,
    value: ReviewFields[K],
  ) => onEdit({ ...fields, [key]: value });
  const textField = (
    key:
      | "ruleName"
      | "description"
      | "requirement"
      | "applicability"
      | "jurisdiction"
      | "regulator"
      | "citation"
      | "evidenceExcerpt",
    label: string,
    multiline = false,
  ) => (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>
        {label}
        {key === "regulator" ? " (optional)" : ""}
      </span>
      {multiline ? (
        <textarea
          className={inputStyle}
          rows={3}
          value={fields[key]}
          disabled={disabled}
          onChange={(event) => update(key, event.target.value)}
        />
      ) : (
        <input
          className={inputStyle}
          value={fields[key]}
          disabled={disabled}
          onChange={(event) => update(key, event.target.value)}
        />
      )}
    </label>
  );

  return (
    <section
      className={`border-b border-slate-200 py-5 last:border-b-0 ${selected ? "bg-slate-50/70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`Select ${fields.ruleName || "untitled entry"} for publication`}
          className={`${checkStyle} mt-1`}
          checked={selected}
          disabled={disabled || (selectionFull && !selected)}
          onChange={onSelect}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="break-words text-base font-semibold leading-snug text-slate-900">
            {fields.ruleName || "Untitled entry"}
          </h3>
          <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
            {fields.requirement || "Add the requirement before publishing."}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="break-words text-slate-600">
              {fields.citation || "Citation missing"}
            </span>
            {fileUrl &&
              Array.from(
                new Set(
                  fields.sourcePages.filter(
                    (page) =>
                      Number.isInteger(page) && page > 0 && page <= pageCount,
                  ),
                ),
              ).map((page) => (
                <a
                  key={page}
                  className="inline-flex min-h-8 items-center gap-1 text-teal-700 underline underline-offset-4 hover:text-teal-900"
                  href={`${fileUrl.split("#")[0]}#page=${page}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDF page {page}
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
              ))}
          </div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded(!expanded)}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-slate-800 hover:underline underline-offset-4"
          >
            {expanded ? "Hide evidence & edits" : "Review evidence & edit"}
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          {selected && issues.length > 0 && (
            <p className="text-sm text-rose-700">
              Resolve {issues.length} validation issue
              {issues.length === 1 ? "" : "s"} before publishing.
            </p>
          )}
        </div>
      </div>
      {expanded && (
        <div id={panelId} className="mt-4 space-y-5 pl-7">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Source evidence
            </h4>
            <blockquote className="mt-2 max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
              {entry.fields.evidenceExcerpt ||
                "No evidence excerpt recorded. Add supporting evidence below."}
            </blockquote>
            <p className="mt-2 text-xs text-slate-500">
              Compare this excerpt with the PDF before approving. AI extraction
              is not verification.
            </p>
          </div>
          <fieldset disabled={disabled} className="space-y-4">
            <legend className="mb-3 text-sm font-semibold text-slate-900">
              Corrections
            </legend>
            {textField("ruleName", "Entry name")}
            {textField("requirement", "Requirement", true)}
            {textField("description", "Explanation", true)}
            {textField("applicability", "When it applies", true)}
            {textField("evidenceExcerpt", "Supporting excerpt", true)}
            {textField("citation", "Source citation")}
            <div className="grid gap-4 sm:grid-cols-2">
              {textField("jurisdiction", "Jurisdiction")}
              {textField("regulator", "Issuing authority")}
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>PDF pages (comma-separated)</span>
                <input
                  className={inputStyle}
                  value={pages}
                  inputMode="text"
                  onChange={(event) => {
                    setPages(event.target.value);
                    update(
                      "sourcePages",
                      event.target.value.trim()
                        ? event.target.value
                            .split(",")
                            .map((page) => Number(page.trim()))
                        : [],
                    );
                  }}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Keywords (comma-separated)</span>
                <input
                  className={inputStyle}
                  value={keywords}
                  onChange={(event) => {
                    setKeywords(event.target.value);
                    update(
                      "keywords",
                      event.target.value.trim()
                        ? event.target.value
                            .split(",")
                            .map((word) => word.trim())
                        : [],
                    );
                  }}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Effective date (optional)</span>
                <input
                  className={inputStyle}
                  type="date"
                  value={fields.effectiveDate || ""}
                  onChange={(event) =>
                    update("effectiveDate", event.target.value || null)
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Expiry / review deadline (optional)</span>
                <input
                  className={inputStyle}
                  type="date"
                  value={fields.expiresAt || ""}
                  onChange={(event) =>
                    update("expiresAt", event.target.value || null)
                  }
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              <span>Source status</span>
              <select
                className={inputStyle}
                value={fields.freshnessStatus}
                onChange={(event) =>
                  update(
                    "freshnessStatus",
                    event.target.value as ReviewFields["freshnessStatus"],
                  )
                }
              >
                <option value="" disabled>
                  Choose a status
                </option>
                <option value="current">Current</option>
                <option value="stale">Stale</option>
                <option value="superseded">Superseded</option>
              </select>
            </label>
          </fieldset>
          {issues.length > 0 && (
            <ul
              className="list-inside list-disc space-y-1 text-sm text-rose-700"
              aria-label="Entry validation issues"
            >
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function DocumentReviewDialog({
  projectId,
  documentId,
  onClose,
}: {
  projectId: string;
  documentId: string;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const query = useDocumentReview(session?.user.id, projectId, documentId);
  const publish = usePublishReviewedEntries(
    session?.user.id,
    projectId,
    documentId,
  );
  const [snapshot, setSnapshot] = useState<DocumentReviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, ReviewFields>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const submissionLock = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus();
    };
  }, []);
  useEffect(() => {
    if (query.data && !query.isFetching && !query.isError && !snapshot)
      setSnapshot(query.data);
  }, [query.data, query.isFetching, query.isError, snapshot]);

  const close = () => {
    if (submissionLock.current) return;
    if (
      Object.keys(edits).length &&
      !window.confirm(
        "Discard unpublished corrections? Nothing else will be changed.",
      )
    )
      return;
    onClose();
  };
  const selectedEntries =
    snapshot?.entries.filter((entry) => selected.has(entry.id)) || [];
  const invalidSelection = selectedEntries.some(
    (entry) =>
      reviewFieldIssues(
        edits[entry.id] || entry.fields,
        snapshot?.document.pageCount || 0,
      ).length > 0,
  );
  const reload = async () => {
    if (
      Object.keys(edits).length &&
      !window.confirm(
        "Discard unpublished corrections and reload the latest entries?",
      )
    )
      return;
    setSelected(new Set());
    setConfirmed(false);
    setEdits({});
    setSnapshot(null);
    setNotice(null);
    publish.reset();
    const result = await query.refetch();
    if (result.data && !result.isError) setSnapshot(result.data);
  };
  const publishSelected = async () => {
    if (
      submissionLock.current ||
      !confirmed ||
      !selectedEntries.length ||
      invalidSelection
    )
      return;
    submissionLock.current = true;
    try {
      const result = await publish.mutateAsync({
        confirmReviewed: true,
        entries: selectedEntries.map((entry) => ({
          id: entry.id,
          revision: entry.revision,
          fields: edits[entry.id] || entry.fields,
        })),
      });
      const completed = new Set(
        result.publishedIds.map((id) => `drafts.${id}`),
      );
      setSnapshot((previous) =>
        previous
          ? {
              ...previous,
              entries: previous.entries.filter(
                (entry) => !completed.has(entry.id),
              ),
              totalPending: Math.max(0, previous.totalPending - completed.size),
            }
          : previous,
      );
      setEdits((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([id]) => !completed.has(id)),
        ),
      );
      setSelected(new Set());
      setConfirmed(false);
      setNotice(
        `${result.publishedIds.length} entr${result.publishedIds.length === 1 ? "y" : "ies"} published. Unselected entries remain drafts.`,
      );
    } catch {
      /* The mutation exposes a safe API error below; retain edits for recovery. */
    } finally {
      submissionLock.current = false;
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="m-auto max-h-[94dvh] w-[95vw] max-w-4xl rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
    >
      <div className="flex max-h-[94dvh] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold">
              Review extracted entries
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-slate-600">
              Check the evidence, select entries, then confirm publication.
            </p>
            {snapshot && (
              <p className="mt-2 break-words text-sm font-medium text-slate-800">
                {snapshot.document.title} · {snapshot.totalPending} awaiting
                review
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close review"
            onClick={close}
            disabled={publish.isPending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        <div
          className="min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6"
          aria-busy={query.isFetching && !snapshot}
        >
          {!snapshot && !query.isError && (
            <ContentSkeleton
              label="Loading entries awaiting review…"
              rows={3}
            />
          )}
          {query.isError && !snapshot && (
            <div className="py-6">
              <p role="alert" className="text-sm text-rose-700">
                {apiErrorMessage(
                  query.error,
                  "Could not load entries. Reload to try again.",
                )}
              </p>
              <button
                type="button"
                className={`${secondaryButton} mt-4`}
                onClick={() => void reload()}
                disabled={query.isFetching}
              >
                Reload entries
              </button>
            </div>
          )}
          {snapshot && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-3 text-sm">
                <span className="text-slate-600">
                  {selected.size} selected · maximum {MAX_REVIEW_SELECTION} per
                  batch
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => {
                      setSelected(new Set());
                      setConfirmed(false);
                    }}
                    disabled={!selected.size || publish.isPending}
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => void reload()}
                    disabled={query.isFetching || publish.isPending}
                  >
                    {query.isFetching ? (
                      <CircularLoader size="xs" variant="primary" />
                    ) : (
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    )}
                    Reload
                  </button>
                </div>
              </div>
              {snapshot.hasMore && (
                <p className="py-3 text-sm text-slate-600">
                  Showing the first {snapshot.entries.length} drafts. Publish a
                  selection, then reload to continue.
                </p>
              )}
              {snapshot.entries.length === 0 && (
                <div className="py-10">
                  <h3 className="text-base font-semibold">
                    Nothing awaiting review
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    There are no draft entries for this document. Studio remains
                    available for editing published entries.
                  </p>
                  <a
                    className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm text-teal-700 underline underline-offset-4"
                    href={getDocumentReviewUrl(documentId, projectId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Studio
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </a>
                </div>
              )}
              {snapshot.entries.map((entry) => (
                <ReviewEntryEditor
                  key={`${entry.id}:${entry.revision}`}
                  entry={entry}
                  fields={edits[entry.id] || entry.fields}
                  selected={selected.has(entry.id)}
                  disabled={publish.isPending}
                  selectionFull={selected.size >= MAX_REVIEW_SELECTION}
                  pageCount={snapshot.document.pageCount}
                  fileUrl={snapshot.document.fileUrl}
                  onSelect={() => {
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (next.has(entry.id)) next.delete(entry.id);
                      else if (next.size < MAX_REVIEW_SELECTION)
                        next.add(entry.id);
                      return next;
                    });
                    setConfirmed(false);
                    publish.reset();
                  }}
                  onEdit={(fields) => {
                    setEdits((previous) => ({
                      ...previous,
                      [entry.id]: fields,
                    }));
                    setConfirmed(false);
                    publish.reset();
                  }}
                />
              ))}
            </>
          )}
        </div>
        <footer className="shrink-0 space-y-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          {notice && (
            <p
              role="status"
              className="flex items-start gap-2 text-sm text-emerald-800"
            >
              <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
          )}
          {publish.isError && (
            <p role="alert" className="text-sm text-rose-700">
              {apiErrorMessage(
                publish.error,
                "Publication could not be confirmed. Reload entries before retrying.",
              )}
            </p>
          )}
          {invalidSelection && (
            <p className="text-sm text-rose-700">
              Correct validation issues in the selected entries before
              publishing.
            </p>
          )}
          {snapshot && snapshot.entries.length > 0 && (
            <label className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
              <input
                className={`${checkStyle} mt-1`}
                type="checkbox"
                checked={confirmed}
                disabled={!selected.size || publish.isPending}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                I reviewed the selected entries against their source evidence
                and approve publishing them.
              </span>
            </label>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-prose text-xs text-slate-500">
              Only selected entries and their corrections are saved. Published
              entries become project knowledge.
            </p>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                publish.isPending ||
                !selected.size ||
                !confirmed ||
                invalidSelection
              }
              onClick={() => void publishSelected()}
            >
              {publish.isPending ? (
                <>
                  <CircularLoader size="xs" variant="white" />
                  Publishing selected…
                </>
              ) : (
                `Publish selected (${selected.size})`
              )}
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
