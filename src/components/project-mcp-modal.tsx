"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Key,
  Plus,
  Loader2,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface ProjectMcpModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

interface McpCredentialItem {
  id: string;
  label: string;
  tokenHint: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function ProjectMcpModal({
  isOpen,
  onClose,
  projectId,
  projectName,
}: ProjectMcpModalProps) {
  const [credentials, setCredentials] = useState<McpCredentialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New credential state
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPlaintextToken, setNewPlaintextToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Revoking state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/credentials`);
      if (!res.ok) {
        throw new Error(`Failed to load credentials (${res.status})`);
      }
      const data = await res.json();
      setCredentials(data.data || data.credentials || []);
    } catch (err: any) {
      console.error("Fetch MCP credentials failed:", err);
      setError("Unable to load MCP credentials for this project.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      setNewPlaintextToken(null);
      setCopiedToken(false);
      setNewLabel("");
      fetchCredentials();
    }
  }, [isOpen, fetchCredentials]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !creating && !revokingId) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, creating, revokingId, onClose]);

  if (!isOpen) return null;

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLabel.trim();
    if (!trimmed) {
      setError("Token label is required (e.g. 'Cursor IDE' or 'Claude Desktop').");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || data.message || `Failed to create token (${res.status})`);
      }

      const result = await res.json();
      const payload = result.data || result;
      setNewPlaintextToken(payload.token);
      setNewLabel("");
      fetchCredentials();
    } catch (err: any) {
      console.error("Create token error:", err);
      setError(err.message || "Failed to generate MCP credential.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeToken = async (credentialId: string) => {
    if (!confirm("Are you sure you want to revoke this MCP token? Clients using it will immediately receive 401 Unauthorized.")) {
      return;
    }

    setRevokingId(credentialId);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/credentials/${credentialId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || data.message || `Failed to revoke token (${res.status})`);
      }

      fetchCredentials();
    } catch (err: any) {
      console.error("Revoke token error:", err);
      setError(err.message || "Failed to revoke token.");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    } catch {
      // Fallback
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const mcpEndpoint = `${origin}/api/mcp`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-tokens-title"
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00c9d2]/15 text-[#008f96] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 id="mcp-tokens-title" className="text-base font-bold text-[#020618]">
                MCP API Credentials
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Scoped to project: <span className="font-semibold text-[#020618]">{projectName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition focus-visible:ring-2 focus-visible:ring-[#00c9d2]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Endpoint Information */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Model Context Protocol Endpoint:</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                HTTP SSE / JSON-RPC
              </span>
            </div>
            <div className="font-mono text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 break-all select-all">
              {mcpEndpoint}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Authenticate via <code className="font-mono text-slate-700">Authorization: Bearer &lt;token&gt;</code>. Queries will be strictly confined to this project&apos;s published documents and verified rules.
            </p>
          </div>

          {/* Just Generated Plaintext Token Banner */}
          {newPlaintextToken && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>New Bearer Token Generated</span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                Copy this token now. For your security, this plaintext token cannot be retrieved or displayed again.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={newPlaintextToken}
                  className="w-full font-mono text-xs px-3 py-2 bg-white border border-emerald-300 rounded-lg text-slate-900 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(newPlaintextToken)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 transition"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Generate Token Form */}
          <form onSubmit={handleCreateToken} className="space-y-3 pt-1 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Generate New Token
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Token description (e.g. Cursor, Claude Desktop, CI)"
                disabled={creating}
                maxLength={50}
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#020618] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00c9d2] transition"
              />
              <button
                type="submit"
                disabled={creating || !newLabel.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#020618] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Generate</span>
              </button>
            </div>
          </form>

          {error && (
            <div
              className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Credentials List */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Active Credentials ({credentials.filter((c) => !c.revokedAt).length})
            </h3>

            {loading ? (
              <div className="py-6 flex justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-[#00c9d2]" />
              </div>
            ) : credentials.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No MCP credentials generated yet for this project.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {credentials.map((cred) => {
                  const isRevoked = !!cred.revokedAt;
                  return (
                    <div
                      key={cred.id}
                      className={`p-3 text-xs flex items-center justify-between gap-3 ${
                        isRevoked ? "bg-slate-50/70 opacity-60" : "bg-white hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 truncate">
                            {cred.label}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {cred.tokenHint}
                          </span>
                          {isRevoked && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              Revoked
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>Created: {new Date(cred.createdAt).toLocaleDateString()}</span>
                          {cred.lastUsedAt && (
                            <span>• Last used: {new Date(cred.lastUsedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      {!isRevoked && (
                        <button
                          type="button"
                          onClick={() => handleRevokeToken(cred.id)}
                          disabled={revokingId === cred.id}
                          title="Revoke Token"
                          aria-label={`Revoke token ${cred.label}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          {revokingId === cred.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
