import { prisma } from "@/lib/prisma";
import type { Citation, PresentedCitation } from "@/lib/chat/types";
import {
  readMessageMetadata,
  messageMetadata,
  type ChatFile,
} from "@/lib/chat-files/types";

if (typeof window !== "undefined") {
  throw new Error(
    "Cannot import server conversation service in client-side code",
  );
}

export type ConversationResponse = {
  conversation: {
    id: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    clientMessageId?: string;
    role: "user" | "assistant";
    content: string;
    citations: PresentedCitation[];
    files: ChatFile[];
    createdAt: string;
  }>;
};

/**
 * Creates a new conversation in PostgreSQL for the authenticated user and project.
 */
export async function createConversation(
  userId: string,
  projectId: string,
  title?: string,
) {
  if (!projectId) {
    throw new Error("projectId is required to create a conversation");
  }

  return prisma.conversation.create({
    data: {
      userId,
      projectId,
      title: title || "Compliance Research Chat",
    },
  });
}

/**
 * Retrieves a conversation and its chronologically ordered messages.
 * Scoped strictly to the authenticated user and optional projectId (returns null if non-existent or owned by another user/project).
 * Annotates citations with tombstone removal status.
 */
export async function getConversation(
  conversationId: string,
  userId: string,
  projectId?: string,
): Promise<ConversationResponse | null> {
  const conv = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
      ...(projectId ? { projectId } : {}),
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!conv) {
    return null;
  }

  // Fetch tombstones in this project to annotate removed citations
  const tombstones = await prisma.removedComplianceSource.findMany({
    where: {
      projectId: conv.projectId,
      deletionStatus: { in: ["pending", "deleting", "complete", "failed"] },
    },
    select: {
      documentId: true,
      documentTitle: true,
      removedAt: true,
    },
  });

  const removedDocsMap = new Map(tombstones.map((t) => [t.documentId, t]));

  return {
    conversation: {
      id: conv.id,
      projectId: conv.projectId,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    },
    messages: conv.messages.map((m) => {
      const metadata = readMessageMetadata(m.citations);
      const rawCitations = metadata.citations;
      const presentedCitations: PresentedCitation[] = rawCitations.map((c) => {
        const tombstone = c.documentId
          ? removedDocsMap.get(c.documentId)
          : undefined;
        if (tombstone) {
          return {
            ...c,
            url: undefined, // Internal link disabled
            documentTitle: c.documentTitle || tombstone.documentTitle,
            availability: "removed" as const,
            removedAt: tombstone.removedAt.toISOString(),
          };
        }
        return {
          ...c,
          availability: "active" as const,
        };
      });

      return {
        id: m.id,
        clientMessageId: m.clientMessageId ?? undefined,
        role: m.role as "user" | "assistant",
        content: m.content,
        citations: presentedCitations,
        files: metadata.files.map((file) =>
          file.documentId && removedDocsMap.has(file.documentId)
            ? { ...file, status: "removed" as const, retryable: false }
            : file,
        ),
        createdAt: m.createdAt.toISOString(),
      };
    }),
  };
}

/**
 * Appends a user message to an existing conversation with duplicate submission prevention.
 */
export async function appendUserMessage(params: {
  conversationId: string;
  userId: string;
  content: string;
  clientMessageId?: string;
}): Promise<{
  message: {
    id: string;
    clientMessageId?: string | null;
    role: string;
    content: string;
    createdAt: Date;
  };
  isDuplicate: boolean;
}> {
  const { conversationId, userId, content, clientMessageId } = params;

  // 1. Verify user owns this conversation
  const conv = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    select: { id: true },
  });

  if (!conv) {
    throw new Error("Conversation not found or unauthorized");
  }

  // 2. Uniqueness check for repeated submission with identical clientMessageId
  if (clientMessageId) {
    const existing = await prisma.message.findFirst({
      where: {
        conversationId,
        clientMessageId,
      },
    });

    if (existing) {
      return {
        message: existing,
        isDuplicate: true,
      };
    }
  }

  // 3. Persist new user message
  const created = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        role: "user",
        content,
        clientMessageId: clientMessageId ?? null,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
  });

  return {
    message: created,
    isDuplicate: false,
  };
}

/**
 * Appends an assistant response and final citations to the conversation upon stream completion.
 */
export async function appendAssistantMessage(params: {
  conversationId: string;
  content: string;
  citations?: Citation[];
  files?: ChatFile[];
}) {
  const { conversationId, content, citations, files } = params;

  return prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        role: "assistant",
        content,
        citations: files?.length
          ? messageMetadata(citations || [], files)
          : citations && citations.length > 0
            ? (citations as unknown as object)
            : undefined,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
  });
}
