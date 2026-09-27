import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getChaptersByIndustry } from "@/lib/sanity/queries";

export default async function HandbookIndex({ params }: { params: { workspaceId: string } }) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: params.workspaceId } });
  const chapters = await getChaptersByIndustry(workspace.industrySlug);

  if (chapters.length === 0) {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-2 text-2xl font-semibold text-brand-700">Handbook</h1>
        <p className="card p-5 text-sm text-slate-500">
          No chapters published yet for industry "{workspace.industrySlug}". Add some in the Sanity Studio
          (<code>industry</code> + <code>chapter</code> documents) and they'll appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-brand-700">Handbook</h1>
      <ol className="space-y-3">
        {chapters.map((chapter) => (
          <li key={chapter._id}>
            <Link
              href={`/workspace/${workspace.id}/handbook/${chapter.slug}`}
              className="card flex items-center justify-between p-4 transition hover:shadow-md"
            >
              <div>
                <p className="font-medium">
                  {chapter.order}. {chapter.title}
                </p>
                <p className="text-sm text-slate-500">{chapter.summary}</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                {chapter.estimatedMinutes} min · {chapter.rules?.length ?? 0} rule
                {chapter.rules?.length === 1 ? "" : "s"}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
