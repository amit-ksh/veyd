import { prisma } from "@/lib/prisma";
import { VerifyPanel } from "@/components/VerifyPanel";
import { OutcomeBadge } from "@/components/OutcomeBadge";

export default async function VerifyPage({ params }: { params: { workspaceId: string } }) {
  const logs = await prisma.verificationLog.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-brand-700">Verify compliance</h1>
        <VerifyPanel workspaceId={params.workspaceId} />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Audit log</h2>
        <div className="card divide-y divide-black/5">
          {logs.length === 0 && <p className="p-4 text-sm text-slate-400">No verifications recorded yet.</p>}
          {logs.map((log) => (
            <div key={log.id} className="p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium">{log.ruleTitle}</p>
                <OutcomeBadge outcome={log.outcome} />
              </div>
              <p className="text-xs text-slate-500">{log.reasoning}</p>
              <p className="mt-1 text-xs text-slate-400">
                {log.source === "mcp" ? "via AI agent" : "manual"} · {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
