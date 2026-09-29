import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAuthorizedProject } from "@/lib/projects/service";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Veyd | Regulatory Documents",
  description: "Upload and manage regulatory compliance documents and rule extraction",
};

export default async function ProjectDocumentsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (session?.user?.id) {
    const project = await getAuthorizedProject(params.projectId, session.user.id);
    if (!project) {
      notFound();
    }
    return <AppShell initialTab="documents" initialProjectId={params.projectId} />;
  }

  return <AppShell initialTab="documents" initialProjectId={params.projectId} />;
}
