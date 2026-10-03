import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMostRecentProject } from "@/lib/projects/service";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Veyd | Research Chat",
  description: "Research project knowledge with cited answers",
};

export default async function ChatPage() {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (session?.user?.id) {
    const recentProject = await getMostRecentProject(session.user.id);
    if (recentProject) {
      redirect(`/projects/${recentProject.id}/chat`);
    }
  }

  return <AppShell initialTab="chat" />;
}
