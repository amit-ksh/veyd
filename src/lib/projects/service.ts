import { prisma } from "@/lib/prisma";
import { AppError, ErrorCodes } from "@/lib/errors";

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lists all projects owned by the authenticated user.
 * Ordered by updatedAt desc, then id asc.
 */
export async function listUserProjects(userId: string): Promise<ProjectSummary[]> {
  if (!userId) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "User ID is required to list projects", 401);
  }

  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { updatedAt: "desc" },
      { id: "asc" },
    ],
  });

  return projects;
}

/**
 * Creates a new project owned by the user.
 * Validates that name is trimmed to 1..100 characters.
 * Duplicate names are allowed. Does not seed records.
 */
export async function createProject(userId: string, name: string): Promise<ProjectSummary> {
  if (!userId) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "User ID is required to create a project", 401);
  }

  const trimmedName = (name ?? "").trim();
  if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 100) {
    throw new AppError(
      ErrorCodes.INVALID_REQUEST,
      "Project name must be between 1 and 100 characters.",
      400
    );
  }

  const project = await prisma.project.create({
    data: {
      ownerId: userId,
      name: trimmedName,
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return project;
}

/**
 * Verifies that a project exists and is owned by the current user.
 * Returns non-enumerating NOT_FOUND (404) if not found or owned by another user.
 */
export async function getAuthorizedProject(
  projectId: string,
  userId: string
): Promise<ProjectSummary> {
  if (!projectId || typeof projectId !== "string") {
    throw new AppError(ErrorCodes.INVALID_REQUEST, "Project ID is required", 400);
  }
  if (!userId) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) {
    // Non-enumerating 404: never reveals whether ID exists under another user
    throw new AppError(ErrorCodes.NOT_FOUND, "Project not found", 404);
  }

  return project;
}

/**
 * Gets the most recently updated project owned by the user.
 * Returns null if the user has no projects.
 */
export async function getMostRecentProject(userId: string): Promise<ProjectSummary | null> {
  if (!userId) return null;

  const project = await prisma.project.findFirst({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return project;
}
