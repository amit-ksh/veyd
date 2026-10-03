"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { ChatFileInput } from "@/lib/chat-files/types";
import {
  clientApi,
  type ProjectItem,
  type McpCredentialItem,
  ClientApiError,
} from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import type { ComplianceDocumentListItem } from "@/lib/sanity/types";
import type { HandbookResponse } from "@/lib/handbook/types";

export function useProjects(userId?: string) {
  return useQuery({
    queryKey: queryKeys.projects(userId),
    enabled: Boolean(userId),
    queryFn: ({ signal }) => clientApi.projects(signal),
  });
}
export function useDocuments(
  userId: string | undefined,
  projectId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.documents(userId, projectId),
    enabled: Boolean(userId && projectId && enabled),
    queryFn: ({ signal }) => clientApi.documents(projectId, signal),
  });
}
export function useConversationHistory(
  userId: string | undefined,
  projectId: string,
) {
  return useQuery({
    queryKey: queryKeys.history(userId, projectId),
    enabled: Boolean(userId && projectId),
    staleTime: 30_000,
    queryFn: ({ signal }) => clientApi.history(projectId, signal),
  });
}
export function useConversation(
  userId: string | undefined,
  projectId: string,
  id: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.conversation(userId, projectId, id || ""),
    enabled: Boolean(userId && projectId && id && enabled),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: ({ signal }) => clientApi.conversation(projectId, id!, signal),
  });
}
export function useCredentials(
  userId: string | undefined,
  projectId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.credentials(userId, projectId),
    enabled: Boolean(userId && projectId && enabled),
    queryFn: ({ signal }) => clientApi.credentials(projectId, signal),
  });
}
export function useHandbook(userId: string | undefined, projectId: string) {
  return useQuery({
    queryKey: queryKeys.handbook(userId, projectId),
    enabled: Boolean(userId && projectId),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: ({ signal }) => clientApi.handbook(projectId, signal),
    refetchInterval: (query) =>
      !query.state.error && query.state.data?.status === "generating"
        ? 3000
        : false,
  });
}

