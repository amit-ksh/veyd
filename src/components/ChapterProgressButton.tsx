"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

export function ChapterProgressButton({
  workspaceId,
  chapterSlug,
}: {
  workspaceId: string;
  chapterSlug: string;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterSlug, status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Failed to save progress");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress", workspaceId] });
    },
  });

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending || mutation.isSuccess}
      className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      <CheckCircle2 size={16} />
      {mutation.isSuccess
        ? "Marked as read & acknowledged"
        : mutation.isPending
          ? "Saving…"
          : "Mark chapter read & acknowledge"}
    </button>
  );
}
