import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { AppError, ErrorCodes } from "@/lib/errors";
import { getAuthorizedProject } from "./service";

export interface McpCredentialMetadata {
  id: string;
  projectId: string;
  label: string;
  tokenHint: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreatedMcpCredential {
  credential: McpCredentialMetadata;
  plaintextToken: string;
}

/**
 * Computes a secure SHA-256 hash of a plaintext MCP token.
 */
export function hashMcpToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

/**
 * Creates a project-bound MCP credential.
 * Generates 32 bytes of secure entropy. Returns the plaintext token once.
 */
export async function createProjectMcpCredential(
  projectId: string,
  userId: string,
  label: string
): Promise<CreatedMcpCredential> {
  // 1. Authorize project ownership
  await getAuthorizedProject(projectId, userId);

  const trimmedLabel = (label ?? "").trim() || "Default MCP Token";
  if (trimmedLabel.length > 100) {
    throw new AppError(ErrorCodes.INVALID_REQUEST, "Credential label must not exceed 100 characters.", 400);
  }

  // 2. Generate 32 bytes of cryptographic randomness
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const plaintextToken = `mcp_${randomBytes}`;
  const tokenHash = hashMcpToken(plaintextToken);
  const tokenHint = `mcp_...${plaintextToken.slice(-6)}`;

  // 3. Save to database
  const credential = await prisma.projectMcpCredential.create({
    data: {
      projectId,
      label: trimmedLabel,
      tokenHash,
      tokenHint,
    },
    select: {
      id: true,
      projectId: true,
      label: true,
      tokenHint: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  return {
    credential,
    plaintextToken,
  };
}

/**
 * Lists all MCP credentials for a project. Returns metadata only, never token material.
 */
export async function listProjectMcpCredentials(
  projectId: string,
  userId: string
): Promise<McpCredentialMetadata[]> {
  await getAuthorizedProject(projectId, userId);

  const credentials = await prisma.projectMcpCredential.findMany({
    where: { projectId },
    select: {
      id: true,
      projectId: true,
      label: true,
      tokenHint: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return credentials;
}

/**
 * Revokes an MCP credential immediately.
 */
export async function revokeProjectMcpCredential(
  projectId: string,
  credentialId: string,
  userId: string
): Promise<McpCredentialMetadata> {
  await getAuthorizedProject(projectId, userId);

  const credential = await prisma.projectMcpCredential.findFirst({
    where: {
      id: credentialId,
      projectId,
    },
  });

  if (!credential) {
    throw new AppError(ErrorCodes.NOT_FOUND, "MCP credential not found", 404);
  }

  const updated = await prisma.projectMcpCredential.update({
    where: { id: credentialId },
    data: { revokedAt: new Date() },
    select: {
      id: true,
      projectId: true,
      label: true,
      tokenHint: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  return updated;
}

export interface ResolvedMcpProject {
  projectId: string;
  credentialId: string;
  label: string;
}

/**
 * Resolves a project from an incoming plaintext MCP bearer token.
 * Returns null if token is unknown, invalid, or revoked.
 * Updates lastUsedAt asynchronously.
 */
export async function resolveProjectFromMcpToken(
  plaintextToken: string
): Promise<ResolvedMcpProject | null> {
  if (!plaintextToken || typeof plaintextToken !== "string") {
    return null;
  }

  const tokenHash = hashMcpToken(plaintextToken);

  const credential = await prisma.projectMcpCredential.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      projectId: true,
      label: true,
      revokedAt: true,
    },
  });

  if (!credential || credential.revokedAt !== null) {
    return null;
  }

  // Update lastUsedAt asynchronously without blocking response
  prisma.projectMcpCredential
    .update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => {
      console.warn("Failed to update lastUsedAt on MCP credential:", err);
    });

  return {
    projectId: credential.projectId,
    credentialId: credential.id,
    label: credential.label,
  };
}
