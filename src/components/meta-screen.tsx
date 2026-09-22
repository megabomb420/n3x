import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Youtube } from "lucide-react";
import { useMemo, useState } from "react";
import { findBrawler, loadCatalog } from "@/lib/meta/brawlapi";
import {
  countMentions,
  loadCreatorFeeds,
  namesInTitle,
  otherVideos,
  pickLeadVideo,
  type CreatorFeed,
  type CreatorVideo,
  type MetaFilter,
} from "@/lib/meta/creators";
import { displayBrawlerName } from "@/lib/meta/names";
import { formatRelative } from "@/lib/meta/format";
import type { BrawlerCatalogItem, Catalog } from "@/lib/meta/types";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { Portrait } from "./portrait";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

const FILTERS: Array<{ id: MetaFilter; label: string }> = [
  { id: "tierLists", label: "Tier lists" },
  { id: "everything", label: "Everything" },
];
const MENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The game's meta, as the creators publish it. Titles and dates only — the app
 * never transcribes what is inside a video, because it cannot see it.
 */
export function MetaScreen() {
  const online = useOnline();
  const [filter, setFilter] = useState<MetaFilter>("tierLists");
  const query = useQuery({ queryKey: ["creators"], queryFn: loadCreatorFeeds, refetchInterval: 1_800_000 });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;
  const data = query.data;

  const names = useMemo(() => catalog?.brawlers.map((brawler) => brawler.name) ?? [], [catalog]);
  const mentions = useMemo(
    () => (data ? countMentions(data.channels.flatMap((channel) => channel.entries), names, Date.now() - MENTION_WINDOW_MS) : []),
    [data, names],
  );

  if (query.isLoading) {
    return (
      <div className="px-3">
        <SkeletonRows count={6} />
      </div>
    );
  }
  if (query.isError && !data) {
    return (
      <div className="px-3">
        <ErrorState
          title="Creator feeds unavailable"
          body={query.error instanceof Error ? query.error.message : "Could not read the creator feeds."}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (!data) return null;

  const anyLead = data.channels.some((channel) => pickLeadVideo(channel.entries, filter));

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(data)} /> : null}

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-subtle">
        <Youtube className="mt-0.5 size-3.5 shrink-0 text-muted" />
        What the creators are saying — their newest uploads, straight from their public feeds. Titles and dates only;
        placements inside a video are not transcribed.
      </p>

      <div className="flex gap-1 rounded-full bg-surface p-1">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={cn(
              "min-h-9 flex-1 rounded-full px-3 text-xs font-medium",
              filter === option.id ? "bg-surface-3 text-fg" : "text-subtle",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mentions.length > 0 ? <MentionBoard mentions={mentions} catalog={catalog} /> : null}

      {!anyLead ? (
        <EmptyState
          title={filter === "tierLists" ? "No tier lists in the feed window" : "Nothing new in the feed window"}
          body={
            filter === "tierLists"
              ? "None of the tracked channels has published a tier list or meta video recently. Switch to Everything to see their latest uploads."
              : "The tracked channels have nothing in their current feed window."
          }
        />
      ) : null}

      {data.channels.map((channel) => (
        <CreatorCard key={channel.id} channel={channel} filter={filter} catalog={catalog} />
      ))}

      <p className="pb-2 text-[11px] text-subtle">
        Sources: the creators' public YouTube feeds, read through this app's backend · updated{" "}
        {formatRelative(data.fetchedAt)}
      </p>
    </div>
  );
}

/** Brawlers named most often in the last month's titles — a reading, not a tier list. */
function MentionBoard({
  mentions,
  catalog,
}: {
  mentions: Array<{ name: string; count: number }>;
  catalog: Catalog | null;
}) {
  return (
    <section className="rounded-2xl bg-surface p-3">
      <h2 className="font-display text-lg tracking-wide">Named most in titles</h2>
      <p className="mt-0.5 text-[11px] text-subtle">Last 30 days of uploads, across every tracked channel.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {mentions.map((mention) => {
          const brawler: BrawlerCatalogItem | null = findBrawler(catalog, mention.name);
          return (
            <span
              key={mention.name}
              className="flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-[11px] text-muted"
            >
              <Portrait catalog={brawler} cubeName={mention.name} size={20} decorative />
              {displayBrawlerName(mention.name)}
              <span className="text-gold">{mention.count}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

function CreatorCard({
  channel,
  filter,
  catalog,
}: {
  channel: CreatorFeed;
  filter: MetaFilter;
  catalog: Catalog | null;
}) {
  const lead = pickLeadVideo(channel.entries, filter);
  const others = otherVideos(channel.entries, lead, filter);
  const visible = [lead, ...others].filter((video): video is CreatorVideo => video !== null);
  const chips = [
    ...new Set(
      visible.flatMap((video) => namesInTitle(video.title, catalog?.brawlers.map((brawler) => brawler.name) ?? [])),
    ),
  ]
    .slice(0, 6)
    .map((name) => findBrawler(catalog, name))
    .filter((brawler): brawler is BrawlerCatalogItem => brawler !== null);

  return (
    <section className="rounded-2xl bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg tracking-wide">{channel.name}</h2>
        <a
          href={channel.channelUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted"
        >
          {channel.handle}
          <ExternalLink className="size-3" />
        </a>
      </div>

      {channel.error ? <p className="mt-2 text-xs text-low">Feed unavailable ({channel.error})</p> : null}

      {lead ? (
        <a
          href={lead.watchUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex gap-3 rounded-xl bg-surface-2 p-2"
        >
          <img
            src={lead.thumbnailUrl}
            alt=""
            width={128}
            height={72}
            loading="lazy"
            decoding="async"
            className="h-[72px] w-32 shrink-0 rounded-lg bg-surface-3 object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                {lead.kind ?? "upload"}
              </span>
              <span className="text-[10px] text-subtle">{formatRelative(Date.parse(lead.publishedAt))}</span>
            </span>
            <span className="mt-1 line-clamp-3 block text-sm leading-snug text-fg">{lead.title}</span>
          </span>
        </a>
      ) : (
        <p className="mt-2 text-xs text-subtle">
          {channel.entries.length === 0
            ? "Nothing in the feed window."
            : filter === "tierLists"
              ? `No tier list in the feed window — newest upload ${formatRelative(Date.parse(channel.entries[0].publishedAt))}.`
              : "Nothing to show."}
        </p>
      )}

      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {chips.map((brawler) => (
            <span
              key={brawler.cubeName}
              className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2 text-[11px] text-muted"
            >
              <Portrait catalog={brawler} cubeName={brawler.cubeName} size={18} decorative />
              {displayBrawlerName(brawler.name)}
            </span>
          ))}
        </div>
      ) : null}

      {others.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-0.5">
          {others.map((video) => (
            <li key={video.videoId}>
              <a
                href={video.watchUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-baseline gap-2 rounded-lg px-1 py-1 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{video.title}</span>
                <span className="shrink-0 text-[10px] text-subtle">
                  {formatRelative(Date.parse(video.publishedAt))}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
