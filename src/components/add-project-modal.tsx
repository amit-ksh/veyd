"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, FolderPlus, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCreateProject } from "@/hooks/use-app-queries";
import { apiErrorMessage } from "@/lib/client-api";

interface AddProjectModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: { id: string; name: string }) => void;
}

export function AddProjectModal({
  userId,
  isOpen,
  onClose,
  onProjectCreated,
}: AddProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const createProject = useCreateProject(userId);
  const loading = createProject.isPending;
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Project name cannot be empty.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Project name must be 100 characters or fewer.");
      return;
    }

    setError(null);

    try {
      const createdProject = await createProject.mutateAsync(trimmed);

      onProjectCreated(createdProject);
      onClose();
      router.push(`/projects/${createdProject.id}/chat`);
    } catch (err: any) {
      setError(
        apiErrorMessage(err, "Failed to create project. Please try again."),
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-project-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00c9d2]/15 text-[#008f96] flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h2
              id="add-project-title"
              className="text-base font-bold text-[#020618]"
            >
              Create New Project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Keep documents, chats, and a handbook together for one topic.
          </p>

          <div className="space-y-1.5">
            <label
              htmlFor="project-name-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="project-name-input"
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Food, Civil, Engineering"
              maxLength={100}
              disabled={loading}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#020618] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00c9d2] focus:border-transparent transition"
            />
            <div className="flex justify-between text-[11px] text-slate-400 px-0.5">
              <span>Descriptive name for this domain</span>
              <span>{name.length}/100</span>
            </div>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#020618] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
            >
              {loading ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                  />
                  <span>Creating…</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
