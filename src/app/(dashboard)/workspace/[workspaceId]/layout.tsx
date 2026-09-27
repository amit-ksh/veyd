import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  const session = await auth.api.getSession({ headers: headers() });
  if (!session) redirect("/");

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
    include: { workspace: true },
  });
  if (!membership) notFound();

  return (
    <div className="flex">
      <Sidebar workspaceId={membership.workspace.id} workspaceName={membership.workspace.name} />
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
