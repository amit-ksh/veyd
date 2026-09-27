import { prisma } from "@/lib/prisma";
import type { Citation } from "@/lib/chat/types";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server conversation service in client-side code");
}

export type ConversationResponse = {
  conversation: {
    id: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    clientMessageId?: string;
    role: "user" | "assistant";
    content: string;
    citations: Citation[];
    createdAt: string;
  }>;
};

/**
 * Creates a new conversation in PostgreSQL for the authenticated user.
 */
export async function createConversation(userId: string, title?: string) {
  return prisma.conversation.create({
    data: {
      userId,
      title: title || "Compliance Research Chat",
    },
  });
}

/**
 * Retrieves a conversation and its chronologically ordered messages.
 * Scoped strictly to the authenticated user (returns null if non-existent or owned by another user).
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<ConversationResponse | null> {
  const conv = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
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

  return {
    conversation: {
      id: conv.id,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    },
    messages: conv.messages.map((m) => ({
      id: m.id,
      clientMessageId: m.clientMessageId ?? undefined,
      role: m.role as "user" | "assistant",
      content: m.content,
      citations: Array.isArray(m.citations) ? (m.citations as unknown as Citation[]) : [],
      createdAt: m.createdAt.toISOString(),
    })),
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
}) {
  const { conversationId, content, citations } = params;

  return prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        role: "assistant",
        content,
        citations: citations && citations.length > 0 ? (citations as unknown as object) : undefined,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
  });
}
