import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAuthorizedProject } from "@/lib/projects/service";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Veyd | Research Chat",
  description: "Research project knowledge with cited answers",
};

export default async function ProjectChatPage({
  params,
}: {
  params: { projectId: string };
}) {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (session?.user?.id) {
    const project = await getAuthorizedProject(
      params.projectId,
      session.user.id,
    );
    if (!project) {
      notFound();
    }
    return <AppShell initialTab="chat" initialProjectId={params.projectId} />;
  }

  return <AppShell initialTab="chat" initialProjectId={params.projectId} />;
}