export function useCreateProject(userId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: clientApi.createProject,
    onMutate: () =>
      client.cancelQueries({
        queryKey: queryKeys.projects(userId),
        exact: true,
      }),
    onSuccess: (project) => {
      client.setQueryData<ProjectItem[]>(
        queryKeys.projects(userId),
        (items) => [
          project,
          ...(items || []).filter((item) => item.id !== project.id),
        ],
      );
      void client.invalidateQueries({
        queryKey: queryKeys.projects(userId),
        exact: true,
      });
    },
    onError: () => {
      void client.invalidateQueries({
        queryKey: queryKeys.projects(userId),
        exact: true,
      });
    },
  });
}
export function useIngestDocument(userId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: clientApi.ingest,
    onSuccess: (_, input) => {
      void client.invalidateQueries({
        queryKey: queryKeys.documents(userId, input.projectId),
        exact: true,
      });
      void client.invalidateQueries({
        queryKey: queryKeys.handbook(userId, input.projectId),
        exact: true,
      });
    },
  });
}
export function useChatFileImport(userId: string) {
  const client = useQueryClient();
  const inputs = useRef(new Map<string, ChatFileInput>());
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: (identity: { projectId: string; requestId: string }) => {
      const input = inputs.current.get(identity.requestId);
      if (!input)
        throw new ClientApiError(
          "The import request expired. Please confirm it again.",
        );
      return clientApi.ingestChatFile(input);
    },
    onSettled: async (_, __, identity) => {
      inputs.current.delete(identity.requestId);
      await Promise.all([
        client.invalidateQueries({
          queryKey: queryKeys.documents(userId, identity.projectId),
          exact: true,
        }),
        client.invalidateQueries({
          queryKey: queryKeys.handbook(userId, identity.projectId),
          exact: true,
        }),
        client.invalidateQueries({
          queryKey: queryKeys.conversations(userId, identity.projectId),
        }),
      ]);
    },
  });
  return {
    ...mutation,
    ingest: (input: ChatFileInput) => {
      inputs.current.set(input.requestId, input);
      return mutation.mutateAsync({
        projectId: input.projectId,
        requestId: input.requestId,
      });
    },
  };
}
export function useRemoveDocument(userId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; documentId: string }) =>
      clientApi.removeDocument(input.projectId, input.documentId),
    onMutate: (input) =>
      client.cancelQueries({
        queryKey: queryKeys.documents(userId, input.projectId),
        exact: true,
      }),
    onSuccess: (_, input) => {
      client.setQueryData<ComplianceDocumentListItem[]>(
        queryKeys.documents(userId, input.projectId),
        (items) => items?.filter((item) => item._id !== input.documentId),
      );
    },
    onSettled: async (_, __, input) => {
      // A failed removal may already have installed a retrieval tombstone. Never reuse that book.
      await client.cancelQueries({
        queryKey: queryKeys.handbook(userId, input.projectId),
        exact: true,
      });
      client.removeQueries({
        queryKey: queryKeys.handbook(userId, input.projectId),
        exact: true,
      });
      void client.invalidateQueries({
        queryKey: queryKeys.documents(userId, input.projectId),
        exact: true,
      });
      void client.invalidateQueries({
        queryKey: queryKeys.conversations(userId, input.projectId),
      });
    },
  });
}
export function useGenerateHandbook(userId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; signal: AbortSignal }) =>
      clientApi.generateHandbook(input.projectId, input.signal),
    onMutate: async (input) => {
      await client.cancelQueries({
        queryKey: queryKeys.handbook(userId, input.projectId),
        exact: true,
      });
      input.signal.throwIfAborted();
      client.setQueryData<HandbookResponse>(
        queryKeys.handbook(userId, input.projectId),
        { status: "generating", handbook: null },
      );
    },
    onSuccess: (result, input) => {
      if (!input.signal.aborted)
        client.setQueryData(
          queryKeys.handbook(userId, input.projectId),
          result,
        );
    },
    onError: (_, input) => {
      if (!input.signal.aborted)
        client.setQueryData<HandbookResponse>(
          queryKeys.handbook(userId, input.projectId),
          { status: "failed", handbook: null },
        );
    },
  });
}
export function useCreateCredential(
  userId: string,
  onToken: (token: string, projectId: string) => void,
) {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (input: { projectId: string; label: string }) => {
      const result = await clientApi.createCredential(
        input.projectId,
        input.label,
      );
      if (
        typeof result.plaintextToken !== "string" ||
        !result.plaintextToken ||
        !result.credential?.id
      )
        throw new ClientApiError(
          "The token was created but was not returned. Refresh the list, revoke it and generate another.",
        );
      onToken(result.plaintextToken, input.projectId);
      // Plaintext must never become query or mutation-cache data.
      return result.credential;
    },
    onMutate: (input) =>
      client.cancelQueries({
        queryKey: queryKeys.credentials(userId, input.projectId),
        exact: true,
      }),
    onSuccess: (credential, input) => {
      client.setQueryData<McpCredentialItem[]>(
        queryKeys.credentials(userId, input.projectId),
        (items) => [
          credential,
          ...(items || []).filter((item) => item.id !== credential.id),
        ],
      );
    },
    onSettled: (_, __, input) => {
      void client.invalidateQueries({
        queryKey: queryKeys.credentials(userId, input.projectId),
        exact: true,
      });
    },
  });
}
export function useRevokeCredential(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; credentialId: string }) =>
      clientApi.revokeCredential(input.projectId, input.credentialId),
    onMutate: (input) =>
      client.cancelQueries({
        queryKey: queryKeys.credentials(userId, input.projectId),
        exact: true,
      }),
    onSuccess: (credential, input) => {
      client.setQueryData<McpCredentialItem[]>(
        queryKeys.credentials(userId, input.projectId),
        (items) =>
          items?.map((item) => (item.id === credential.id ? credential : item)),
      );
    },
    onSettled: (_, __, input) => {
      void client.invalidateQueries({
        queryKey: queryKeys.credentials(userId, input.projectId),
        exact: true,
      });
    },
  });
}
