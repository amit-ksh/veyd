"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ComplianceRule } from "@/lib/sanity/queries";
import { OutcomeBadge } from "@/components/OutcomeBadge";
import { Search } from "lucide-react";

export function VerifyPanel({ workspaceId }: { workspaceId: string }) {
  const [query, setQuery] = useState("");
  const [selectedRule, setSelectedRule] = useState<ComplianceRule | null>(null);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ["rules-search", query],
    queryFn: async () => {
      const res = await fetch(`/api/rules/search?q=${encodeURIComponent(query)}`);
      return (await res.json()).rules as ComplianceRule[];
    },
    enabled: query.length > 1,
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (!selectedRule) throw new Error("Select a rule first");
      const evidence = selectedRule.checklist.map((item, i) => ({
        item,
        satisfied: !!checks[i],
      }));
      const res = await fetch(`/api/workspaces/${workspaceId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleSlug: selectedRule.slug, evidence }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Verification failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["verification-history", workspaceId] }),
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedRule(null);
            verify.reset();
          }}
          placeholder="Search a compliance rule (e.g. allergen labeling, data retention)…"
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {isFetching && <p className="text-sm text-slate-400">Searching…</p>}

      {!selectedRule && data && data.length > 0 && (
        <ul className="card divide-y divide-black/5">
          {data.map((rule) => (
            <li
              key={rule._id}
              onClick={() => {
                setSelectedRule(rule);
                setChecks({});
              }}
              className="cursor-pointer p-3 text-sm hover:bg-brand-50"
            >
              <p className="font-medium">{rule.title}</p>
              <p className="text-xs text-slate-400">
                {rule.jurisdiction} · {rule.citation}
              </p>
            </li>
          ))}
        </ul>
      )}

      {selectedRule && (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">{selectedRule.title}</p>
            <button onClick={() => setSelectedRule(null)} className="text-xs text-slate-400 hover:underline">
              Change rule
            </button>
          </div>
          <p className="text-sm text-slate-600">{selectedRule.description}</p>

          <div className="space-y-2">
            {selectedRule.checklist.map((item, i) => (
              <label key={i} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!checks[i]}
                  onChange={(e) => setChecks((c) => ({ ...c, [i]: e.target.checked }))}
                  className="mt-0.5"
                />
                {item}
              </label>
            ))}
          </div>

          <button
            onClick={() => verify.mutate()}
            disabled={verify.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {verify.isPending ? "Verifying…" : "Run verification"}
          </button>

          {verify.data && (
            <div className="rounded-lg border border-black/5 bg-brand-50 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <OutcomeBadge outcome={verify.data.outcome} />
              </div>
              <p className="text-slate-600">{verify.data.reasoning}</p>
            </div>
          )}
          {verify.isError && <p className="text-sm text-status-fail">{(verify.error as Error).message}</p>}
        </div>
      )}

      <p className="text-xs text-slate-400">
        This runs the same check an AI agent can trigger over MCP at <code>/api/mcp</code> using the{" "}
        <code>verify_compliance</code> tool — every result, human or agent, lands in the same audit log.
      </p>
    </div>
  );
}
