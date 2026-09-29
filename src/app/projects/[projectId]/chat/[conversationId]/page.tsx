import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAuthorizedProject } from "@/lib/projects/service";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Veyd | Compliance Research Chat",
  description: "AI-assisted compliance research and regulation handbook",
};

export default async function ProjectExistingChatPage({
  params,
}: {
  params: { projectId: string; conversationId: string };
}) {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (session?.user?.id) {
    const project = await getAuthorizedProject(params.projectId, session.user.id);
    if (!project) {
      notFound();
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.conversationId,
        userId: session.user.id,
        projectId: params.projectId,
      },
      select: { id: true },
    });

    if (!conversation) {
      notFound();
    }

    return (
      <AppShell
        initialTab="chat"
        initialProjectId={params.projectId}
        initialConversationId={params.conversationId}
      />
    );
  }

  return (
    <AppShell
      initialTab="chat"
      initialProjectId={params.projectId}
      initialConversationId={params.conversationId}
    />
  );
}
