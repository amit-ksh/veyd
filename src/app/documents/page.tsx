import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMostRecentProject } from "@/lib/projects/service";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Veyd | Regulatory Documents",
  description: "Upload and manage regulatory compliance documents and rule extraction",
};

export default async function DocumentsPage() {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (session?.user?.id) {
    const recentProject = await getMostRecentProject(session.user.id);
    if (recentProject) {
      redirect(`/projects/${recentProject.id}/documents`);
    }
  }

  return <AppShell initialTab="documents" />;
}
