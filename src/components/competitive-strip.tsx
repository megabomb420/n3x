import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { loadCompetitiveReddit } from "@/lib/meta/reddit";
import { formatPublished, decodeEntities } from "@/lib/meta/format";

export function CompetitiveStrip() {
  const query = useQuery({
    queryKey: ["competitive-reddit"],
    queryFn: loadCompetitiveReddit,
    staleTime: 10 * 60_000,
  });
  const posts = query.data?.posts ?? [];
  if (posts.length === 0) return null;

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-subtle">
          Ranked talk
        </h2>
        <Link to="/lists" className="text-xs text-muted">
          All
        </Link>
      </div>
      <div className="flex flex-col gap-1">
        {posts.slice(0, 3).map((post) => (
          <a
            key={post.id}
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-2 rounded-lg bg-surface px-2.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{decodeEntities(post.title)}</span>
            <time dateTime={post.publishedAt} className="shrink-0 text-xs tabular text-subtle">
              {formatPublished(post.publishedAt)}
            </time>
          </a>
        ))}
      </div>
    </section>
  );
}
