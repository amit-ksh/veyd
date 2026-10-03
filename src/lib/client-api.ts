import type { ComplianceDocumentListItem } from "@/lib/sanity/types";
import type { ConversationResponse } from "@/lib/conversations/service";
import type { IngestDocumentResult } from "@/lib/ingestion/service";
import type { HandbookResponse } from "@/lib/handbook/types";
import {
  chatFileSchema,
  type ChatFileInput,
  type ChatFileResult,
} from "@/lib/chat-files/types";

export interface ProjectItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
export interface ConversationListItem {
  id: string;
  title: string;
  updatedAt: string;
}
export interface McpCredentialItem {
  id: string;
  label: string;
  tokenHint: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Contains safe display text/status only, never request headers or response bodies. */
export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}
export const isAccessError = (error: unknown) =>
  error instanceof ClientApiError && [401, 403, 404].includes(error.status);
export const apiErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ClientApiError ? error.message : fallback;

async function request(path: string, options: RequestInit = {}) {
  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      // Our handlers mask unexpected errors. Do not display unstructured proxy/provider text.
      const error = payload?.error;
      const message =
        typeof error?.code === "string" && typeof error?.message === "string"
          ? error.message
          : "Could not complete the request. Please try again.";
      throw new ClientApiError(message, response.status, error?.code);
    }
    return response;
  } catch (error) {
    if (options.signal?.aborted || error instanceof ClientApiError) throw error;
    throw new ClientApiError(
      "Could not connect. Check your connection and retry.",
    );
  }
}
async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await request(path, options);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ClientApiError(
      "The server returned an unreadable response. Please retry.",
    );
  }
}
const body = (value: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
const projectPath = (id: string) => `/api/projects/${encodeURIComponent(id)}`;
const invalidResponse = () =>
  new ClientApiError("The server returned an invalid response. Please retry.");

export const clientApi = {
  async projects(signal?: AbortSignal) {
    const result = await json<{ projects: ProjectItem[] }>("/api/projects", {
      signal,
    });
    if (!Array.isArray(result.projects)) throw invalidResponse();
    return result.projects;
  },
  async createProject(name: string) {
    const result = await json<{ project: ProjectItem }>("/api/projects", {
      method: "POST",
      ...body({ name }),
    });
    if (!result.project?.id || !result.project.name) throw invalidResponse();
    return result.project;
  },
  async documents(projectId: string, signal?: AbortSignal) {
    const result = await json<{ documents: ComplianceDocumentListItem[] }>(
      `/api/documents?projectId=${encodeURIComponent(projectId)}`,
      { signal },
    );
    if (
      !Array.isArray(result.documents) ||
      result.documents.some((item) => item.projectId !== projectId)
    )
      throw invalidResponse();
    return result.documents;
  },
  ingest(input: { projectId: string; title: string; blobUrl: string }) {
    return json<IngestDocumentResult>("/api/documents/ingest", {
      method: "POST",
      ...body(input),
    });
  },
  async ingestChatFile(input: ChatFileInput) {
    const result = await json<ChatFileResult>(
      projectPath(input.projectId) + "/chat-files/ingest",
      {
        method: "POST",
        ...body(input),
      },
    );
    const file = chatFileSchema.safeParse(result.file);
    if (!file.success || !result.conversationId || !result.messageId)
      throw invalidResponse();
    return { ...result, file: file.data };
  },
  removeDocument(projectId: string, documentId: string) {
    return json(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
        ...body({ confirmDocumentId: documentId }),
      },
    );
  },
  async history(projectId: string, signal?: AbortSignal) {
    const result = await json<{ conversations: ConversationListItem[] }>(
      `${projectPath(projectId)}/conversations`,
      { signal },
    );
    if (!Array.isArray(result.conversations)) throw invalidResponse();
    return result.conversations;
  },
  async conversation(projectId: string, id: string, signal?: AbortSignal) {
    const result = await json<ConversationResponse>(
      `/api/conversations/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
      { signal },
    );
    if (
      result.conversation?.id !== id ||
      result.conversation.projectId !== projectId ||
      !Array.isArray(result.messages)
    )
      throw invalidResponse();
    return result;
  },
  async credentials(projectId: string, signal?: AbortSignal) {
    const result = await json<{ credentials: McpCredentialItem[] }>(
      `${projectPath(projectId)}/credentials`,
      { signal },
    );
    if (!Array.isArray(result.credentials)) throw invalidResponse();
    return result.credentials;
  },
  createCredential(projectId: string, label: string) {
    return json<{ credential: McpCredentialItem; plaintextToken: string }>(
      `${projectPath(projectId)}/credentials`,
      { method: "POST", ...body({ label }) },
    );
  },
  async revokeCredential(projectId: string, id: string) {
    const result = await json<{ revoked: McpCredentialItem }>(
      `${projectPath(projectId)}/credentials/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return result.revoked;
  },
  handbook(projectId: string, signal?: AbortSignal) {
    return json<HandbookResponse>(`${projectPath(projectId)}/handbook`, {
      signal,
    });
  },
  generateHandbook(projectId: string, signal?: AbortSignal) {
    return json<HandbookResponse>(
      `${projectPath(projectId)}/handbook/generate`,
      { method: "POST", signal },
    );
  },
  async handbookFile(projectId: string, format: "pdf" | "html") {
    return (
      await request(`${projectPath(projectId)}/handbook.${format}`)
    ).blob();
  },
};
