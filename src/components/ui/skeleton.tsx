import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer rounded-md bg-slate-200/60", className)}
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
    <div role="status" aria-label={label} className="space-y-4 py-4 w-full">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="space-y-2.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
        >
          <Skeleton className="h-4 w-1/3 rounded-lg" />
          <Skeleton className="h-3 w-4/5 rounded-md" />
          <Skeleton className="h-3 w-3/5 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="space-y-4 py-2 w-full animate-in fade-in duration-300">
      <div className="flex justify-end">
        <div className="max-w-[70%] w-64 space-y-2 rounded-2xl bg-slate-100 p-3.5 border border-slate-200">
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-3/4 rounded" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="w-full space-y-3 rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-4/6 rounded" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
