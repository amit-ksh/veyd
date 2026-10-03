"use client";

import Link from "next/link";
import { useConversationHistory } from "@/hooks/use-app-queries";
import { isAccessError } from "@/lib/client-api";
import { Clock, MessageSquare, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ChatHistory({
  userId,
  projectId,
  conversationId,
}: {
  userId: string;
  projectId: string;
  conversationId: string | null;
}) {
  const { data, error, isPending, isError, isFetching, refetch } =
    useConversationHistory(userId, projectId);
  const items = isAccessError(error) ? [] : data || [];
  return (
    <section aria-label="Previous chats" className="space-y-2">
      <h2 className="flex items-center gap-2 px-3 text-xs font-semibold text-slate-600">
        <Clock className="h-3.5 w-3.5" />
        Previous chats
      </h2>
      {isError && (
        <button
          disabled={isFetching}
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-3 text-xs text-rose-700 disabled:opacity-50"
        >
          {isFetching && (
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            />
          )}
          {data && !isAccessError(error)
            ? "Retry refreshing chats"
            : "Retry loading chats"}
        </button>
      )}
      {isPending ? (
        <div
          role="status"
          aria-label="Loading previous chats"
          className="space-y-2 px-3"
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : isError && (!data || isAccessError(error)) ? null : !items.length ? (
        <p className="px-3 text-xs text-slate-500">
          Your saved chats will appear here.
        </p>
      ) : (
        <nav
          aria-label="Saved conversations"
          className="max-h-52 space-y-1 overflow-y-auto"
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/projects/${projectId}/chat/${item.id}`}
              aria-current={conversationId === item.id ? "page" : undefined}
              title={item.title}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${conversationId === item.id ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.title}</span>
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
