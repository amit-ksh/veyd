import type { ComplianceRule } from "@/lib/sanity/queries";

const severityStyles: Record<string, string> = {
  critical: "bg-status-fail/10 text-status-fail",
  high: "bg-status-review/10 text-status-review",
  medium: "bg-brand-100 text-brand-700",
  low: "bg-slate-100 text-slate-500",
};

export function RuleCard({ rule }: { rule: ComplianceRule }) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-medium">{rule.title}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityStyles[rule.severity]}`}>
          {rule.severity}
        </span>
      </div>
      <p className="text-xs text-slate-400">
        {rule.jurisdiction} · {rule.citation}
      </p>
      <p className="mt-2 text-sm text-slate-600">{rule.description}</p>
      {rule.checklist?.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {rule.checklist.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-600">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
