"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  FileText,
  Upload,
  Search,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  LogOut,
  User as UserIcon,
  Loader2,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  StopCircle,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { useSession, signOut } from "@/lib/auth-client";
import { AuthForm } from "@/components/AuthForm";
import { formatDocumentRuleStatus } from "@/lib/documents";
import type { ComplianceDocumentListItem } from "@/lib/sanity/types";
import type { Citation } from "@/lib/chat/types";

interface AppShellProps {
  initialConversationId?: string;
  children?: React.ReactNode;
}

export function AppShell({ initialConversationId, children }: AppShellProps) {
  const { data: session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<"chat" | "documents">("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<ComplianceDocumentListItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

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

  useEffect(() => {
    if (activeTab === "documents") {
      setLoadingDocs(true);
      fetch("/api/documents")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.documents)) {
            setDocuments(data.documents);
          }
        })
        .catch((err) => console.error("Failed to load documents:", err))
        .finally(() => setLoadingDocs(false));
    }
  }, [activeTab]);

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

  // Loading state
  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <span className="text-sm font-medium">Loading Veyd…</span>
        </div>
      </div>
    );
  }

  // Auth gate: If user is not authenticated, show sign-in/registration screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex w-12 h-12 rounded-xl bg-teal-600 items-center justify-center text-white shadow-md mb-4 text-xl font-bold tracking-tight">
            V
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Veyd
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to access your regulatory intelligence workspace.
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

  // Authenticated application shell
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top persistent header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <button
              type="button"
              onClick={handleStartNewSession}
              className="flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm font-bold text-sm tracking-wider">
                V
              </div>
              <span className="font-bold text-lg tracking-tight text-slate-900">
                Veyd
              </span>
            </button>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-sm">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                  activeTab === "chat"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                  activeTab === "documents"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Documents</span>
              </button>
            </nav>
          </div>

          {/* User profile & Sign-out */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-100/80 px-2.5 py-1.5 rounded-full border border-slate-200/60">
              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold text-[10px]">
                {userInitial}
              </div>
              <span className="max-w-[130px] truncate font-medium" title={session.user.email}>
                {displayName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main workspace container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children ? (
          children
        ) : activeTab === "chat" ? (
          /* Chat & Research View */
          <div className="max-w-3xl mx-auto space-y-6">
            {loadingConversation ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                <span className="text-sm font-medium">Restoring conversation…</span>
              </div>
            ) : conversationNotFound ? (
              <div className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <AlertCircle className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Conversation Not Found</h3>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                  This conversation record does not exist or you do not have permission to view it.
                </p>
                <button
                  type="button"
                  onClick={handleStartNewSession}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start New Session</span>
                </button>
              </div>
            ) : messages.length === 0 ? (
              /* Zero State: Greeting, input, suggestions, cards */
              <div className="mt-8 sm:mt-12 space-y-8">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-xs font-medium mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Regulatory Intelligence</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    What would you like to research?
                  </h1>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Ask questions across compliance standards, industry regulations, and policy documents.
                  </p>
                </div>

                {/* Primary Search / Prompt Input */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
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
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ask a compliance question or search regulations..."
                      className="flex-1 py-2.5 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={!searchQuery.trim() || isStreaming}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-700 transition-colors shadow-sm"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Quick Starter Chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-slate-400">Suggestions:</span>
                  {[
                    "FDA allergen labeling rules",
                    "HIPAA data retention periods",
                    "AML / KYC audit requirements",
                    "OSHA workplace safety standards",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSendPrompt(suggestion)}
                      className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-2xs"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* Feature Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
                  <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900">Cited Research</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Answers backed by published regulations and direct official citations.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900">Industry Handbooks</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Structured onboarding handbooks organized by industry chapters.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900">Rule Checklists</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Actionable compliance verification checklists to audit operations.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Active Conversation View */
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    <span className="font-semibold text-sm text-slate-900">Compliance Research Session</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartNewSession}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>New Session</span>
                  </button>
                </div>

                {/* Messages Thread */}
                <div className="space-y-4">
                  {messages.map((msg, idx) => {
                    const text = extractMessageText(msg.parts);
                    const citations = extractMessageCitations(msg.parts);
                    const hasSecondary = citations.some((c) => c.sourceKind === "secondary-web");

                    if (msg.role === "user") {
                      return (
                        <div key={msg.id || idx} className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl bg-teal-600 text-white px-4 py-3 text-sm shadow-sm leading-relaxed">
                            {text}
                          </div>
                        </div>
                      );
                    }

                    // Assistant response
                    return (
                      <div key={msg.id || idx} className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                          V
                        </div>
                        <div className="flex-1 space-y-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                          {/* Response Text */}
                          <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {text}
                          </div>

                          {/* Citations Box */}
                          {citations.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                  Verified Sources & Citations
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {citations.length} reference{citations.length > 1 ? "s" : ""}
                                </span>
                              </div>

                              {/* Secondary Web Warning Callout */}
                              {hasSecondary && (
                                <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <span className="font-semibold text-amber-800">
                                      Lower-Authority Source Warning
                                    </span>
                                    <p className="text-amber-700 text-[11px] leading-relaxed">
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
                                    className="p-2.5 rounded-lg border border-slate-200/90 bg-slate-50/50 flex flex-col justify-between gap-1.5 text-xs hover:border-slate-300 transition"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      {c.sourceKind === "sanity" ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                          <span>Verified Rule</span>
                                        </span>
                                      ) : c.sourceKind === "official-web" ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
                                          <ExternalLink className="w-3 h-3 text-blue-600" />
                                          <span>Official Regulation</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70">
                                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                                          <span>Secondary Web</span>
                                        </span>
                                      )}

                                      {c.url && (
                                        <a
                                          href={c.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-slate-400 hover:text-teal-600 transition"
                                          title="Open reference link"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </div>

                                    <div className="font-medium text-slate-900 line-clamp-1" title={c.title}>
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

                  {/* Streaming indicator */}
                  {isStreaming && (
                    <div className="flex items-center gap-2.5 text-xs text-slate-500 pl-11 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                      <span>Consulting compliance repository & streaming response…</span>
                      <button
                        type="button"
                        onClick={() => stop()}
                        className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium ml-2"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>Stop</span>
                      </button>
                    </div>
                  )}

                  {/* Chat Error alert */}
                  {chatError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{chatError.message || "Failed to complete research request."}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => clearError()}
                        className="text-[11px] font-semibold text-red-700 hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Persistence Warning alert */}
                  {persistenceWarning && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{persistenceWarning}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPersistenceWarning(null)}
                        className="text-[11px] font-semibold text-amber-700 hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>

                {/* Follow-up input form */}
                <div className="sticky bottom-4 pt-2">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-2 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendPrompt();
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Ask a follow-up or research another regulation..."
                        className="flex-1 py-2 pl-3 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={!searchQuery.trim() || isStreaming}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-700 transition-colors shadow-sm"
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
          /* Documents & Ingestion View */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Documents</h2>
                <p className="text-xs text-slate-500">
                  Manage regulatory documents and ingest policy PDFs.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload PDF</span>
              </button>
            </div>

            {/* Upload Dropzone */}
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-white hover:border-teal-500/50 hover:bg-teal-50/20 transition cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mx-auto mb-3">
                <Upload className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Upload regulatory PDF
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Drag and drop your compliance manual or policy PDF here to extract rule sets automatically.
              </p>
            </div>

            {/* Document List */}
            {loadingDocs ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Loading compliance documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium text-slate-600">No documents uploaded yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Uploaded documents and extracted compliance rules will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const status = formatDocumentRuleStatus(doc);
                  const isReady = doc.processingStatus === "ready";
                  const isFailed = doc.processingStatus === "failed";

                  return (
                    <div
                      key={doc._id}
                      className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-slate-900 truncate">
                            {doc.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200/60">
                            {doc.industry}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-2">
                          <span>{doc.originalFileName}</span>
                          <span>&bull;</span>
                          <span>{doc.pageCount} pages</span>
                          <span>&bull;</span>
                          <span>
                            Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        {/* Distinct Rule Status Badge */}
                        <div
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                            status.variant === "published"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : status.variant === "drafts"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : status.variant === "failed"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                          title={status.subtext}
                        >
                          {status.variant === "published" ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : status.variant === "drafts" ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : status.variant === "failed" ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                          <span>{status.label}</span>
                        </div>

                        {/* Review in Sanity Studio link */}
                        <a
                          href="http://localhost:3333"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="Open in Sanity Studio to review drafts"
                        >
                          <span>Review</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Subtle minimal footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Veyd &bull; Regulatory Intelligence
      </footer>
    </div>
  );
}
