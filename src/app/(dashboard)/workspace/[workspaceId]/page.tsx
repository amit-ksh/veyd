import { prisma } from "@/lib/prisma";
import { getIndustryBySlug, getChaptersByIndustry } from "@/lib/sanity/queries";
import { OutcomeBadge } from "@/components/OutcomeBadge";
import Link from "next/link";

export default async function WorkspaceOverview({ params }: { params: { workspaceId: string } }) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: params.workspaceId } });
  const [industry, chapters, progress, verifications] = await Promise.all([
    getIndustryBySlug(workspace.industrySlug),
    getChaptersByIndustry(workspace.industrySlug),
    prisma.handbookProgress.findMany({ where: { workspaceId: workspace.id } }),
    prisma.verificationLog.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const completed = progress.filter((p) => p.status === "COMPLETED").length;
  const total = chapters.length || 1;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-700">{workspace.name}</h1>
        <p className="text-sm text-slate-500">
          Industry: {industry?.title ?? workspace.industrySlug} — {industry?.summary}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Handbook progress" value={`${pct}%`} sub={`${completed}/${chapters.length} chapters`} />
        <StatCard label="Compliance checks" value={String(verifications.length)} sub="most recent 5 shown" />
        <StatCard
          label="Failing checks"
          value={String(verifications.filter((v) => v.outcome === "FAIL").length)}
          sub="needs attention"
          tone="fail"
        />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Recent verification activity</h2>
          <Link href={`/workspace/${workspace.id}/verify`} className="text-sm text-brand-600 hover:underline">
            Run a check →
          </Link>
        </div>
        {verifications.length === 0 ? (
          <p className="text-sm text-slate-400">
            No checks yet. Use the Verify tab, or point an AI agent at /api/mcp.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {verifications.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                <span>{v.ruleTitle}</span>
                <OutcomeBadge outcome={v.outcome} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={`/workspace/${workspace.id}/handbook`}
        className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Continue the handbook
      </Link>
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "fail" }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "fail" ? "text-status-fail" : "text-brand-700"}`}>
        {value}
      </p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

