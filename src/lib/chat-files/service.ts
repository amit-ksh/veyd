import { z } from "zod";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getAuthorizedProject } from "@/lib/projects/service";
import { createConversation } from "@/lib/conversations/service";
import {
  ingestDocument,
  ingestPdfBuffer,
  isBlobUrlAuthorized,
} from "@/lib/ingestion/service";
import {
  AppError,
  ConflictError,
  InvalidRequestError,
  NotFoundError,
} from "@/lib/errors";
import { acquireImportLease } from "./lease";
import { downloadPublicPdf } from "./public-pdf";
import {
  messageMetadata,
  readMessageMetadata,
  type ChatFile,
  type ChatFileResult,
} from "./types";
import { checkRateLimit } from "@/lib/rate-limit";
import { RateLimitedError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const chatFileInputSchema = z
  .object({
    projectId: z.string().min(1).max(200),
    confirmProjectId: z.string().min(1).max(200),
    requestId: z.string().uuid(),
    conversationId: z.string().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(200),
    source: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("upload"),
          blobUrl: z.string().url().max(2048),
          fileName: z.string().min(1).max(255),
          byteSize: z.number().int().min(1).max(10_485_760),
        })
        .strict(),
      z
        .object({
          kind: z.literal("web"),
          messageId: z.string().min(1).max(200),
          fileId: z.string().min(1).max(100),
        })
        .strict(),
    ]),
  })
  .strict();

export function chatUploadPath(projectId: string, requestId: string) {
  return "chat/" + projectId + "/" + requestId + ".pdf";
}

