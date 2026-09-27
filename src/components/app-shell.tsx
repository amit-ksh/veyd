"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { AuthForm } from "@/components/AuthForm";

interface AppShellProps {
  children?: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { data: session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<"chat" | "documents">("chat");
  const [searchQuery, setSearchQuery] = useState("");

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
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm font-bold text-sm tracking-wider">
                V
              </div>
              <span className="font-bold text-lg tracking-tight text-slate-900">
                Veyd
              </span>
            </div>

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
          <div className="max-w-3xl mx-auto mt-8 sm:mt-12 space-y-8">
            {/* Minimal Greeting */}
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

            {/* Intuitive Search / Prompt Input */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Will bind to chat stream
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
                  disabled={!searchQuery.trim()}
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
                  onClick={() => setSearchQuery(suggestion)}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-2xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Clean Feature Overview */}
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

            {/* Document List Placeholder */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-slate-600">No documents uploaded yet</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Uploaded documents and extracted compliance rules will appear here.
              </p>
            </div>
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
