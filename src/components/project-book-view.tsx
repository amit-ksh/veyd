"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useHandbook, useGenerateHandbook } from "@/hooks/use-app-queries";
import { clientApi, apiErrorMessage } from "@/lib/client-api";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Loader2,
  Search,
  X,
  FileText,
} from "lucide-react";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { CircularLoader } from "@/components/ui/circular-loader";
import { BookPageContent, BookFigure, CitationDetail } from "./handbook-page";
import type { HandbookCitation, HandbookFigure } from "@/lib/handbook/types";

export function HandbookView({
  projectId,
  projectName,
  userId,
}: {
  projectId: string;
  projectName: string;
  userId?: string;
}) {
  const generationMutation = useGenerateHandbook(userId);
  const { mutateAsync: generateSnapshot, reset: resetGeneration } =
    generationMutation;
  const generating = generationMutation.isPending;
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<"pdf" | "html" | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [referenceIndex, setReferenceIndex] = useState(0);
  const [citation, setCitation] = useState<{
    item: HandbookCitation;
    x: number;
    y: number;
  } | null>(null);
  const [figure, setFigure] = useState<HandbookFigure | null>(null);
  const figureDialog = useRef<HTMLDialogElement>(null);
  const referenceSearch = useRef<HTMLInputElement>(null);
  const pageScroll = useRef<HTMLDivElement>(null);
  const readerContainerRef = useRef<HTMLElement>(null);
  const citationTimer = useRef<ReturnType<typeof setTimeout>>();
  const attempt = useRef<string | null>(null);
  const generation = useRef<AbortController | null>(null);
  const {
    data,
    isPending,
    isError,
    isFetching,
    isFetchedAfterMount,
    error: readError,
    refetch,
  } = useHandbook(userId, projectId);
  // A failed freshness/authorization check must not expose cached book content.
  const handbook =
    !isError && isFetchedAfterMount && data?.status === "ready"
      ? data.handbook
      : null;
  const book = handbook?.reader;
  const progressKey = handbook
    ? `veyd:reading:${userId}:${projectId}:${handbook.sourceFingerprint}`
    : null;
  const generate = useCallback(async () => {
    if (generation.current) return;
    const controller = new AbortController();
    generation.current = controller;
    setError(null);
    try {
      await generateSnapshot({ projectId, signal: controller.signal });
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          apiErrorMessage(err, "Could not generate handbook. Please retry."),
        );
      }
    } finally {
      if (generation.current === controller) {
        generation.current = null;
      }
    }
  }, [generateSnapshot, projectId]);
  useEffect(() => {
    attempt.current = null;
    setError(null);
    setPageIndex(0);
    setTocOpen(false);
    setExplorerOpen(false);
    setCitation(null);
    resetGeneration();
    return () => {
      generation.current?.abort();
      generation.current = null;
      clearTimeout(citationTimer.current);
    };
  }, [projectId, resetGeneration]);
  useEffect(() => {
    if (
      (data?.status === "missing" || data?.status === "stale") &&
      isFetchedAfterMount &&
      !isError &&
      attempt.current !== projectId
    ) {
      attempt.current = projectId;
      void generate();
    }
  }, [data?.status, generate, projectId, isFetchedAfterMount, isError]);
  useEffect(() => {
    if (!progressKey || !book) return;
    try {
      setPageIndex(
        Math.max(
          0,
          book.pages.findIndex(
            (p) => p.id === localStorage.getItem(progressKey),
          ),
        ),
      );
    } catch {
      setPageIndex(0);
    }
  }, [progressKey, book]);
  const goTo = useCallback(
    (index: number) => {
      if (!book) return;
      const next = Math.max(0, Math.min(book.pages.length - 1, index));
      setPageIndex(next);
      setCitation(null);
      setTocOpen(false);
      pageScroll.current?.scrollTo({ top: 0, behavior: "smooth" });
      if (typeof window !== "undefined") {
        readerContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (progressKey) {
        try {
          localStorage.setItem(progressKey, book.pages[next].id);
        } catch {
          /* Reading works without storage. */
        }
      }
    },
    [book, progressKey],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCitation(null);
        setTocOpen(false);
        setExplorerOpen(false);
        return;
      }
      if (
        tocOpen ||
        explorerOpen ||
        figureDialog.current?.open ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(pageIndex + (e.key === "ArrowRight" ? 1 : -1));
      }
    };
    const quick = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      if (target === "explorer") setExplorerOpen(true);
      else if (target === "contents") setTocOpen(true);
      else
        goTo(Math.max(0, book?.pages.findIndex((p) => p.id === target) ?? 0));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("handbook:navigate", quick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("handbook:navigate", quick);
    };
  }, [book, explorerOpen, tocOpen, goTo, pageIndex]);
  useEffect(() => {
    if (figure) figureDialog.current?.showModal();
  }, [figure]);
  useEffect(() => {
    if (explorerOpen) {
      setCitation(null);
      setTocOpen(false);
      referenceSearch.current?.focus();
    }
  }, [explorerOpen]);
  const references = useMemo(
    () =>
      (handbook?.citations || []).filter((c) =>
        `${c.documentTitle} ${c.citation} ${c.evidenceExcerpt || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [handbook, search],
  );
  const currentReference =
    references[Math.min(referenceIndex, references.length - 1)];
  const fetchDownload = async (format: "pdf" | "html") => {
    setDownload(format);
    setError(null);
    try {
      const url = URL.createObjectURL(
        await clientApi.handbookFile(projectId, format),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "-") || "project"}-handbook.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(apiErrorMessage(err, "Download failed. Please retry."));
    } finally {
      setDownload(null);
    }
  };
  const showCitation = (item: HandbookCitation, button: HTMLButtonElement) => {
    clearTimeout(citationTimer.current);
    const r = button.getBoundingClientRect();
    setCitation({
      item,
      x: Math.max(12, Math.min(r.left, window.innerWidth - 332)),
      y: Math.max(12, Math.min(r.bottom + 8, window.innerHeight - 350)),
    });
  };
  const hideCitation = () => {
    citationTimer.current = setTimeout(() => setCitation(null), 180);
  };
  const busy = generating || data?.status === "generating";
  if (isPending || busy || (!isFetchedAfterMount && isFetching))
    return (
      <div className="mx-auto max-w-3xl space-y-8 py-12 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <CircularLoader
            size="lg"
            variant="brand"
            label={busy ? "Drafting cited pages from published sources…" : "Opening your saved book…"}
            sublabel="Synthesizing compliance articles and structured references"
          />
        </div>
        <ContentSkeleton
          label={busy ? "Generating handbook" : "Loading handbook"}
          rows={4}
        />
      </div>
    );
  if (!book || !handbook)
    return (
      <section className="mx-auto max-w-xl space-y-5 py-16 text-center sm:text-left">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mx-auto sm:mx-0">
          <BookOpen aria-hidden className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Your project handbook</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          {data?.status === "empty"
            ? "Add a PDF and publish reviewed entries to create this book."
            : "Read a cited book generated from this project’s published sources."}
        </p>
        {(error || isError || data?.status === "failed") && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
            {error ||
              apiErrorMessage(
                readError,
                "Could not open the book. Please retry.",
              )}
          </p>
        )}
        <div className="flex gap-3 justify-center sm:justify-start">
          {data?.status !== "empty" && (
            <button
              className="book-button"
              disabled={isFetching || generating}
              onClick={() =>
                isError || !data ? void refetch() : void generate()
              }
            >
              {isFetching && (
                <Loader2
                  size={15}
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              )}
              Retry
            </button>
          )}
          <Link
            className="book-button"
            href={`/projects/${projectId}/documents`}
          >
            Open documents
          </Link>
        </div>
      </section>
    );

  const page = book.pages[Math.min(pageIndex, book.pages.length - 1)];
  const progressPercent = Math.round(((pageIndex + 1) / book.pages.length) * 100);

  return (
    <section
      ref={readerContainerRef}
      className="book-reader relative"
      aria-label={`${projectName} handbook`}
    >
      {/* Sticky Header Reading Toolbar */}
      <header className="book-toolbar relative">
        <div className="min-w-0">
          <h1>
            <BookOpen className="w-4 h-4 text-[#008f96] shrink-0" />
            <span className="truncate">{projectName} Handbook</span>
          </h1>
          <p>
            Page {pageIndex + 1} of {book.pages.length} &bull; {progressPercent}% read
          </p>
        </div>

        {/* Action Controls */}
        <div className="book-actions">
          {/* Quick Page Stepper */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 shadow-2xs">
            <button
              type="button"
              className="book-button !min-h-[30px] !py-1 !px-2 !border-0 hover:!bg-white"
              disabled={pageIndex === 0}
              onClick={() => goTo(pageIndex - 1)}
              title="Previous page (Left arrow)"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-bold text-slate-700 px-1 font-mono">
              {pageIndex + 1} / {book.pages.length}
            </span>
            <button
              type="button"
              className="book-button !min-h-[30px] !py-1 !px-2 !border-0 hover:!bg-white"
              disabled={pageIndex === book.pages.length - 1}
              onClick={() => goTo(pageIndex + 1)}
              title="Next page (Right arrow)"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Table of Contents Drawer Toggle */}
          <button
            type="button"
            className={`book-button ${tocOpen ? "book-button-active" : ""}`}
            onClick={() => setTocOpen(!tocOpen)}
            aria-expanded={tocOpen}
            aria-label="Table of Contents"
          >
            <List size={14} />
            <span>Contents</span>
          </button>

          {/* References Drawer Toggle */}
          <button
            type="button"
            className={`book-button ${explorerOpen ? "book-button-active" : ""}`}
            onClick={() => setExplorerOpen(true)}
            aria-label="Search references"
          >
            <Search size={14} />
            <span>References</span>
          </button>

          {/* Exports */}
          {(["pdf", "html"] as const).map((format) => (
            <button
              key={format}
              className="book-button"
              disabled={!!download}
              onClick={() => void fetchDownload(format)}
              aria-busy={download === format}
            >
              {download === format ? (
                <Loader2
                  size={14}
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Download size={14} />
              )}
              <span>{format === "pdf" ? "PDF" : "Offline"}</span>
            </button>
          ))}

          {/* Check updates */}
          <button
            className="book-button"
            disabled={isFetching}
            onClick={() => void refetch()}
            aria-busy={isFetching}
            title="Check for handbook updates"
          >
            {isFetching && <Loader2 size={14} className="animate-spin" />}
            <span>Updates</span>
          </button>
        </div>

        {/* Reading Progress Line */}
        <div
          className="book-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </header>

      {error && (
        <p className="book-error mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs" role="alert">
          {error}
        </p>
      )}

      {/* Main Reading Desk with Floating Chevrons */}
      <div className="book-desk">
        {/* Floating Left Chevron */}
        <button
          type="button"
          className="book-float-nav book-float-prev"
          disabled={pageIndex === 0}
          onClick={() => goTo(pageIndex - 1)}
          aria-label="Previous page (Left arrow)"
          title="Previous page (Left arrow)"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Floating Right Chevron */}
        <button
          type="button"
          className="book-float-nav book-float-next"
          disabled={pageIndex === book.pages.length - 1}
          onClick={() => goTo(pageIndex + 1)}
          aria-label="Next page (Right arrow)"
          title="Next page (Right arrow)"
        >
          <ChevronRight size={20} />
        </button>

        {/* Paper Document Card */}
        <article
          className={`book-paper book-${page.kind}`}
          aria-label={`Page ${pageIndex + 1}: ${page.title}`}
        >
          <div ref={pageScroll} className="book-page-scroll" tabIndex={0}>
            <BookPageContent
              page={page}
              snapshot={handbook}
              goTo={(number) => goTo(number - 1)}
              onCitation={showCitation}
              onCitationLeave={hideCitation}
              onFigure={setFigure}
            />
          </div>
          <div className="book-page-number">
            Page {pageIndex + 1} of {book.pages.length}
          </div>
        </article>
      </div>

      {/* Bottom Auxiliary Navigation */}
      <nav className="book-navigation mt-6 flex items-center justify-between" aria-label="Book pages">
        <button
          className="book-button"
          disabled={pageIndex === 0}
          onClick={() => goTo(pageIndex - 1)}
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>
        <label className="book-page-select flex items-center gap-2 text-xs text-slate-600">
          <span>Jump to:</span>
          <select
            value={pageIndex}
            onChange={(e) => goTo(Number(e.target.value))}
            aria-label="Select handbook page"
            className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00c9d2]"
          >
            {book.pages.map((p, i) => (
              <option key={p.id} value={i}>
                {i + 1} — {p.title}
              </option>
            ))}
          </select>
          <span>of {book.pages.length}</span>
        </label>
        <button
          className="book-button"
          disabled={pageIndex === book.pages.length - 1}
          onClick={() => goTo(pageIndex + 1)}
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </nav>

      <p className="book-edition text-center mt-3 text-xs text-slate-500">
        AI-drafted &bull; Edition {new Date(handbook.generatedAt).toLocaleDateString()} &bull; Verify important decisions against the cited sources.
      </p>

      {/* Table of Contents Slide-Out Drawer */}
      {tocOpen && (
        <>
          <aside className="fixed inset-y-0 left-0 w-80 bg-white border-r border-slate-200 z-50 shadow-2xl flex flex-col p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-[#008f96]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Table of Contents
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTocOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                aria-label="Close contents"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-1">
              {book.pages.map((p, idx) => {
                const isActive = idx === pageIndex;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => goTo(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition ${
                      isActive
                        ? "bg-[#00c9d2]/15 text-[#008f96] font-bold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-semibold ${
                        isActive ? "bg-[#00c9d2] text-slate-950 font-bold" : "bg-slate-100 text-slate-500"
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="truncate">{p.title}</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 shrink-0">
                      {p.kind}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Tip: Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">←</kbd> and <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">→</kbd> keys to flip pages
              </p>
            </div>
          </aside>
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-40 animate-in fade-in"
            onClick={() => setTocOpen(false)}
            aria-hidden="true"
          />
        </>
      )}

      {/* Citation Details Popup */}
      {citation && (
        <aside
          role="dialog"
          aria-label="Citation details"
          className="book-citation-popup"
          style={{ left: citation.x, top: citation.y }}
          onMouseEnter={() => clearTimeout(citationTimer.current)}
          onMouseLeave={hideCitation}
          onFocusCapture={() => clearTimeout(citationTimer.current)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              hideCitation();
          }}
        >
          <button
            className="book-close"
            aria-label="Close citation"
            onClick={() => setCitation(null)}
          >
            <X size={16} />
          </button>
          <CitationDetail citation={citation.item} projectId={projectId} />
          <button
            className="book-button"
            onClick={() => {
              setSearch("");
              setReferenceIndex(handbook.citations.indexOf(citation.item));
              setExplorerOpen(true);
              setCitation(null);
            }}
          >
            Explore reference
          </button>
        </aside>
      )}

      {/* Reference Explorer Drawer */}
      {explorerOpen && (
        <aside className="book-explorer" aria-label="Reference explorer">
          <header>
            <h2>Reference explorer</h2>
            <button
              className="book-button"
              onClick={() => setExplorerOpen(false)}
              aria-label="Close references"
            >
              <X size={16} />
            </button>
          </header>
          <label>
            Search sources
            <input
              ref={referenceSearch}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setReferenceIndex(0);
              }}
              placeholder="Title, location or evidence"
            />
          </label>
          {currentReference ? (
            <>
              <p className="book-eyebrow">
                {Math.min(referenceIndex, references.length - 1) + 1} of{" "}
                {references.length} references
              </p>
              <CitationDetail
                citation={currentReference}
                projectId={projectId}
              />
              <div className="book-actions">
                <button
                  className="book-button"
                  disabled={referenceIndex <= 0}
                  onClick={() => setReferenceIndex(referenceIndex - 1)}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  className="book-button"
                  disabled={referenceIndex >= references.length - 1}
                  onClick={() => setReferenceIndex(referenceIndex + 1)}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
              <h3>Appears on</h3>
              <div className="book-reference-pages">
                {book.pages.map((p, i) =>
                  [
                    ...p.blocks.flatMap((b) => b.sourceKeys),
                    ...(p.figure?.sourceKeys || []),
                  ].includes(currentReference.sourceKey) ? (
                    <button
                      key={p.id}
                      className="book-button"
                      onClick={() => {
                        goTo(i);
                        setExplorerOpen(false);
                      }}
                    >
                      Page {i + 1}
                    </button>
                  ) : null,
                )}
              </div>
            </>
          ) : (
            <p>No matching sources.</p>
          )}
          <details>
            <summary>Edition and evidence limits</summary>
            <p>
              Model: {book.model}. Generator: {book.generatorVersion}. Source
              fingerprint: {handbook.sourceFingerprint}.
            </p>
            {book.limitations.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </details>
        </aside>
      )}

      {/* Figure Dialog */}
      <dialog
        ref={figureDialog}
        className="book-figure-dialog"
        onClose={() => setFigure(null)}
      >
        <button
          className="book-button"
          onClick={() => figureDialog.current?.close()}
          aria-label="Close figure"
        >
          <X size={16} />
        </button>
        {figure && <BookFigure figure={figure} />}
      </dialog>
    </section>
  );
}