async function saveFile(messageId: string, file: ChatFile) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new NotFoundError("Chat file not found.");
  const metadata = readMessageMetadata(message.citations);
  const files = metadata.files.map((item) =>
    item.id === file.id ? file : item,
  );
  await prisma.$transaction([
    prisma.message.update({
      where: { id: messageId },
      data: { citations: messageMetadata(metadata.citations, files) },
    }),
    prisma.conversation.update({
      where: { id: message.conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

/** The model never calls this service. Routes require explicit project confirmation. */
export async function importChatFile(
  input: z.infer<typeof chatFileInputSchema>,
  scope: {
    userId: string;
    projectId: string;
    clientIp: string;
    correlationId: string;
    signal?: AbortSignal;
  },
): Promise<ChatFileResult> {
  if (
    input.projectId !== scope.projectId ||
    input.confirmProjectId !== scope.projectId
  )
    throw new InvalidRequestError(
      "Confirm the currently selected destination project.",
    );
  const project = await getAuthorizedProject(scope.projectId, scope.userId);
  if (
    input.conversationId &&
    !(await prisma.conversation.findFirst({
      where: {
        id: input.conversationId,
        userId: scope.userId,
        projectId: project.id,
      },
      select: { id: true },
    }))
  )
    throw new NotFoundError("Conversation not found.");
  if (input.source.kind === "web" && !input.conversationId)
    throw new InvalidRequestError(
      "An existing research conversation is required.",
    );
  if (input.source.kind === "upload") {
    const url = new URL(input.source.blobUrl);
    if (
      !isBlobUrlAuthorized(url.href) ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" + chatUploadPath(project.id, input.requestId)
    )
      throw new InvalidRequestError(
        "This temporary upload does not belong to the confirmed project.",
      );
  }

  const release = await acquireImportLease(project.id);
  const discardDuplicateUpload = async () => {
    if (input.source.kind !== "upload") return;
    try {
      await del(input.source.blobUrl);
    } catch {
      logger.warn("duplicate_chat_blob_delete_failed", {
        correlationId: scope.correlationId,
      });
    }
  };
  let result: ChatFileResult | null = null;
  let pipelineEntered = false;
  try {
    if (input.source.kind === "web") {
      const fileId = input.source.fileId;
      const message = await prisma.message.findFirst({
        where: {
          id: input.source.messageId,
          role: "assistant",
          conversationId: input.conversationId,
          conversation: { userId: scope.userId, projectId: project.id },
        },
      });
      const file =
        message &&
        readMessageMetadata(message.citations).files.find(
          (item) => item.id === fileId,
        );
      if (!message || !file || file.origin === "upload" || !file.url)
        throw new NotFoundError("Research PDF not found.");
      result = {
        conversationId: message.conversationId,
        messageId: message.id,
        file,
      };
    } else {
      const existing = await prisma.message.findFirst({
        where: {
          clientMessageId: "chat-file:" + input.requestId,
          conversation: { userId: scope.userId, projectId: project.id },
        },
      });
      if (existing) {
        if (
          input.conversationId &&
          existing.conversationId !== input.conversationId
        )
          throw new NotFoundError("Chat file not found.");
        const file = readMessageMetadata(existing.citations).files.find(
          (item) => item.id === input.requestId,
        );
        if (!file)
          throw new ConflictError(
            "The existing import receipt could not be read. Review Documents.",
          );
        result = {
          conversationId: existing.conversationId,
          messageId: existing.id,
          file,
        };
      } else {
        const conversationId =
          input.conversationId ||
          (await createConversation(scope.userId, project.id, input.title)).id;
        const file: ChatFile = {
          id: input.requestId,
          title: input.title,
          origin: "upload",
          status: "available",
          fileName: input.source.fileName,
          byteSize: input.source.byteSize,
        };
        const message = await prisma.message.create({
          data: {
            conversationId,
            role: "user",
            content: "PDF import: " + input.title,
            clientMessageId: "chat-file:" + input.requestId,
            citations: messageMetadata([], [file]),
          },
        });
        result = { conversationId, messageId: message.id, file };
      }
    }
    if (
      result.file.documentId &&
      (await prisma.removedComplianceSource.findUnique({
        where: {
          projectId_documentId: {
            projectId: project.id,
            documentId: result.file.documentId,
          },
        },
        select: { id: true },
      }))
    ) {
      result.file = { ...result.file, status: "removed", retryable: false };
      await discardDuplicateUpload();
      return result;
    }
    if (result.file.status === "ready" || result.file.status === "removed") {
      await discardDuplicateUpload();
      return result;
    }
    if (
      result.file.status === "processing" ||
      (result.file.status === "failed" && !result.file.retryable)
    ) {
      return {
        ...result,
        file: {
          ...result.file,
          error:
            "This import may already have stored a document. Review Documents before starting another import.",
        },
      };
    }
    if (input.source.kind === "web") {
      const limit = await checkRateLimit("ingestion", scope.clientIp);
      if (!limit.success)
        throw new RateLimitedError(
          "You can add up to 5 documents per hour.",
          limit.retryAfter,
        );
    }
    result.file = {
      ...result.file,
      title: input.title,
      status: "processing",
      error: undefined,
      retryable: false,
    };
    await saveFile(result.messageId, result.file);
    const params = {
      projectId: project.id,
      title: input.title,
      industry: project.name,
      signal: scope.signal,
    };
    let ingested;
    if (input.source.kind === "web") {
      const bytes = await downloadPublicPdf(result.file.url!, scope.signal);
      pipelineEntered = true;
      ingested = await ingestPdfBuffer(params, bytes, scope.correlationId);
    } else {
      pipelineEntered = true;
      ingested = await ingestDocument(
        { ...params, blobUrl: input.source.blobUrl },
        scope.correlationId,
      );
    }
    result.file = {
      ...result.file,
      status: "ready",
      documentId: ingested.document.id,
      pageCount: ingested.document.pageCount,
      extractedRuleCount: ingested.document.extractedRuleCount,
      error: undefined,
      retryable: false,
    };
    await saveFile(result.messageId, result.file);
    logger.info("chat_file_import_ready", {
      correlationId: scope.correlationId,
      projectId: project.id,
      messageId: result.messageId,
      documentId: result.file.documentId,
    });
    return result;
  } catch (error) {
    if (!result || result.file.status !== "processing") throw error;
    const details =
      error instanceof AppError &&
      error.details &&
      typeof error.details === "object"
        ? (error.details as { documentId?: string; storageStarted?: boolean })
        : {};
    result.file = {
      ...result.file,
      status: "failed",
      documentId: result.file.documentId || details.documentId,
      error: (error instanceof AppError
        ? error.message
        : "Import status could not be confirmed. Review Documents."
      ).slice(0, 500),
      retryable: !pipelineEntered || details.storageStarted === false,
    };
    await saveFile(result.messageId, result.file);
    logger.warn("chat_file_import_failed", {
      correlationId: scope.correlationId,
      projectId: project.id,
      messageId: result.messageId,
      documentId: result.file.documentId,
      errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
    });
    return result;
  } finally {
    await release();
  }
}
