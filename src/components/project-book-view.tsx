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
} from "lucide-react";
import { ContentSkeleton } from "@/components/ui/skeleton";
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
      pageScroll.current?.scrollTo(0, 0);
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
        setExplorerOpen(false);
        return;
      }
      if (
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
      else
        goTo(Math.max(0, book?.pages.findIndex((p) => p.id === target) ?? 0));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("handbook:navigate", quick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("handbook:navigate", quick);
    };
  }, [book, explorerOpen, goTo, pageIndex]);
  useEffect(() => {
    if (figure) figureDialog.current?.showModal();
  }, [figure]);
  useEffect(() => {
    if (explorerOpen) {
      setCitation(null);
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
      <div className="mx-auto max-w-3xl space-y-6 py-6">
        <h1 className="text-xl font-semibold">Project handbook</h1>
        <p className="text-sm text-slate-600">
          {busy
            ? "Drafting cited pages from published sources…"
            : "Opening your saved book…"}
        </p>
        <ContentSkeleton
          label={busy ? "Generating handbook" : "Loading handbook"}
          rows={5}
        />
      </div>
    );
  if (!book || !handbook)
    return (
      <section className="mx-auto max-w-xl space-y-5 py-16">
        <BookOpen aria-hidden className="h-7 w-7 text-slate-400" />
        <h1 className="text-2xl font-semibold">Your project handbook</h1>
        <p className="text-sm text-slate-600">
          {data?.status === "empty"
            ? "Add a PDF and publish reviewed entries to create this book."
            : "Read a cited book generated from this project’s published sources."}
        </p>
        {(error || isError || data?.status === "failed") && (
          <p role="alert" className="text-sm text-rose-700">
            {error ||
              apiErrorMessage(
                readError,
                "Could not open the book. Please retry.",
              )}
          </p>
        )}
        <div className="flex gap-3">
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
  return (
    <section className="book-reader" aria-label={`${projectName} handbook`}>
      <header className="book-toolbar">
        <div>
          <h1>Project handbook</h1>
          <p>Read your saved book. Follow the sources.</p>
        </div>
        <div className="book-actions">
          <button
            className="book-button"
            onClick={() =>
              goTo(book.pages.findIndex((p) => p.id === "contents"))
            }
          >
            <List size={16} />
            Contents
          </button>
          <button className="book-button" onClick={() => setExplorerOpen(true)}>
            <Search size={16} />
            References
          </button>
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
                  size={15}
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Download size={15} />
              )}
              {format === "pdf" ? "PDF" : "Offline HTML"}
            </button>
          ))}
          <button
            className="book-button"
            disabled={isFetching}
            onClick={() => void refetch()}
            aria-busy={isFetching}
          >
            {isFetching && <Loader2 size={15} className="animate-spin" />}Check
            updates
          </button>
        </div>
      </header>
      {error && (
        <p className="book-error" role="alert">
          {error}
        </p>
      )}
      <div className="book-desk">
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
          <div className="book-page-number">{pageIndex + 1}</div>
        </article>
      </div>
      <nav className="book-navigation" aria-label="Book pages">
        <button
          className="book-button"
          disabled={pageIndex === 0}
          onClick={() => goTo(pageIndex - 1)}
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <label className="book-page-select">
          Page{" "}
          <select
            value={pageIndex}
            onChange={(e) => goTo(Number(e.target.value))}
            aria-label="Select handbook page"
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
          Next
          <ChevronRight size={16} />
        </button>
      </nav>
      <p className="book-edition">
        AI-drafted · Edition{" "}
        {new Date(handbook.generatedAt).toLocaleDateString()} · Verify important
        decisions against the cited sources.
      </p>
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
