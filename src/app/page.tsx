import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMostRecentProject } from "@/lib/projects/service";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (session?.user?.id) {
    const recent = await getMostRecentProject(session.user.id);
    if (recent) {
      redirect(`/projects/${recent.id}/chat`);
    }
  }

  redirect("/chat");
}
