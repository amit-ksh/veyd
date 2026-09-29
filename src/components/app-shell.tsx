"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Folder,
  FolderPlus,
  Key,
  ChevronDown,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { useSession, signOut } from "@/lib/auth-client";
import { AuthForm } from "@/components/AuthForm";
import { AddProjectModal } from "@/components/add-project-modal";
import { ProjectMcpModal } from "@/components/project-mcp-modal";
import { RemoveDocumentModal } from "@/components/remove-document-modal";
import { upload } from "@vercel/blob/client";
import type { ComplianceDocumentListItem } from "@/lib/sanity/types";
import type { Citation, PresentedCitation } from "@/lib/chat/types";

interface ProjectItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface AppShellProps {
  initialTab?: "chat" | "documents";
  initialProjectId?: string;
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
  initialProjectId,
  initialConversationId,
  children,
}: AppShellProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<"chat" | "documents">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<ComplianceDocumentListItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [documentToRemove, setDocumentToRemove] = useState<ComplianceDocumentListItem | null>(null);
  const [removalSuccessMessage, setRemovalSuccessMessage] = useState<string | null>(null);

  // Projects state
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId || null);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync tab with route props
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Sync project with route props
  useEffect(() => {
    if (initialProjectId) {
      setActiveProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Fetch projects owned by authenticated user
  const fetchProjects = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const list: ProjectItem[] = data.data?.projects || data.projects || [];
        setProjects(list);

        if (!activeProjectId && list.length > 0) {
          const defaultProject = initialProjectId
            ? list.find((p) => p.id === initialProjectId) || list[0]
            : list[0];
          setActiveProjectId(defaultProject.id);
        }
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  }, [session?.user?.id, activeProjectId, initialProjectId]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProjects();
    }
  }, [session?.user?.id, fetchProjects]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || (projects.length > 0 ? projects[0] : null);
  const currentProjectId = activeProject?.id || activeProjectId || "";

  // Switch project handler
  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setProjectDropdownOpen(false);
    router.push(`/projects/${projectId}/${activeTab}`);
  };

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
        for (const part of (msg as { parts: Array<{ type?: string; data?: { conversationId?: string; projectId?: string; warning?: string } }> }).parts) {
          if (part && part.type === "data-conversation-id" && part.data?.conversationId) {
            const newId = part.data.conversationId;
            const projId = part.data.projectId || currentProjectId;
            if (newId && newId !== currentConversationId) {
              setCurrentConversationId(newId);
              if (typeof window !== "undefined" && window.location.pathname !== `/projects/${projId}/chat/${newId}`) {
                window.history.replaceState(null, "", `/projects/${projId}/chat/${newId}`);
              }
            }
          }
          if (part && part.type === "data-persistence-warning" && part.data?.warning) {
            setPersistenceWarning(part.data.warning);
          }
        }
      }
    }
  }, [messages, currentConversationId, currentProjectId]);

  // Fetch document list scoped to current project
  const fetchDocuments = useCallback(() => {
    if (!currentProjectId) {
      setDocuments([]);
      return;
    }
    setLoadingDocs(true);
    setDocsError(null);
    fetch(`/api/documents?projectId=${encodeURIComponent(currentProjectId)}`)
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
  }, [currentProjectId]);

  useEffect(() => {
    if (activeTab === "documents" && currentProjectId) {
      fetchDocuments();
    }
  }, [activeTab, currentProjectId, fetchDocuments]);

  const handleStartNewSession = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setConversationNotFound(false);
    setPersistenceWarning(null);
    clearError();
    if (typeof window !== "undefined") {
      const targetUrl = currentProjectId ? `/projects/${currentProjectId}/chat` : "/chat";
      window.history.pushState(null, "", targetUrl);
    }
  };

  const handleSendPrompt = (textOverride?: string) => {
    const textToSend = (textOverride ?? searchQuery).trim();
    if (!textToSend || isStreaming) return;
    if (!currentProjectId) {
      setShowAddProjectModal(true);
      return;
    }

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
          projectId: currentProjectId,
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

  const extractMessageCitations = (parts?: Array<any>): PresentedCitation[] => {
    if (!parts) return [];
    const citations: PresentedCitation[] = [];
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

  // Execute upload and rule extraction scoped to current project
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectId) {
      setUploadErrorMsg("Please select or create a project before uploading documents.");
      return;
    }
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

      // Step 2: Trigger ingestion and Gemini rule extraction bound to active project
      setUploadStatus("extracting");
      const ingestRes = await fetch("/api/documents/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: blob.url,
          projectId: currentProjectId,
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

  // No projects screen state (Prompt to create first project)
  if (!loadingProjects && projects.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
        <header className="border-b border-slate-200 bg-white h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#020618] flex items-center justify-center text-[#00c9d2] font-bold text-sm border border-slate-800">
              V
            </div>
            <span className="font-bold text-lg text-[#020618]">Veyd</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">{displayName}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="p-1.5 text-slate-400 hover:text-slate-800"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-[#00c9d2]/15 text-[#008f96] flex items-center justify-center mx-auto">
              <FolderPlus className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#020618]">Create Your First Project</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Veyd projects isolate regulatory documents, extracted rules, chat history, and MCP tools into distinct domains (such as <strong>Food Safety</strong> or <strong>Civil Infrastructure</strong>).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddProjectModal(true)}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#020618] hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Project</span>
            </button>
          </div>
        </main>

        <AddProjectModal
          isOpen={showAddProjectModal}
          onClose={() => setShowAddProjectModal(false)}
          onProjectCreated={(newProj) => {
            fetchProjects();
            setActiveProjectId(newProj.id);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#020618] flex flex-col md:flex-row font-sans">
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR                                                           */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-slate-200/90 flex-col justify-between min-h-screen p-4 sticky top-0 h-screen overflow-y-auto z-30">
        <div className="space-y-6">
          {/* Logo */}
          <Link
            href={currentProjectId ? `/projects/${currentProjectId}/chat` : "/chat"}
            onClick={() => {
              if (activeTab === "chat" && messages.length > 0) {
                handleStartNewSession();
              }
            }}
            className="flex items-center gap-2.5 px-2 hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[#00c9d2] rounded-lg"
            aria-label="Veyd Compliance Home"
          >
            <div className="w-8 h-8 rounded-lg bg-[#020618] flex items-center justify-center text-[#00c9d2] shadow-xs font-bold text-sm tracking-wider border border-slate-800">
              V
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-[#020618]">
                Veyd
              </span>
              <span className="text-[10px] text-slate-500 font-medium -mt-0.5">
                Regulatory Platform
              </span>
            </div>
          </Link>

          {/* Project Switcher Section */}
          <div className="space-y-1.5" ref={dropdownRef}>
            <div className="flex items-center justify-between px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Project</span>
              <button
                type="button"
                onClick={() => setShowAddProjectModal(true)}
                title="Add Project"
                aria-label="Add project"
                className="text-slate-500 hover:text-[#008f96] flex items-center gap-1 transition focus-visible:ring-2 focus-visible:ring-[#00c9d2] rounded p-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[10px] lowercase capitalize">Add</span>
              </button>
            </div>

            {/* Current Project Dropdown Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                aria-haspopup="listbox"
                aria-expanded={projectDropdownOpen}
                aria-label={`Current project: ${activeProject?.name || "Select project"}`}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-[#020618] transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
              >
                <div className="flex items-center gap-2 truncate">
                  <Folder className="w-4 h-4 text-[#008f96] shrink-0" />
                  <span className="truncate">{activeProject?.name || "Select Project"}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${projectDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Projects Dropdown Menu */}
              {projectDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto"
                  role="listbox"
                  aria-label="User projects"
                >
                  {projects.map((proj) => {
                    const isSelected = proj.id === currentProjectId;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectProject(proj.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs transition text-left ${
                          isSelected
                            ? "bg-[#00c9d2]/10 text-[#008f96] font-bold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">{proj.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#008f96]" />}
                      </button>
                    );
                  })}
                  <div className="border-t border-slate-100 my-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProjectDropdownOpen(false);
                        setShowAddProjectModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#008f96] hover:bg-slate-50 text-left transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add new project…</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Navigation for Selected Project */}
          <nav className="space-y-1" aria-label="Project Navigation">
            <Link
              href={currentProjectId ? `/projects/${currentProjectId}/chat` : "/chat"}
              aria-current={activeTab === "chat" ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[#00c9d2] ${
                activeTab === "chat"
                  ? "bg-[#020618] text-white font-semibold shadow-xs"
                  : "text-slate-600 hover:text-[#020618] hover:bg-slate-50"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Research Chat</span>
            </Link>

            <Link
              href={currentProjectId ? `/projects/${currentProjectId}/documents` : "/documents"}
              aria-current={activeTab === "documents" ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-xs transition-colors focus-visible:ring-2 focus-visible:ring-[#00c9d2] ${
                activeTab === "documents"
                  ? "bg-[#020618] text-white font-semibold shadow-xs"
                  : "text-slate-600 hover:text-[#020618] hover:bg-slate-50"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Compliance Documents</span>
            </Link>
          </nav>

          {/* Project Tools & MCP Credentials */}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <div className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Integrations
            </div>
            <button
              type="button"
              onClick={() => setShowMcpModal(true)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-[#020618] hover:bg-slate-50 font-medium transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
            >
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4 text-slate-500" />
                <span>MCP API Tokens</span>
              </div>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                v1
              </span>
            </button>
          </div>
        </div>

        {/* User Account / Sign out */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 min-w-0"
            title={`Signed in as ${session.user.email}`}
          >
            <div className="w-7 h-7 rounded-full bg-[#020618] text-[#00c9d2] flex items-center justify-center font-bold text-xs shrink-0">
              {userInitial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400 truncate">
                {session.user.email}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            title="Sign out"
            aria-label="Sign out of Veyd"
            className="p-1.5 text-slate-400 hover:text-[#020618] rounded-lg hover:bg-slate-100 transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE COMPACT HEADER (Down to 320px)                                      */}
      {/* ========================================================================= */}
      <div className="md:hidden flex flex-col bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="h-14 px-3 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link
            href={currentProjectId ? `/projects/${currentProjectId}/chat` : "/chat"}
            className="flex items-center gap-2 shrink-0"
            aria-label="Veyd Home"
          >
            <div className="w-7 h-7 rounded-lg bg-[#020618] flex items-center justify-center text-[#00c9d2] font-bold text-xs">
              V
            </div>
            <span className="font-bold text-sm text-[#020618]">Veyd</span>
          </Link>

          {/* Compact Project Switcher */}
          <div className="relative min-w-0 flex-1 max-w-[170px] sm:max-w-[240px]">
            <button
              type="button"
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="w-full flex items-center justify-between gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 truncate"
            >
              <span className="truncate">{activeProject?.name || "Project"}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {projectDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 max-h-60 overflow-y-auto"
                role="listbox"
              >
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleSelectProject(proj.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left ${
                      proj.id === currentProjectId
                        ? "bg-[#00c9d2]/10 text-[#008f96] font-bold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{proj.name}</span>
                    {proj.id === currentProjectId && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
                <div className="border-t border-slate-100 my-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProjectDropdownOpen(false);
                      setShowAddProjectModal(true);
                    }}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#008f96]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add project…</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick MCP and Sign-out */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowMcpModal(true)}
              title="MCP Tokens"
              className="p-1.5 text-slate-500 hover:text-slate-800"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="flex border-t border-slate-100 bg-slate-50 px-2 py-1 gap-1">
          <Link
            href={currentProjectId ? `/projects/${currentProjectId}/chat` : "/chat"}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "chat" ? "bg-white text-[#020618] shadow-xs" : "text-slate-600"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </Link>
          <Link
            href={currentProjectId ? `/projects/${currentProjectId}/documents` : "/documents"}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "documents" ? "bg-white text-[#020618] shadow-xs" : "text-slate-600"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documents</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-6 lg:p-8">
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
                    This conversation link does not exist in this project or you do not have permission to view it.
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
                      <span>{activeProject?.name || "Project"} Copilot</span>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#020618]">
                      What would you like to research today?
                    </h1>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                      Ask questions across internal reviewed rules for <strong>{activeProject?.name}</strong>, industry standards, and live regulatory guidance.
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
                      "Hazard analysis preventative controls",
                      "Record retention timelines",
                      "Sanitation monitoring requirements",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setSearchQuery(suggestion);
                          handleSendPrompt(suggestion);
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#00c9d2] rounded-full text-slate-600 hover:text-[#020618] transition shadow-2xs"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ACTIVE CONVERSATION THREAD */
                <div className="space-y-6">
                  {/* Reset/New Chat Action Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{messages.length} message{messages.length === 1 ? "" : "s"} in session</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartNewSession}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-[#020618] hover:bg-slate-100 rounded-lg transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>New Session</span>
                    </button>
                  </div>

                  {/* Messages List */}
                  <div className="space-y-6" role="log" aria-label="Conversation messages">
                    {messages.map((m, index) => {
                      const isUser = m.role === "user";
                      const textContent = extractMessageText((m as any).parts);
                      const citations = extractMessageCitations((m as any).parts);

                      return (
                        <div
                          key={m.id || index}
                          className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          {!isUser && (
                            <div className="w-8 h-8 rounded-lg bg-[#020618] flex items-center justify-center text-[#00c9d2] text-xs font-bold shrink-0 mt-0.5 border border-slate-800">
                              V
                            </div>
                          )}

                          <div className={`space-y-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                            <div
                              className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                isUser
                                  ? "bg-[#020618] text-white rounded-br-xs shadow-xs"
                                  : "bg-white border border-slate-200 text-[#020618] rounded-bl-xs shadow-2xs"
                              }`}
                            >
                              <div className="whitespace-pre-wrap">{textContent}</div>
                            </div>

                            {/* Citations List */}
                            {!isUser && citations.length > 0 && (
                              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2 text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#008f96]" />
                                  <span>Verified Citations ({citations.length})</span>
                                </div>
                                <div className="space-y-1.5">
                                  {citations.map((c, cIdx) => {
                                    const isRemoved = c.availability === "removed";
                                    const displayTitle = c.documentTitle || c.title;
                                    const sourcePages = c.sourcePages;

                                    return (
                                      <div
                                        key={cIdx}
                                        className={`flex items-start justify-between gap-2 p-2 rounded-lg border text-[11px] transition-colors ${
                                          isRemoved
                                            ? "bg-slate-50/80 border-slate-200/60"
                                            : "bg-white border-slate-100 shadow-2xs"
                                        }`}
                                      >
                                        <div className="min-w-0 space-y-0.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span
                                              className={`font-semibold truncate ${
                                                isRemoved ? "text-slate-600" : "text-slate-800"
                                              }`}
                                            >
                                              {displayTitle}
                                            </span>
                                            {isRemoved && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                Source removed
                                              </span>
                                            )}
                                          </div>
                                          {c.citation && (
                                            <div className="text-slate-500 font-mono text-[10px] truncate">
                                              {c.citation}
                                            </div>
                                          )}
                                          {sourcePages && sourcePages.length > 0 && (
                                            <div className="text-[10px] text-slate-400">
                                              Page{sourcePages.length === 1 ? "" : "s"}: {sourcePages.join(", ")}
                                            </div>
                                          )}
                                        </div>
                                        {!isRemoved && c.url ? (
                                          <a
                                            href={c.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#008f96] hover:underline flex items-center gap-1 shrink-0 font-medium"
                                          >
                                            <span>Source</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Activity Announcement */}
                  {isStreaming && (
                    <div
                      className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs"
                      aria-live="polite"
                    >
                      <Loader2 className="w-4 h-4 animate-spin text-[#00c9d2]" />
                      <span>{getToolActivityLabel()}</span>
                    </div>
                  )}

                  {/* Categorized Chat Error Banner */}
                  {chatError && (
                    <div
                      className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2"
                      role="alert"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{getCategorizedChatError(chatError).title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRetry}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition"
                        >
                          Retry
                        </button>
                      </div>
                      <p className="text-rose-700">
                        {getCategorizedChatError(chatError).description}
                      </p>
                    </div>
                  )}

                  {/* Persistence Warning Banner */}
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
                    Managing documents and extracted rule drafts for project <strong>{activeProject?.name}</strong>.
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
                      Max 10 MB &bull; Up to 100 pages &bull; Bound to {activeProject?.name}
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
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleSelectFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? "border-[#00c9d2] bg-[#00c9d2]/5"
                      : uploadFile
                      ? "border-emerald-300 bg-emerald-50/30"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleSelectFile(e.target.files[0]);
                      }
                    }}
                  />
                  {uploadFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-semibold text-slate-800">
                        {uploadFile.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatBytes(uploadFile.size)} &bull; Click or drag to replace
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        Click to upload or drag and drop regulatory PDF
                      </div>
                      <div className="text-[11px] text-slate-400">
                        PDF up to 10 MB
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata Fields & Submit Button */}
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="doc-title-input" className="text-xs font-semibold text-slate-700">
                        Document Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="doc-title-input"
                        type="text"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        placeholder="e.g. FDA Food Safety Modernization Act"
                        maxLength={200}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-[#020618] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00c9d2]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="doc-industry-input" className="text-xs font-semibold text-slate-700">
                        Industry / Sector <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="doc-industry-input"
                        type="text"
                        value={docIndustry}
                        onChange={(e) => setDocIndustry(e.target.value)}
                        placeholder="e.g. Food & Beverage, Healthcare, Civil"
                        maxLength={100}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-[#020618] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00c9d2]"
                      />
                    </div>
                  </div>

                  {uploadErrorMsg && (
                    <div
                      className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
                      role="alert"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{uploadErrorMsg}</span>
                    </div>
                  )}

                  {uploadSuccessSummary && (
                    <div
                      className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2"
                      role="status"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Successfully ingested &quot;{uploadSuccessSummary.title}&quot; and extracted{" "}
                        {uploadSuccessSummary.extractedCount} rule draft(s).
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end">
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

                {removalSuccessMessage && (
                  <div
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between"
                    role="status"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{removalSuccessMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemovalSuccessMessage(null)}
                      className="text-[11px] font-semibold underline text-emerald-700"
                    >
                      Dismiss
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
                    <p className="text-sm font-semibold text-[#020618]">No documents in {activeProject?.name || "project"} yet</p>
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

                            {/* Remove from Project action */}
                            <button
                              type="button"
                              onClick={() => setDocumentToRemove(doc)}
                              aria-label={`Remove ${doc.title} from project`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition focus-visible:ring-2 focus-visible:ring-rose-500"
                              title={`Remove ${doc.title} and derived rules from active project context`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Remove</span>
                            </button>
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
          Veyd &bull; Regulatory Intelligence Platform &bull; Project: {activeProject?.name || "General"}
        </footer>
      </div>

      {/* Add Project Modal */}
      <AddProjectModal
        isOpen={showAddProjectModal}
        onClose={() => setShowAddProjectModal(false)}
        onProjectCreated={(newProj) => {
          fetchProjects();
          setActiveProjectId(newProj.id);
        }}
      />

      {/* Project MCP Credentials Modal */}
      <ProjectMcpModal
        isOpen={showMcpModal}
        onClose={() => setShowMcpModal(false)}
        projectId={currentProjectId}
        projectName={activeProject?.name || "Project"}
      />

      {/* Remove Document Confirmation Modal */}
      <RemoveDocumentModal
        isOpen={!!documentToRemove}
        onClose={() => setDocumentToRemove(null)}
        documentItem={documentToRemove}
        projectId={currentProjectId}
        onDocumentRemoved={(docId, docTitle) => {
          setDocuments((prev) => prev.filter((d) => d._id !== docId));
          setRemovalSuccessMessage(
            `Document "${docTitle}" and its rules were successfully removed from this project.`
          );
        }}
      />
    </div>
  );
}
