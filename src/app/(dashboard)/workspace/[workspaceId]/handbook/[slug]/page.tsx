import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { getChapterBySlug } from "@/lib/sanity/queries";
import { RuleCard } from "@/components/RuleCard";
import { ChapterProgressButton } from "@/components/ChapterProgressButton";

export default async function ChapterPage({
  params,
}: {
  params: { workspaceId: string; slug: string };
}) {
  const chapter = await getChapterBySlug(params.slug);
  if (!chapter) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Chapter {chapter.order} · {chapter.estimatedMinutes} min read
        </p>
        <h1 className="text-2xl font-semibold text-brand-700">{chapter.title}</h1>
      </div>

      <article className="card prose prose-slate max-w-none p-6 text-sm leading-relaxed">
        {chapter.body ? (
          <PortableText value={chapter.body as any} />
        ) : (
          <p className="text-slate-400">No content written for this chapter yet.</p>
        )}
      </article>

      {chapter.rules?.length > 0 && (
        <div>
          <h2 className="mb-3 font-medium">Rules covered in this chapter</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {chapter.rules.map((rule) => (
              <RuleCard key={rule._id} rule={rule} />
            ))}
          </div>
        </div>
      )}

      <ChapterProgressButton workspaceId={params.workspaceId} chapterSlug={chapter.slug} />
    </div>
  );
}
