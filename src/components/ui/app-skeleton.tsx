import { Skeleton } from "@/components/ui/skeleton";
import { CircularLoader } from "@/components/ui/circular-loader";

export function AppSkeleton({
  activeTab = "chat",
  label = "Loading workspace…",
}: {
  activeTab?: "chat" | "documents" | "handbook" | "default";
  label?: string;
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#020618] flex flex-col md:flex-row font-sans">
      {/* Sidebar Skeleton (Desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-slate-200/90 flex-col justify-between min-h-screen p-4 sticky top-0 h-screen overflow-hidden z-30">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>

          {/* Project Switcher */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>

          {/* Nav Links */}
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>

          {/* Chat History Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="px-2">
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-full rounded-lg" />
              <Skeleton className="h-7 w-4/5 rounded-lg" />
              <Skeleton className="h-7 w-3/4 rounded-lg" />
            </div>
          </div>
        </div>

        {/* User Account / Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-2.5 w-28 rounded" />
            </div>
          </div>
          <Skeleton className="w-7 h-7 rounded-lg" />
        </div>
      </aside>

      {/* Mobile Header Skeleton */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 h-14 px-4 sticky top-0 z-40">
        <Skeleton className="h-6 w-16 rounded" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Main Content Skeleton Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Top subtle status indicator */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
            <div className="flex items-center gap-3">
              <CircularLoader size="xs" variant="brand" />
              <span className="text-xs font-medium text-slate-500">{label}</span>
            </div>
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>

          {activeTab === "chat" ? (
            /* Chat View Skeleton */
            <div className="max-w-3xl mx-auto space-y-8 pt-4">
              <div className="text-center space-y-3">
                <Skeleton className="h-6 w-32 rounded-full mx-auto" />
                <Skeleton className="h-9 w-3/4 rounded-xl mx-auto" />
                <Skeleton className="h-4 w-1/2 rounded-md mx-auto" />
              </div>

              {/* Search Prompt Skeleton */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>

              {/* Starter Suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Skeleton className="h-8 w-44 rounded-full" />
                <Skeleton className="h-8 w-36 rounded-full" />
                <Skeleton className="h-8 w-48 rounded-full" />
              </div>

              {/* Mock Chat Card */}
              <div className="space-y-4 pt-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                  <Skeleton className="h-3.5 w-full rounded" />
                  <Skeleton className="h-3.5 w-5/6 rounded" />
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                </div>
              </div>
            </div>
          ) : activeTab === "documents" ? (
            /* Documents View Skeleton */
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-7 w-36 rounded-lg" />
                  <Skeleton className="h-3.5 w-56 rounded" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>

              {/* Upload Dropzone Skeleton */}
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center space-y-3">
                <Skeleton className="h-12 w-12 rounded-full mx-auto" />
                <Skeleton className="h-4 w-48 rounded mx-auto" />
                <Skeleton className="h-3 w-32 rounded mx-auto" />
              </div>

              {/* Document rows */}
              <div className="space-y-3 pt-2">
                <Skeleton className="h-5 w-40 rounded" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 w-2/3">
                      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                      <div className="space-y-1.5 w-full">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="h-3 w-1/2 rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-7 w-16 rounded-md" />
                      <Skeleton className="h-7 w-7 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Handbook View Skeleton */
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-7 w-44 rounded-lg" />
                  <Skeleton className="h-3.5 w-64 rounded" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              </div>

              {/* Book Desk Skeleton */}
              <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-8 flex justify-center">
                <div className="w-full max-w-[560px] aspect-[148/210] rounded-xl bg-white border border-slate-200 shadow-sm p-8 space-y-4">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-8 w-3/4 rounded-lg" />
                  <Skeleton className="h-3.5 w-full rounded" />
                  <Skeleton className="h-3.5 w-full rounded" />
                  <Skeleton className="h-3.5 w-4/5 rounded" />
                  <Skeleton className="h-32 w-full rounded-xl mt-6" />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
