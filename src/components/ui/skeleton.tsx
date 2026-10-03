import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-slate-200/70", className)}
      {...props}
    />
  );
}

export function ContentSkeleton({
  label = "Loading",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div role="status" aria-label={label} className="space-y-5 py-6">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
        >
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}
