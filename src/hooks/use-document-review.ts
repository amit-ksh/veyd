"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import type {
  DocumentReviewResponse,
  PublishSelection,
} from "@/lib/review/types";

export function useDocumentReview(
  userId: string | undefined,
  projectId: string,
  documentId: string,
) {
  return useQuery({
    queryKey: queryKeys.documentReview(userId, projectId, documentId),
    enabled: Boolean(userId && projectId && documentId),
    queryFn: ({ signal }) =>
      clientApi.documentReview(projectId, documentId, signal),
    staleTime: 0,
    // The editor holds a revision-bound snapshot; refresh must be deliberate.
    refetchOnWindowFocus: false,
  });
}

export function usePublishReviewedEntries(
  userId: string | undefined,
  projectId: string,
  documentId: string,
) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (selection: PublishSelection) =>
      clientApi.publishReviewedEntries(projectId, documentId, selection),
    retry: false,
    onSuccess: async (result) => {
      const published = new Set(
        result.publishedIds.map((id) => `drafts.${id}`),
      );
      // Update the review list only AFTER a confirmed commit, never fake approval.
      cache.setQueryData<DocumentReviewResponse>(
        queryKeys.documentReview(userId, projectId, documentId),
        (previous) =>
          previous
            ? {
                ...previous,
                entries: previous.entries.filter(
                  (entry) => !published.has(entry.id),
                ),
                totalPending: Math.max(
                  0,
                  previous.totalPending - published.size,
                ),
              }
            : previous,
      );
      await Promise.all([
        cache.invalidateQueries({
          queryKey: queryKeys.documents(userId, projectId),
          exact: true,
        }),
        cache.invalidateQueries({
          queryKey: queryKeys.handbook(userId, projectId),
        }),
      ]);
    },
  });
}
