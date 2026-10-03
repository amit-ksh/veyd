/** Resource identity only: refreshes invalidate these keys instead of creating new ones. */
export const queryKeys = {
  user: (userId?: string) => ["veyd", "user", userId || ""] as const,
  projects: (userId?: string) =>
    [...queryKeys.user(userId), "projects"] as const,
  project: (userId: string | undefined, projectId: string) =>
    [...queryKeys.user(userId), "project", projectId] as const,
  documents: (userId: string | undefined, projectId: string) =>
    [...queryKeys.project(userId, projectId), "documents"] as const,
  conversations: (userId: string | undefined, projectId: string) =>
    [...queryKeys.project(userId, projectId), "conversations"] as const,
  history: (userId: string | undefined, projectId: string) =>
    [...queryKeys.conversations(userId, projectId), "list"] as const,
  conversation: (userId: string | undefined, projectId: string, id: string) =>
    [...queryKeys.conversations(userId, projectId), "detail", id] as const,
  credentials: (userId: string | undefined, projectId: string) =>
    [...queryKeys.project(userId, projectId), "credentials"] as const,
  handbook: (userId: string | undefined, projectId: string) =>
    [...queryKeys.project(userId, projectId), "handbook"] as const,
};
