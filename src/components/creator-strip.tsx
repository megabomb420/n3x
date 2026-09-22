import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { loadCreatorLists } from "@/lib/meta/creators";
import { formatPublished, decodeEntities } from "@/lib/meta/format";

export function CreatorStrip() {
  const query = useQuery({
    queryKey: ["creator-lists"],
    queryFn: loadCreatorLists,
    staleTime: 10 * 60_000,
  });
  const lists = query.data?.lists ?? [];
  if (lists.length === 0) return null;

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-subtle">Creator lists</h2>
        <Link to="/lists" className="text-[11px] text-muted">
          All
        </Link>
      </div>
      <div className="flex flex-col gap-1">
        {lists.slice(0, 3).map((list) => (
          <Link
            key={list.creator.id}
            to="/lists"
            className="flex min-h-11 items-center gap-2 rounded-lg bg-surface px-2.5"
          >
            <span className="w-20 shrink-0 truncate text-sm font-medium">{list.creator.name}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{decodeEntities(list.title)}</span>
            <time
              dateTime={list.publishedAt}
              className="shrink-0 text-[11px] tabular text-subtle"
            >
              {formatPublished(list.publishedAt)}
            </time>
          </Link>
        ))}
      </div>
    </section>
  );
}
