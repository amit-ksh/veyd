"use client";

import React, { useState } from "react";
import { MessageSquare, FileText, Shield, Info, LogOut, User as UserIcon, Loader2 } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { AuthForm } from "@/components/AuthForm";

interface AppShellProps {
  children?: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { data: session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<"chat" | "documents">("chat");

  // Loading state
  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <span className="text-sm font-medium">Verifying session…</span>
        </div>
      </div>
    );
  }

  // Auth gate: If user is not authenticated, show sign-in/registration screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex w-12 h-12 rounded-xl bg-teal-600 items-center justify-center text-white shadow-md mb-4">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Compliance Research Engine
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in or create an account to access the compliance handbook and research chat.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <AuthForm />
        </div>
      </div>
    );
  }

  // Authenticated application shell
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top persistent header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-slate-900">
                Compliance Research
              </span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Sanity Core
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Navigation Tabs (Disabled / Staged in Milestone 1) */}
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-sm">
              <button
                type="button"
                disabled
                title="Chat feature available in Milestone 5"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-xs transition-colors cursor-not-allowed ${
                  activeTab === "chat"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-500"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
                <span className="text-[10px] text-slate-400 bg-slate-200/60 px-1 rounded">Soon</span>
              </button>
              <button
                type="button"
                disabled
                title="Documents ingestion available in Milestone 3"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-xs transition-colors cursor-not-allowed ${
                  activeTab === "documents"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-500"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Documents</span>
                <span className="text-[10px] text-slate-400 bg-slate-200/60 px-1 rounded">Soon</span>
              </button>
            </nav>

            {/* Authenticated user status and sign-out */}
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="max-w-[120px] truncate" title={session.user.email}>
                  {session.user.name || session.user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                title="Sign out"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main workspace container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children ? (
          children
        ) : (
          <div className="max-w-xl mx-auto mt-12 bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-3">
                <h1 className="text-lg font-semibold text-slate-900">
                  Compliance Application Foundation
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Authenticated session active for <strong>{session.user.email}</strong>.
                  The shared server foundation is active: Better-Auth authentication, server configuration validation,
                  published/write Sanity clients, standard API error envelopes, and Upstash rate limiters are configured.
                </p>
                <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-teal-50 text-teal-700 font-mono">
                    User: Authenticated
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono">
                    Database: Prisma / PostgreSQL
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono">
                    Content Lake: Sanity Core
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Subtle footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Compliance Research Engine &bull; Protected by Better-Auth &bull; Read-only Sanity Content Lake
      </footer>
    </div>
  );
}
