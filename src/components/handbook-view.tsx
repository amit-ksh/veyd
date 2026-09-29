"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  Bookmark,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";
import type {
  ProjectHandbookSnapshot,
  HandbookChapter,
  HandbookRuleSection,
  HandbookCitation,
  HandbookResponse,
} from "@/lib/handbook/types";

interface HandbookViewProps {
  projectId: string;
  projectName: string;
  userId?: string;
}

export function HandbookView({ projectId, projectName, userId }: HandbookViewProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<HandbookResponse["status"] | null>(null);
  const [handbook, setHandbook] = useState<ProjectHandbookSnapshot | null>(null);
  const [indexSearchQuery, setIndexSearchQuery] = useState("");
  const [activeAnchor, setActiveAnchor] = useState<string>("");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{ anchor: string; label: string } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Storage key for reading progress
  const getProgressStorageKey = useCallback(
    (fingerprint?: string) => {
      const uid = userId || "default";
      const fp = fingerprint || handbook?.sourceFingerprint || "current";
      return `veyd_handbook_progress:${uid}:${projectId}:${fp}`;
    },
    [userId, projectId, handbook?.sourceFingerprint]
  );

  // 1. Fetch handbook state
  const fetchHandbookState = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/handbook`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load handbook (${res.status})`);
      }

      const data: HandbookResponse = await res.json();
      setStatus(data.status);

      if (data.status === "ready" && data.handbook) {
        setHandbook(data.handbook);
        setGenerating(false);

        // Check for saved reading progress
        const savedAnchor = localStorage.getItem(getProgressStorageKey(data.handbook.sourceFingerprint));
        if (savedAnchor && savedAnchor !== activeAnchor) {
          setResumePrompt({
            anchor: savedAnchor,
            label: savedAnchor.replace("sec-", "Section ").replace("ch-", "Chapter "),
          });
        }
      } else if (data.status === "missing" || data.status === "stale") {
        // Automatic lazy regeneration on missing or stale state
        handleGenerateHandbook();
      } else if (data.status === "generating") {
        setGenerating(true);
        // Poll status after delay
        setTimeout(fetchHandbookState, (data.retryAfterSeconds || 3) * 1000);
      } else if (data.status === "empty") {
        setHandbook(null);
        setGenerating(false);
      } else if (data.status === "failed") {
        setHandbook(null);
        setGenerating(false);
        setError("Handbook generation previously failed. Please click retry.");
      }
    } catch (err: any) {
      console.error("Handbook fetch error:", err);
      setError(err.message || "Failed to load project handbook.");
    } finally {
      setLoading(false);
    }
  }, [projectId, getProgressStorageKey]);

  useEffect(() => {
    fetchHandbookState();
  }, [fetchHandbookState]);

  // 2. Trigger generation
  const handleGenerateHandbook = async () => {
    if (!projectId || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/handbook/generate`, {
        method: "POST",
        cache: "no-store",
      });

      if (res.status === 202) {
        // Generating in background
        const data = await res.json();
        setTimeout(fetchHandbookState, (data.retryAfterSeconds || 3) * 1000);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || `Generation failed (${res.status})`);
      }

      const data: HandbookResponse = await res.json();
      setStatus(data.status);

      if (data.status === "ready" && data.handbook) {
        setHandbook(data.handbook);
        setGenerating(false);
      } else if (data.status === "empty") {
        setHandbook(null);
        setGenerating(false);
      }
    } catch (err: any) {
      console.error("Handbook generation error:", err);
      setError(err.message || "Failed to generate project handbook.");
      setGenerating(false);
    }
  };

  // 3. Scroll tracking for Table of Contents and Reading Progress
  useEffect(() => {
    if (!handbook) return;

    const anchors = [
      ...handbook.chapters.map((ch) => ch.anchor),
      ...handbook.chapters.flatMap((ch) => [
        ...ch.currentRules.map((r) => r.anchor),
        ...ch.reviewRequiredRules.map((r) => r.anchor),
      ]),
      "source-notes",
      "subject-index",
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            setActiveAnchor(id);
            // Save reading progress to local storage (presentation only)
            localStorage.setItem(getProgressStorageKey(), id);
            break;
          }
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      }
    );

    for (const anchor of anchors) {
      const el = document.getElementById(anchor);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [handbook, getProgressStorageKey]);

  // Jump to anchor helper
  const scrollToAnchor = (anchor: string) => {
    const el = document.getElementById(anchor);
    if (el) {
      const topOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveAnchor(anchor);
      localStorage.setItem(getProgressStorageKey(), anchor);
    }
    setMobileTocOpen(false);
  };

  // Download PDF handler
  const handleDownloadPdf = async () => {
    if (!projectId || !handbook) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/handbook.pdf`, {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 409) {
          alert("Handbook content changed. Regenerating the latest version first…");
          await handleGenerateHandbook();
          return;
        }
        throw new Error(`Failed to download PDF (${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}-handbook.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // =========================================================================
  // LOADING / GENERATING STATE
  // =========================================================================
  if (loading || generating) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto" aria-live="polite">
        <div className="w-14 h-14 rounded-2xl bg-[#00c9d2]/10 flex items-center justify-center text-[#008f96] border border-[#00c9d2]/30">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-[#020618]">
            {generating ? "Compiling Project Handbook…" : "Loading Project Handbook…"}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {generating
              ? "Deterministically compiling reviewed compliance rules, table of contents, citations, and subject index for this project."
              : "Verifying current published rule inventory and source fingerprint…"}
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ERROR STATE
  // =========================================================================
  if (error) {
    return (
      <div className="py-16 max-w-lg mx-auto space-y-4" role="alert">
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3">
          <div className="flex items-center gap-2.5 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Handbook Generation Issue</span>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={handleGenerateHandbook}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Compilation</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // EMPTY STATE
  // =========================================================================
  if (status === "empty" || !handbook) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto border border-slate-200">
          <BookOpen className="w-7 h-7 text-slate-500" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-[#020618]">No Published Rules to Compile</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The project handbook compiles automatically from human-reviewed, published compliance rules in{" "}
            <strong>{projectName}</strong>. Upload a regulatory PDF and publish extracted rules in Sanity Studio to generate your handbook.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href={`/projects/${projectId}/documents`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#020618] hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </Link>
          <a
            href="http://localhost:3333"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-4 py-2 bg-[#00c9d2]/15 hover:bg-[#00c9d2]/25 text-[#008f96] border border-[#00c9d2]/30 rounded-xl text-xs font-semibold transition"
          >
            <span>Open Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // Filter subject index
  const filteredIndex = handbook.subjectIndex.filter((entry) =>
    entry.term.toLowerCase().includes(indexSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Resume Reading Banner (Presentation only) */}
      {resumePrompt && (
        <div className="bg-[#00c9d2]/10 border border-[#00c9d2]/30 rounded-xl p-3 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-slate-800">
            <Bookmark className="w-4 h-4 text-[#008f96] shrink-0" />
            <span>
              Resume reading where you left off at <strong>{resumePrompt.label}</strong>?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                scrollToAnchor(resumePrompt.anchor);
                setResumePrompt(null);
              }}
              className="px-3 py-1 bg-[#008f96] hover:bg-[#007b81] text-white rounded-lg font-semibold text-xs transition"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => setResumePrompt(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              aria-label="Dismiss reading prompt"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header & Action Bar */}
      <header className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#00c9d2]/15 text-[#008f96] border border-[#00c9d2]/30">
                <BookOpen className="w-3 h-3" />
                <span>Project Handbook</span>
              </span>
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs text-slate-500 font-medium">
                Compiled {new Date(handbook.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#020618] tracking-tight">
              {projectName} Operating Handbook
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Universal compliance handbook automatically compiled from reviewed and published internal rules. Fully attributable with formal citations and source document tracking.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleGenerateHandbook}
              disabled={generating}
              title="Recheck sources and compile fresh handbook"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#020618] hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs focus-visible:ring-2 focus-visible:ring-[#00c9d2] disabled:opacity-50"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing PDF…</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2 sm:gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>{handbook.documentCount} Chapter{handbook.documentCount === 1 ? "" : "s"}</span>
          </div>
          <span className="text-slate-300">&bull;</span>
          <div className="flex items-center gap-1.5 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{handbook.currentRuleCount} Active Obligation{handbook.currentRuleCount === 1 ? "" : "s"}</span>
          </div>
          {handbook.reviewRequiredRuleCount > 0 && (
            <>
              <span className="text-slate-300">&bull;</span>
              <div className="flex items-center gap-1.5 text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>{handbook.reviewRequiredRuleCount} Review Required</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile Table of Contents Trigger */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTocOpen(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs"
          aria-expanded={mobileTocOpen}
        >
          <div className="flex items-center gap-2">
            <Menu className="w-4 h-4 text-slate-500" />
            <span>Table of Contents ({handbook.chapters.length} Chapters)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Main 2-Column Book Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ========================================================================= */}
        {/* DESKTOP STICKY TABLE OF CONTENTS                                          */}
        {/* ========================================================================= */}
        <aside
          className="hidden lg:block lg:col-span-4 sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto space-y-4 pr-2"
          aria-label="Handbook Navigation"
        >
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              <BookOpen className="w-3.5 h-3.5 text-[#008f96]" />
              <span>Table of Contents</span>
            </div>

            <nav className="space-y-1 text-xs" aria-label="Chapters and Sections">
              {handbook.chapters.map((ch) => {
                const isChapterActive = activeAnchor === ch.anchor;
                return (
                  <div key={ch.documentId} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => scrollToAnchor(ch.anchor)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-bold transition flex items-center justify-between gap-1.5 ${
                        isChapterActive
                          ? "bg-[#00c9d2]/15 text-[#008f96]"
                          : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">
                        Ch. {ch.number}: {ch.title}
                      </span>
                    </button>

                    {/* Nested section list */}
                    <div className="pl-3 space-y-0.5 border-l border-slate-100 ml-2">
                      {ch.currentRules.map((sec) => {
                        const isSecActive = activeAnchor === sec.anchor;
                        return (
                          <button
                            key={sec.anchor}
                            type="button"
                            onClick={() => scrollToAnchor(sec.anchor)}
                            className={`w-full text-left px-2 py-1 rounded text-[11px] truncate transition ${
                              isSecActive
                                ? "font-bold text-[#008f96] bg-[#00c9d2]/10"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            <span className="font-mono text-[10px] mr-1 text-slate-400">§{sec.number}</span>
                            <span>{sec.ruleName}</span>
                          </button>
                        );
                      })}

                      {ch.reviewRequiredRules.map((sec) => {
                        const isSecActive = activeAnchor === sec.anchor;
                        return (
                          <button
                            key={sec.anchor}
                            type="button"
                            onClick={() => scrollToAnchor(sec.anchor)}
                            className={`w-full text-left px-2 py-1 rounded text-[11px] truncate transition ${
                              isSecActive
                                ? "font-bold text-amber-800 bg-amber-100/50"
                                : "text-amber-700/80 hover:text-amber-900 hover:bg-amber-50"
                            }`}
                          >
                            <span className="font-mono text-[10px] mr-1 text-amber-500">§{sec.number}</span>
                            <span>{sec.ruleName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-slate-100 space-y-1">
                <button
                  type="button"
                  onClick={() => scrollToAnchor("source-notes")}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition ${
                    activeAnchor === "source-notes"
                      ? "bg-[#00c9d2]/15 text-[#008f96]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Source Notes & Citations
                </button>
                <button
                  type="button"
                  onClick={() => scrollToAnchor("subject-index")}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition ${
                    activeAnchor === "subject-index"
                      ? "bg-[#00c9d2]/15 text-[#008f96]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Subject & Citation Index
                </button>
              </div>
            </nav>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* MOBILE TABLE OF CONTENTS DRAWER / MODAL                                   */}
        {/* ========================================================================= */}
        {mobileTocOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Table of Contents"
          >
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
                  <BookOpen className="w-4 h-4 text-[#008f96]" />
                  <span>Table of Contents</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTocOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
                {handbook.chapters.map((ch) => (
                  <div key={ch.documentId} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => scrollToAnchor(ch.anchor)}
                      className="w-full text-left font-bold text-slate-800 hover:text-[#008f96]"
                    >
                      Chapter {ch.number}: {ch.title}
                    </button>
                    <div className="pl-3 space-y-1 border-l border-slate-100 ml-1">
                      {ch.currentRules.map((sec) => (
                        <button
                          key={sec.anchor}
                          type="button"
                          onClick={() => scrollToAnchor(sec.anchor)}
                          className="w-full text-left text-slate-600 hover:text-slate-900 truncate block text-[11px]"
                        >
                          §{sec.number} {sec.ruleName}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <button
                    type="button"
                    onClick={() => scrollToAnchor("source-notes")}
                    className="w-full text-left font-semibold text-slate-700 block"
                  >
                    Source Notes & Citations
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor("subject-index")}
                    className="w-full text-left font-semibold text-slate-700 block"
                  >
                    Subject Index
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN HANDBOOK READING EXPERIENCE                                          */}
        {/* ========================================================================= */}
        <article className="lg:col-span-8 space-y-10" aria-label="Handbook Contents">
          {/* Chapter Content Cards */}
          {handbook.chapters.map((ch) => (
            <section
              key={ch.documentId}
              id={ch.anchor}
              className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-8 scroll-mt-24"
              aria-labelledby={`heading-${ch.anchor}`}
            >
              {/* Chapter Header */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#008f96] uppercase tracking-wider">
                    Chapter {ch.number}
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {ch.industry}
                  </span>
                </div>
                <h2 id={`heading-${ch.anchor}`} className="text-xl sm:text-2xl font-extrabold text-[#020618] tracking-tight">
                  {ch.title}
                </h2>
              </div>

              {/* Active / Current Rule Sections */}
              <div className="space-y-6">
                {ch.currentRules.map((sec) => (
                  <div
                    key={sec.anchor}
                    id={sec.anchor}
                    className="p-5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-4 scroll-mt-28"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-[#020618] text-[#00c9d2]">
                          §{sec.number}
                        </span>
                        <h3 className="font-bold text-sm text-[#020618]">
                          {sec.ruleName}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 self-start sm:self-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Current</span>
                        </span>
                        <a
                          href={`#note-${sec.sourceKey}`}
                          onClick={(e) => {
                            e.preventDefault();
                            scrollToAnchor(`note-${sec.sourceKey}`);
                          }}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/60 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                          title="Jump to source note"
                        >
                          [{sec.sourceKey}]
                        </a>
                      </div>
                    </div>

                    {/* Labeled Obligation Blocks */}
                    <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                      {sec.description && (
                        <div>
                          <div className="font-bold text-[11px] uppercase tracking-wider text-slate-400 mb-0.5">
                            Description
                          </div>
                          <p className="bg-white p-3 rounded-lg border border-slate-200/80">
                            {sec.description}
                          </p>
                        </div>
                      )}

                      {sec.requirement && (
                        <div>
                          <div className="font-bold text-[11px] uppercase tracking-wider text-[#008f96] mb-0.5">
                            Requirement & Operational Directive
                          </div>
                          <p className="bg-white p-3 rounded-lg border border-[#00c9d2]/30 font-medium text-slate-900">
                            {sec.requirement}
                          </p>
                        </div>
                      )}

                      {sec.applicability && (
                        <div>
                          <div className="font-bold text-[11px] uppercase tracking-wider text-slate-400 mb-0.5">
                            Scope of Applicability
                          </div>
                          <p className="bg-white p-3 rounded-lg border border-slate-200/80">
                            {sec.applicability}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Metadata Footer */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span>Jurisdiction: <strong>{sec.jurisdiction}</strong></span>
                        {sec.regulator && (
                          <>
                            <span>&bull;</span>
                            <span>Regulator: <strong>{sec.regulator}</strong></span>
                          </>
                        )}
                      </div>
                      {sec.keywords && sec.keywords.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {sec.keywords.map((kw, kwIdx) => (
                            <span
                              key={kwIdx}
                              className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px]"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Review Required Sections (if any) */}
              {ch.reviewRequiredRules.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-amber-200">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span>Review Required Sections</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      The following rules are marked stale, superseded, or past their stated review date. They remain cited for provenance but should not be treated as active obligations without review.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {ch.reviewRequiredRules.map((sec) => (
                      <div
                        key={sec.anchor}
                        id={sec.anchor}
                        className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3 scroll-mt-28"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-amber-200 text-amber-900">
                              §{sec.number}
                            </span>
                            <h4 className="font-bold text-xs text-amber-950">
                              {sec.ruleName}
                            </h4>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            Review Required
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-amber-200/80">
                          {sec.requirement}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}

          {/* ========================================================================= */}
          {/* SOURCE NOTES & CITATIONS                                                  */}
          {/* ========================================================================= */}
          <section
            id="source-notes"
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6 scroll-mt-24"
            aria-labelledby="heading-source-notes"
          >
            <div className="space-y-1 border-b border-slate-100 pb-4">
              <h2 id="heading-source-notes" className="text-xl font-extrabold text-[#020618]">
                Source Notes & Legal Citations
              </h2>
              <p className="text-xs text-slate-500">
                Official regulatory records, formal citations, and source page ranges for all rules in this handbook.
              </p>
            </div>

            <div className="space-y-3">
              {handbook.citations.map((cite) => (
                <div
                  key={cite.sourceKey}
                  id={`note-${cite.sourceKey}`}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs scroll-mt-28"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#008f96] bg-[#00c9d2]/10 px-1.5 py-0.5 rounded border border-[#00c9d2]/20">
                        [{cite.sourceKey}]
                      </span>
                      <strong className="text-slate-900 font-semibold">{cite.documentTitle}</strong>
                    </div>
                    <div className="text-slate-600 font-mono text-[11px]">
                      Citation: {cite.citation}
                    </div>
                    {cite.sourcePages && cite.sourcePages.length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        Page{cite.sourcePages.length === 1 ? "" : "s"}: {cite.sourcePages.join(", ")}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/projects/${projectId}/documents`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#008f96] hover:underline self-end sm:self-center shrink-0"
                  >
                    <span>View Ingested PDF</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SUBJECT & CITATION INDEX                                                  */}
          {/* ========================================================================= */}
          <section
            id="subject-index"
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6 scroll-mt-24"
            aria-labelledby="heading-subject-index"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <h2 id="heading-subject-index" className="text-xl font-extrabold text-[#020618]">
                  Subject & Citation Index
                </h2>
                <p className="text-xs text-slate-500">
                  Alphabetical subject terms and formal regulatory citations with direct section navigators.
                </p>
              </div>

              {/* Index Filter Input */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={indexSearchQuery}
                  onChange={(e) => setIndexSearchQuery(e.target.value)}
                  placeholder="Filter index terms…"
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#00c9d2]"
                />
              </div>
            </div>

            {filteredIndex.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No matching index terms found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {filteredIndex.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-start justify-between gap-2"
                  >
                    <span className="font-medium text-slate-800 truncate" title={entry.term}>
                      {entry.term}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {entry.targets.map((tgt) => (
                        <button
                          key={tgt.anchor}
                          type="button"
                          onClick={() => scrollToAnchor(tgt.anchor)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white border border-slate-200 hover:border-[#00c9d2] hover:text-[#008f96] text-slate-600 transition"
                        >
                          §{tgt.sectionNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
