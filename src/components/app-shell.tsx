"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare,
  FileText,
  Upload,
  Search,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  LogOut,
  Loader2,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  StopCircle,
  RefreshCw,
  FileUp,
  X,
  Compass,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { useSession, signOut } from "@/lib/auth-client";
import { AuthForm } from "@/components/AuthForm";
import { upload } from "@vercel/blob/client";
import type { ComplianceDocumentListItem } from "@/lib/sanity/types";
import type { Citation } from "@/lib/chat/types";

interface AppShellProps {
  initialTab?: "chat" | "documents";
  initialConversationId?: string;
  children?: React.ReactNode;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function AppShell({
  initialTab = "chat",
  initialConversationId,
  children,
}: AppShellProps) {
  const { data: session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<"chat" | "documents">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<ComplianceDocumentListItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Sync tab with route props
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Upload Form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docIndustry, setDocIndustry] = useState("");
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "extracting" | "success" | "error"
  >("idle");
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [uploadSuccessSummary, setUploadSuccessSummary] = useState<{
    title: string;
    extractedCount: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat conversation state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [loadingConversation, setLoadingConversation] = useState(!!initialConversationId);
  const [conversationNotFound, setConversationNotFound] = useState(false);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  const {
    messages,
    sendMessage,
    status,
    error: chatError,
    stop,
    setMessages,
    clearError,
  } = useChat();

  const handleRetry = () => {
    clearError();
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      const text = extractMessageText(lastUserMsg.parts);
      if (text) {
        handleSendPrompt(text);
      }
    }
  };

  const isStreaming = status === "streaming" || status === "submitted";

  // Hydrate conversation on load when initialConversationId is provided
  useEffect(() => {
    if (!initialConversationId) {
      setLoadingConversation(false);
      setConversationNotFound(false);
      return;
    }

    setLoadingConversation(true);
    setConversationNotFound(false);

    fetch(`/api/conversations/${initialConversationId}`)
      .then(async (res) => {
        if (res.status === 404) {
          setConversationNotFound(true);
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load conversation: ${res.statusText}`);
        }
        const data = await res.json();
        setCurrentConversationId(data.conversation.id);

        if (Array.isArray(data.messages)) {
          const hydrated = data.messages.map((m: {
            id: string;
            role: "user" | "assistant";
            content: string;
            citations?: Citation[];
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            parts: [
              { type: "text", text: m.content },
              ...(Array.isArray(m.citations) && m.citations.length > 0
                ? [{ type: "data-citations", data: m.citations }]
                : []),
            ],
          }));
          setMessages(hydrated);
        }
      })
      .catch((err) => {
        console.error("Failed to load conversation:", err);
        setConversationNotFound(true);
      })
      .finally(() => {
        setLoadingConversation(false);
      });
  }, [initialConversationId, setMessages]);

  // Listen to incoming stream data parts to extract conversation ID and update URL seamlessly
  useEffect(() => {
    for (const msg of messages) {
      if (Array.isArray((msg as { parts?: unknown[] }).parts)) {
        for (const part of (msg as { parts: Array<{ type?: string; data?: { conversationId?: string; warning?: string } }> }).parts) {
          if (part && part.type === "data-conversation-id" && part.data?.conversationId) {
            const newId = part.data.conversationId;
            if (newId && newId !== currentConversationId) {
              setCurrentConversationId(newId);
              if (typeof window !== "undefined" && window.location.pathname !== `/chat/${newId}`) {
                window.history.replaceState(null, "", `/chat/${newId}`);
              }
            }
          }
          if (part && part.type === "data-persistence-warning" && part.data?.warning) {
            setPersistenceWarning(part.data.warning);
          }
        }
      }
    }
  }, [messages, currentConversationId]);

  // Fetch document list
  const fetchDocuments = useCallback(() => {
    setLoadingDocs(true);
    setDocsError(null);
    fetch("/api/documents")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load compliance documents");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.documents)) {
          setDocuments(data.documents);
        }
      })
      .catch((err) => {
        console.error("Failed to load documents:", err);
        setDocsError("Could not retrieve documents. Please try refreshing.");
      })
      .finally(() => setLoadingDocs(false));
  }, []);

  useEffect(() => {
    if (activeTab === "documents") {
      fetchDocuments();
    }
  }, [activeTab, fetchDocuments]);

  const handleStartNewSession = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setConversationNotFound(false);
    setPersistenceWarning(null);
    clearError();
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/chat");
    }
  };

  const handleSendPrompt = (textOverride?: string) => {
    const textToSend = (textOverride ?? searchQuery).trim();
    if (!textToSend || isStreaming) return;
    setPersistenceWarning(null);
    clearError();

    const clientMsgId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    sendMessage(
      { text: textToSend },
      {
        body: {
          conversationId: currentConversationId || undefined,
          clientMessageId: clientMsgId,
        },
      }
    );
    setSearchQuery("");
  };

  const extractMessageText = (parts?: Array<any>): string => {
    if (!parts) return "";
    return parts
      .filter((p) => p && p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
  };

  const extractMessageCitations = (parts?: Array<any>): Citation[] => {
    if (!parts) return [];
    const citations: Citation[] = [];
    for (const part of parts) {
      if (part && part.type === "data-citations" && Array.isArray(part.data)) {
        citations.push(...part.data);
      }
    }
    return citations;
  };

  // Determine current tool activity state label for polite live announcements
  const getToolActivityLabel = (): string => {
    if (status === "submitted") return "Checking reviewed rules…";
    if (status === "streaming") {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && Array.isArray((lastMsg as any).parts)) {
        for (const p of (lastMsg as any).parts) {
          if (p?.type === "tool-invocation" || p?.type === "tool-call") {
            const name = p.toolInvocation?.toolName || p.toolName || "";
            if (name.includes("web") || name.includes("firecrawl")) {
              return "Checking regulatory sources…";
            }
            if (name.includes("rule") || name.includes("sanity")) {
              return "Checking reviewed rules…";
            }
          }
        }
      }
      return "Synthesizing compliance guidance…";
    }
    return "";
  };

  // Safe file selection handler
  const handleSelectFile = (file: File | null) => {
    setUploadErrorMsg(null);
    setUploadSuccessSummary(null);

    if (!file) {
      setUploadFile(null);
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadErrorMsg("Invalid file type. Only PDF documents are supported.");
      return;
    }

    const maxBytes = 10 * 1024 * 1024; // 10 MB limit
    if (file.size > maxBytes) {
      setUploadErrorMsg(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed 10 MB limit.`
      );
      return;
    }

    setUploadFile(file);
    if (!docTitle.trim()) {
      const rawName = file.name.replace(/\.[^/.]+$/, "");
      setDocTitle(rawName);
    }
  };

  // Execute upload and rule extraction
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadErrorMsg("Please choose a PDF document to upload.");
      return;
    }
    if (!docTitle.trim()) {
      setUploadErrorMsg("Document title is required.");
      return;
    }
    if (!docIndustry.trim()) {
      setUploadErrorMsg("Industry classification is required.");
      return;
    }

    setUploadErrorMsg(null);
    setUploadSuccessSummary(null);
    setUploadStatus("uploading");

    try {
      // Step 1: Upload to private Vercel Blob staging via client upload handler
      const blob = await upload(uploadFile.name, uploadFile, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });

      // Step 2: Trigger ingestion and Gemini rule extraction
      setUploadStatus("extracting");
      const ingestRes = await fetch("/api/documents/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: blob.url,
          title: docTitle.trim(),
          industry: docIndustry.trim(),
        }),
      });

      if (!ingestRes.ok) {
        const errJson = await ingestRes.json().catch(() => ({}));
        throw new Error(
          errJson.error?.message || errJson.message || `Ingestion failed (${ingestRes.status})`
        );
      }

      const result = await ingestRes.json();
      setUploadStatus("success");
      setUploadSuccessSummary({
        title: result.document?.title || docTitle,
        extractedCount: result.document?.extractedRuleCount ?? result.drafts?.length ?? 0,
      });

      // Reset form
      setUploadFile(null);
      setDocTitle("");
      setDocIndustry("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh document list
      fetchDocuments();
    } catch (err: any) {
      console.error("Upload/ingestion failed:", err);
      setUploadStatus("error");
      setUploadErrorMsg(
        err.message || "An unexpected error occurred during document processing. Please retry."
      );
    }
  };

  // Classify chat error for specific retry guidance
  const getCategorizedChatError = (err: Error) => {
    const msg = err.message || "";
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      return {
        type: "rate-limit",
        title: "Rate Limit Exceeded",
        description: "You have reached the temporary research query limit. Please wait a moment before trying again.",
      };
    }
    if (msg.toLowerCase().includes("database") || msg.toLowerCase().includes("sanity") || msg.toLowerCase().includes("retrieval")) {
      return {
        type: "retrieval",
        title: "Rule Retrieval Unavailable",
        description: "Unable to query the compliance rule repository. Please verify your connection or try again.",
      };
    }
    if (msg.toLowerCase().includes("persistence") || msg.toLowerCase().includes("storage")) {
      return {
        type: "persistence",
        title: "Conversation Persistence Error",
        description: "Your research response was received, but could not be saved to your session history.",
      };
    }
    return {
      type: "generation",
      title: "Generation Failure",
      description: "Failed to generate compliance analysis for this query. Please rephrase or retry.",
    };
  };

  // Auth gate loading
  if (isPending) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#00c9d2]" />
          <span className="text-sm font-medium text-slate-700">Loading workspace…</span>
        </div>
      </div>
    );
  }

  // Auth gate: Unauthenticated users see AuthForm
  if (!session) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex w-12 h-12 rounded-xl bg-[#020618] items-center justify-center text-[#00c9d2] shadow-sm mb-4 text-xl font-bold tracking-tight border border-slate-800">
            V
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#020618]">
            Veyd
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to access your regulatory compliance workspace.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <AuthForm />
        </div>
      </div>
    );
  }

  const userInitial = (session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase();
  const displayName = session.user.name || session.user.email.split("@")[0];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#020618] flex flex-col font-sans">
      {/* Persistent Application Header */}
      <header className="border-b border-slate-200/80 bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link
              href="/chat"
              onClick={() => {
                if (activeTab === "chat" && messages.length > 0) {
                  handleStartNewSession();
                }
              }}
              className="flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[#00c9d2] rounded-lg p-0.5"
              aria-label="Veyd Compliance Home"
            >
              <div className="w-8 h-8 rounded-lg bg-[#020618] flex items-center justify-center text-[#00c9d2] shadow-xs font-bold text-sm tracking-wider border border-slate-800">
                V
              </div>
              <span className="font-bold text-lg tracking-tight text-[#020618]">
                Veyd
              </span>
            </Link>

            {/* Link-backed Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-sm" aria-label="Main Navigation">
              <Link
                href="/chat"
                aria-current={activeTab === "chat" ? "page" : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[#00c9d2] ${
                  activeTab === "chat"
                    ? "bg-white text-[#020618] shadow-xs font-semibold"
                    : "text-slate-600 hover:text-[#020618]"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </Link>
              <Link
                href="/documents"
                aria-current={activeTab === "documents" ? "page" : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[#00c9d2] ${
                  activeTab === "documents"
                    ? "bg-white text-[#020618] shadow-xs font-semibold"
                    : "text-slate-600 hover:text-[#020618]"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Documents</span>
              </Link>
            </nav>
          </div>

          {/* User Profile & Sign-out */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-full border border-slate-200"
              title={`Signed in as ${session.user.email}`}
            >
              <div className="w-5 h-5 rounded-full bg-[#020618] text-[#00c9d2] flex items-center justify-center font-bold text-[10px]">
                {userInitial}
              </div>
              <span className="max-w-[120px] sm:max-w-[180px] truncate font-medium">
                {displayName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              aria-label="Sign out of Veyd"
              className="p-2 text-slate-400 hover:text-[#020618] rounded-lg hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children ? (
          children
        ) : activeTab === "chat" ? (
          /* ========================================================================= */
          /* CHAT VIEW                                                                */
          /* ========================================================================= */
          <div className="max-w-3xl mx-auto space-y-6">
            {loadingConversation ? (
              <div
                className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500"
                aria-live="polite"
              >
                <Loader2 className="w-6 h-6 animate-spin text-[#00c9d2]" />
                <span className="text-sm font-medium text-slate-700">Restoring conversation…</span>
              </div>
            ) : conversationNotFound ? (
              <div
                className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto"
                role="alert"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <AlertCircle className="w-6 h-6 text-slate-500" />
                </div>
                <h2 className="text-lg font-bold text-[#020618] mb-1">Conversation Not Found</h2>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  This conversation link does not exist or you do not have permission to view it.
                </p>
                <button
                  type="button"
                  onClick={handleStartNewSession}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#020618] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-xs focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start New Session</span>
                </button>
              </div>
            ) : messages.length === 0 ? (
              /* EMPTY STATE: Hero, prompt input, quick starters, workflow info */
              <div className="mt-8 sm:mt-12 space-y-8">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00c9d2]/10 border border-[#00c9d2]/30 text-[#020618] text-xs font-semibold mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#00c9d2]" />
                    <span>Regulatory Research Copilot</span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#020618]">
                    What would you like to research today?
                  </h1>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Ask questions across internal reviewed rules, industry standards, and live regulatory guidance.
                  </p>
                </div>

                {/* Primary Prompt Composer Box */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 focus-within:ring-2 focus-within:ring-[#00c9d2] focus-within:border-transparent transition-all">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendPrompt();
                    }}
                    className="flex items-center gap-2"
                  >
                    <div className="pl-3 text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                    <label htmlFor="hero-prompt-input" className="sr-only">
                      Compliance research query
                    </label>
                    <input
                      id="hero-prompt-input"
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ask a compliance question or search regulations…"
                      className="flex-1 py-3 text-sm bg-transparent outline-none placeholder:text-slate-400 text-[#020618]"
                    />
                    <button
                      type="submit"
                      disabled={!searchQuery.trim() || isStreaming}
                      aria-label="Send compliance query"
                      className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#00c9d2] text-[#020618] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00b0b8] transition-colors shadow-xs focus-visible:ring-2 focus-visible:ring-[#020618]"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Suggestions Starter Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Suggestions:</span>
                  {[
                    "FDA allergen labeling rules",
                    "HIPAA data retention periods",
                    "AML / KYC customer audit requirements",
                    "OSHA workplace hazard communication",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSendPrompt(suggestion)}
                      className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-[#020618] hover:border-slate-400 transition-colors shadow-2xs font-medium focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* Sanity-first research workflow explanation cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h2 className="font-semibold text-sm text-[#020618]">Reviewed Rules First</h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Queries first retrieve internal handbook rules verified by operators in Sanity Studio.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200/70 flex items-center justify-center text-sky-700">
                      <Compass className="w-4 h-4" />
                    </div>
                    <h2 className="font-semibold text-sm text-[#020618]">Transparent Fallback</h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      If internal rules lack coverage, live web research guides you with source-authority badges.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-700">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h2 className="font-semibold text-sm text-[#020618]">Audit Citations</h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Every statement links to primary rules, page citations, or official regulatory registers.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* ACTIVE CONVERSATION THREAD */
              <div className="space-y-6">
                {/* Active Session Header Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00c9d2]" />
                    <span className="font-semibold text-sm text-[#020618]">
                      Compliance Research Session
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartNewSession}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 hover:text-[#020618] hover:bg-slate-100 rounded-md transition font-medium focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
                    aria-label="Start a new chat session"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>New Session</span>
                  </button>
                </div>

                {/* Message List Live Region */}
                <div className="space-y-4" aria-live="polite" aria-atomic="false">
                  {messages.map((msg, idx) => {
                    const text = extractMessageText(msg.parts);
                    const citations = extractMessageCitations(msg.parts);
                    const hasSecondary = citations.some((c) => c.sourceKind === "secondary-web");

                    if (msg.role === "user") {
                      return (
                        <div key={msg.id || idx} className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl bg-[#020618] text-white px-4 py-3 text-sm shadow-xs leading-relaxed font-normal">
                            {text}
                          </div>
                        </div>
                      );
                    }

                    // Assistant Turn
                    return (
                      <div key={msg.id || idx} className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#020618] text-[#00c9d2] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs border border-slate-800">
                          V
                        </div>
                        <div className="flex-1 space-y-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                          {/* Response Text */}
                          <div className="text-sm text-[#020618] leading-relaxed whitespace-pre-wrap font-normal">
                            {text}
                          </div>

                          {/* Citations Box */}
                          {citations.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                  Verified Sources & Citations
                                </span>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {citations.length} reference{citations.length > 1 ? "s" : ""}
                                </span>
                              </div>

                              {/* Secondary Web Warning Callout */}
                              {hasSecondary && (
                                <div
                                  className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2"
                                  role="note"
                                >
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-amber-900">
                                      Secondary Source Advisory
                                    </span>
                                    <p className="text-amber-800 text-[11px] leading-relaxed">
                                      This answer references secondary web materials not yet formally verified in your internal rule repository. Verify independently before relying on it for audit compliance.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Citation Cards */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {citations.map((c, cIdx) => (
                                  <div
                                    key={cIdx}
                                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-1.5 text-xs hover:border-slate-300 transition"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      {c.sourceKind === "sanity" ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                          <span>Verified Rule</span>
                                        </span>
                                      ) : c.sourceKind === "official-web" ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                          <ExternalLink className="w-3 h-3 text-sky-600" />
                                          <span>Official Regulation</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                                          <span>Secondary Web</span>
                                        </span>
                                      )}

                                      {c.url && (
                                        <a
                                          href={c.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-slate-400 hover:text-[#020618] transition focus-visible:ring-2 focus-visible:ring-[#00c9d2] rounded p-0.5"
                                          aria-label={`Open citation source: ${c.title}`}
                                          title="Open reference source link"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </div>

                                    <div className="font-semibold text-[#020618] line-clamp-1" title={c.title}>
                                      {c.title}
                                    </div>

                                    {c.citation && (
                                      <div className="text-[11px] text-slate-500 font-mono line-clamp-1">
                                        {c.citation}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Streaming & Tool Activity Indicator */}
                  {isStreaming && (
                    <div
                      className="flex items-center gap-2.5 text-xs text-slate-600 pl-11 py-2"
                      aria-live="polite"
                    >
                      <Loader2 className="w-4 h-4 animate-spin text-[#00c9d2]" />
                      <span className="font-medium">{getToolActivityLabel()}</span>
                      <button
                        type="button"
                        onClick={() => stop()}
                        className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-semibold ml-2 focus-visible:ring-2 focus-visible:ring-rose-500 rounded px-1"
                        aria-label="Stop generating response"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>Stop</span>
                      </button>
                    </div>
                  )}

                  {/* Categorized Failure Alert */}
                  {chatError && (
                    <div
                      className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2"
                      role="alert"
                      aria-live="assertive"
                    >
                      {(() => {
                        const categorized = getCategorizedChatError(chatError);
                        return (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="font-bold text-rose-900">
                                  {categorized.title}
                                </span>
                                <p className="text-rose-700 leading-relaxed">
                                  {categorized.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRetry()}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-rose-100 text-rose-800 rounded border border-rose-200 text-[11px] font-semibold transition"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Retry</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => clearError()}
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 p-1"
                                aria-label="Dismiss error"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Persistence Warning Alert */}
                  {persistenceWarning && (
                    <div
                      className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between"
                      role="alert"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{persistenceWarning}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPersistenceWarning(null)}
                        className="text-[11px] font-semibold text-amber-800 hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>

                {/* Follow-up Prompt Input Bar */}
                <div className="sticky bottom-4 pt-2">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-2 focus-within:ring-2 focus-within:ring-[#00c9d2] focus-within:border-transparent transition-all">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendPrompt();
                      }}
                      className="flex items-center gap-2"
                    >
                      <label htmlFor="followup-prompt-input" className="sr-only">
                        Follow-up compliance query
                      </label>
                      <input
                        id="followup-prompt-input"
                        type="text"
                        value={searchQuery}
                        disabled={isStreaming}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Ask a follow-up or research another regulation…"
                        className="flex-1 py-2 pl-3 text-sm bg-transparent outline-none placeholder:text-slate-400 text-[#020618] disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!searchQuery.trim() || isStreaming}
                        aria-label="Send follow-up query"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#00c9d2] text-[#020618] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00b0b8] transition-colors shadow-xs focus-visible:ring-2 focus-visible:ring-[#020618]"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* DOCUMENTS VIEW                                                           */
          /* ========================================================================= */
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#020618]">
                  Compliance Documents
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Upload regulatory policy PDFs and monitor Gemini rule extraction into review drafts.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchDocuments}
                disabled={loadingDocs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
                aria-label="Refresh documents list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? "animate-spin text-[#00c9d2]" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Interactive Upload Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-[#020618] flex items-center gap-2">
                    <FileUp className="w-4 h-4 text-[#00c9d2]" />
                    <span>Upload Regulatory PDF</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Max 10 MB &bull; Up to 100 pages &bull; PDF format only
                  </p>
                </div>
              </div>

              {/* Drag and Drop Zone / File Picker */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) handleSelectFile(droppedFile);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? "border-[#00c9d2] bg-[#00c9d2]/5"
                    : uploadFile
                    ? "border-emerald-300 bg-emerald-50/20"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="pdf-file-picker"
                  aria-label="Select PDF file"
                />

                {uploadFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-[#020618]">{uploadFile.name}</span>
                      <span className="text-slate-500 ml-2 font-mono">
                        ({formatBytes(uploadFile.size)})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Click to choose a different PDF
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#020618]">
                        Click to select a file
                      </span>
                      <span className="text-xs text-slate-500"> or drag and drop your PDF here</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Strictly enforced: PDF only, up to 100 pages, under 10 MB
                    </span>
                  </div>
                )}
              </div>

              {/* Form Metadata Inputs */}
              <form onSubmit={handleUploadSubmit} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="doc-title-input" className="block text-xs font-semibold text-[#020618]">
                      Document Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="doc-title-input"
                      type="text"
                      required
                      maxLength={200}
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="e.g. 21 CFR Part 11 Electronic Records"
                      disabled={uploadStatus === "uploading" || uploadStatus === "extracting"}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00c9d2]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="doc-industry-input" className="block text-xs font-semibold text-[#020618]">
                      Industry / Sector <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="doc-industry-input"
                      type="text"
                      required
                      maxLength={100}
                      value={docIndustry}
                      onChange={(e) => setDocIndustry(e.target.value)}
                      placeholder="e.g. Healthcare, Financial Services, Food & Drug"
                      disabled={uploadStatus === "uploading" || uploadStatus === "extracting"}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00c9d2]"
                    />
                  </div>
                </div>

                {/* Progress / Success / Error feedback */}
                {uploadStatus === "uploading" && (
                  <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center gap-2" aria-live="polite">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Uploading PDF to secure private staging…</span>
                  </div>
                )}

                {uploadStatus === "extracting" && (
                  <div className="p-3 rounded-lg bg-[#00c9d2]/10 border border-[#00c9d2]/30 text-[#020618] text-xs flex items-center gap-2" aria-live="polite">
                    <Loader2 className="w-4 h-4 animate-spin text-[#00c9d2]" />
                    <span>Extracting compliance rules with Gemini AI and generating review drafts…</span>
                  </div>
                )}

                {uploadStatus === "success" && uploadSuccessSummary && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between" role="status">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Successfully processed <strong>{uploadSuccessSummary.title}</strong>! Extracted{" "}
                        <strong>{uploadSuccessSummary.extractedCount}</strong> rule draft{uploadSuccessSummary.extractedCount === 1 ? "" : "s"} ready for review in Sanity Studio.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadSuccessSummary(null)}
                      className="text-emerald-700 hover:text-emerald-900 text-[11px] font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {uploadErrorMsg && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between" role="alert">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{uploadErrorMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadErrorMsg(null)}
                      className="text-rose-700 hover:text-rose-900 text-[11px] font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={
                      !uploadFile ||
                      !docTitle.trim() ||
                      !docIndustry.trim() ||
                      uploadStatus === "uploading" ||
                      uploadStatus === "extracting"
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#020618] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition shadow-xs focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
                  >
                    {uploadStatus === "uploading" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading…</span>
                      </>
                    ) : uploadStatus === "extracting" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting Rules…</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Ingest & Extract Rules</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Document Listing */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#020618]">
                  Repository Documents ({documents.length})
                </h2>
              </div>

              {docsError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between" role="alert">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>{docsError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchDocuments}
                    className="text-[11px] font-semibold underline text-rose-700"
                  >
                    Retry
                  </button>
                </div>
              )}

              {loadingDocs ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400" aria-live="polite">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00c9d2] mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Loading compliance documents…</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-600" />
                  <p className="text-sm font-semibold text-[#020618]">No documents uploaded yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Upload your first regulatory PDF using the form above to trigger rule extraction and create review drafts.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const isReady = doc.processingStatus === "ready";
                    const isProcessing = doc.processingStatus === "processing";
                    const isFailed = doc.processingStatus === "failed";

                    return (
                      <div
                        key={doc._id}
                        className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-[#020618] truncate">
                              {doc.title}
                            </h3>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                              {doc.industry}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px]">{doc.originalFileName}</span>
                            <span>&bull;</span>
                            <span>{formatBytes(doc.fileSizeBytes)}</span>
                            <span>&bull;</span>
                            <span>{doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}</span>
                            <span>&bull;</span>
                            <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                          </div>

                          {/* Failure description if processing failed */}
                          {isFailed && doc.failureMessage && (
                            <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>{doc.failureMessage}</span>
                            </div>
                          )}
                        </div>

                        {/* Status Badges & Action Links */}
                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0 flex-wrap">
                          {/* Processing Badge */}
                          <div
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              isReady
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : isProcessing
                                ? "bg-sky-50 text-sky-800 border-sky-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            {isReady ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            )}
                            <span className="capitalize">{doc.processingStatus}</span>
                          </div>

                          {/* Distinct Rule Counts: Extracted vs Published */}
                          <div className="flex items-center gap-1.5 text-xs">
                            <span
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200"
                              title="Total rules extracted from PDF"
                            >
                              {doc.extractedRuleCount ?? 0} extracted
                            </span>
                            <span
                              className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200"
                              title="Rules verified and published in Sanity Studio"
                            >
                              {doc.publishedRuleCount ?? 0} published
                            </span>
                          </div>

                          {/* Durable PDF link if available */}
                          {doc.fileUrl && (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View durable PDF for ${doc.title}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-[#020618] hover:bg-slate-100 rounded-md transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
                              title="Open original PDF in new tab"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>PDF</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          )}

                          {/* Operator link to Sanity Studio */}
                          <a
                            href="http://localhost:3333"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Review ${doc.title} in Sanity Studio`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#020618] bg-[#00c9d2]/15 hover:bg-[#00c9d2]/25 border border-[#00c9d2]/30 rounded-md transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
                            title="Open Sanity Studio to review drafts and publish rules"
                          >
                            <span>Review in Studio</span>
                            <ExternalLink className="w-3 h-3 text-[#00c9d2]" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Veyd &bull; Regulatory Intelligence Platform &bull; Sanity Content Lake
      </footer>
    </div>
  );
}
