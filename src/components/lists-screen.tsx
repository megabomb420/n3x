import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { loadCreatorLists, loadCommunityVotes, kindLabel, type CreatorList } from "@/lib/meta/creators";
import {
  loadCompetitiveReddit,
  competitiveKindLabel,
  type CompetitivePost,
} from "@/lib/meta/reddit";
import { formatPicks, formatPublished, formatRelative, decodeEntities } from "@/lib/meta/format";
import { displayBrawlerName } from "@/lib/meta/names";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";
import { Portrait } from "./portrait";
import { useOnline } from "@/hooks/use-online";
import { useState } from "react";

export function ListsScreen() {
  const online = useOnline();
  const query = useQuery({
    queryKey: ["creator-lists"],
    queryFn: loadCreatorLists,
  });
  const votes = useQuery({
    queryKey: ["community-votes"],
    queryFn: loadCommunityVotes,
  });
  const reddit = useQuery({
    queryKey: ["competitive-reddit"],
    queryFn: loadCompetitiveReddit,
    staleTime: 10 * 60_000,
  });

  const lists = query.data?.lists ?? [];
  const community = votes.data;
  const posts = reddit.data?.posts ?? [];

  return (
    <div className="flex flex-col gap-3 px-3">
      <p className="text-xs leading-relaxed text-muted">
        Ranked talk from r/BrawlStarsCompetitive, plus the latest creator lists from YouTube.
        Dates are publish times. Rankings inside a thread or video are theirs — not club
        battle data.
      </p>

      {!online ? (
        <OfflineBanner
          stale={query.data?.freshness === "stale" || reddit.data?.freshness === "stale"}
        />
      ) : null}

      {reddit.isLoading ? <SkeletonRows count={3} /> : null}
      {reddit.isError && !reddit.data ? (
        <ErrorState
          title="Can't load Ranked talk"
          body={
            reddit.error instanceof Error
              ? reddit.error.message
              : "The competitive subreddit feed is temporarily unavailable."
          }
          onRetry={() => void reddit.refetch()}
        />
      ) : null}

      {posts.length > 0 ? (
        <section>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg tracking-wide">Ranked talk</h2>
            <span className="text-xs text-subtle">r/BrawlStarsCompetitive</span>
          </div>
          <ul className="flex flex-col gap-2">
            {posts.map((post) => (
              <li key={post.id}>
                <RedditCard post={post} />
              </li>
            ))}
          </ul>
          <a
            href="https://www.reddit.com/r/BrawlStarsCompetitive"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs text-muted"
          >
            Open subreddit
            <ExternalLink className="size-3" />
          </a>
        </section>
      ) : null}

      {query.isLoading ? <SkeletonRows count={4} /> : null}
      {query.isError && !query.data ? (
        <ErrorState
          title="Can't load creator lists"
          body={
            query.error instanceof Error
              ? query.error.message
              : "YouTube feeds are temporarily unavailable."
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && lists.length === 0 ? (
        <EmptyState
          title="No recent lists"
          body="None of the tracked channels published a tier list in their last uploads."
        />
      ) : null}

      {lists.length > 0 ? (
        <section>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg tracking-wide">Creator lists</h2>
            <span className="text-xs text-subtle">YouTube</span>
          </div>
          <ul className="flex flex-col gap-2">
            {lists.map((list) => (
              <li key={list.creator.id}>
                <CreatorCard list={list} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {community && community.rows.length > 0 ? (
        <section className="rounded-xl bg-surface p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg tracking-wide">Community vote</h2>
            <span className="text-xs text-subtle">
              {community.lastVoteAt
                ? `Last vote ${formatRelative(community.lastVoteAt)}`
                : "This season"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Brawl Time Ninja players · {formatPicks(community.sampleSize)} votes this season
          </p>
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
            {community.rows.slice(0, 10).map((row, i) => (
              <div key={row.cubeName} className="flex w-12 shrink-0 flex-col items-center gap-0.5">
                <Portrait catalog={row.catalog} cubeName={row.cubeName} size={36} decorative />
                <span className="w-full truncate text-center text-xs leading-tight text-subtle">
                  {i + 1}
                </span>
                <span className="w-full truncate text-center text-xs leading-tight">
                  {row.catalog?.name ?? displayBrawlerName(row.cubeName)}
                </span>
              </div>
            ))}
          </div>
          <a
            href="https://brawltime.ninja/tier-list/brawler"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs text-muted"
          >
            Full vote list
            <ExternalLink className="size-3" />
          </a>
        </section>
      ) : null}
    </div>
  );
}

function RedditCard({ post }: { post: CompetitivePost }) {
  const [hideThumb, setHideThumb] = useState(false);
  const showThumb = Boolean(post.thumbnailUrl) && !hideThumb;
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noreferrer"
      className="flex gap-3 rounded-xl bg-surface p-2 transition-transform duration-150 ease-out active:scale-[0.99]"
    >
      {showThumb ? (
        <img
          src={post.thumbnailUrl ?? undefined}
          alt=""
          width={112}
          height={64}
          className="h-16 w-28 shrink-0 rounded-md bg-surface-2 object-cover"
          onError={() => setHideThumb(true)}
        />
      ) : null}
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">u/{post.author}</span>
          <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs uppercase tracking-wider text-ranked">
            {competitiveKindLabel(post.kind)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-fg">{decodeEntities(post.title)}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <time dateTime={post.publishedAt}>{formatPublished(post.publishedAt)}</time>
          <span aria-hidden>·</span>
          <span>{formatRelative(post.publishedAt)}</span>
        </p>
      </div>
    </a>
  );
}

function CreatorCard({ list }: { list: CreatorList }) {
  return (
    <a
      href={list.watchUrl}
      target="_blank"
      rel="noreferrer"
      className="flex gap-3 rounded-xl bg-surface p-2 transition-transform duration-150 ease-out active:scale-[0.99]"
    >
      <img
        src={list.thumbnailUrl}
        alt=""
        width={112}
        height={64}
        className="h-16 w-28 shrink-0 rounded-md bg-surface-2 object-cover"
      />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{list.creator.name}</span>
          <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs uppercase tracking-wider text-subtle">
            {kindLabel(list.kind)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-fg">{decodeEntities(list.title)}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <time dateTime={list.publishedAt}>{formatPublished(list.publishedAt)}</time>
          <span aria-hidden>·</span>
          <span>{formatRelative(list.publishedAt)}</span>
        </p>
      </div>
    </a>
  );
}
