import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChatConversationRedirectPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (!session?.user?.id) {
    notFound();
  }

  const conv = await prisma.conversation.findFirst({
    where: {
      id: params.conversationId,
      userId: session.user.id,
    },
    select: { id: true, projectId: true },
  });

  if (!conv) {
    notFound();
  }

  redirect(`/projects/${conv.projectId}/chat/${conv.id}`);
}
