const styles: Record<string, string> = {
  PASS: "bg-status-pass/10 text-status-pass",
  FAIL: "bg-status-fail/10 text-status-fail",
  NEEDS_REVIEW: "bg-status-review/10 text-status-review",
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[outcome] ?? "bg-slate-100 text-slate-500"}`}>
      {outcome.replace("_", " ")}
    </span>
  );
}
