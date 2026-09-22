import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Youtube } from "lucide-react";
import { loadCatalog } from "@/lib/meta/brawlapi";
import { loadCreators, type CreatorEntry, type CreatorVideo } from "@/lib/meta/creators";
import { displayBrawlerName } from "@/lib/meta/names";
import { formatRelative } from "@/lib/meta/format";
import type { BrawlerCatalogItem, Catalog } from "@/lib/meta/types";
import { useOnline } from "@/hooks/use-online";
import { Portrait } from "./portrait";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

/** Brawlers named in the titles this card shows, so the list reads at a glance. */
function brawlersInTitles(titles: string[], catalog: Catalog | null): BrawlerCatalogItem[] {
  if (!catalog || titles.length === 0) return [];
  const found = new Map<string, BrawlerCatalogItem>();
  for (const brawler of catalog.brawlers) {
    if (brawler.name.length < 3) continue;
    const pattern = new RegExp(`\\b${brawler.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!titles.some((title) => pattern.test(title))) continue;
    found.set(brawler.cubeName, brawler);
    if (found.size >= 6) break;
  }
  return [...found.values()];
}

/**
 * The game's meta, as the creators publish it: their newest tier lists and meta
 * uploads. Titles and dates only — placements inside a video are never
 * transcribed, because the app cannot see them.
 */
export function MetaScreen() {
  const online = useOnline();
  const query = useQuery({ queryKey: ["creators"], queryFn: loadCreators, refetchInterval: 1_800_000 });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;
  const data = query.data;

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

  const anything = data.creators.some((creator) => creator.list || creator.recent.length > 0);

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(data)} /> : null}

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-subtle">
        <Youtube className="mt-0.5 size-3.5 shrink-0 text-muted" />
        What the creators are saying — their newest tier-list and meta uploads, straight from their public feeds.
        Titles and dates only; placements inside a video are not transcribed.
      </p>

      {!anything ? (
        <EmptyState
          title="No tier lists in the feed window"
          body="The creator feeds carry no tier-list or meta upload right now. Their newest uploads still show below each channel."
        />
      ) : null}

      {data.creators.map((creator) => (
        <CreatorCard key={creator.id} creator={creator} catalog={catalog} />
      ))}

      <p className="pb-2 text-[11px] text-subtle">
        Source: YouTube RSS through this app's backend · updated {formatRelative(data.fetchedAt)}
      </p>
    </div>
  );
}

function CreatorCard({ creator, catalog }: { creator: CreatorEntry; catalog: Catalog | null }) {
  const videos = [creator.list, ...creator.recent].filter((video): video is CreatorVideo => video !== null);
  const chips = brawlersInTitles(videos.map((video) => video.title), catalog);

  return (
    <section className="rounded-2xl bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg tracking-wide">{creator.name}</h2>
        <a
          href={creator.channelUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted"
        >
          {creator.handle}
          <ExternalLink className="size-3" />
        </a>
      </div>

      {creator.error ? <p className="mt-2 text-xs text-low">Feed unavailable ({creator.error})</p> : null}

      {creator.list ? (
        <a
          href={creator.list.watchUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex gap-3 rounded-xl bg-surface-2 p-2"
        >
          <img
            src={creator.list.thumbnailUrl}
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
                {creator.list.kind}
              </span>
              <span className="text-[10px] text-subtle">
                {formatRelative(Date.parse(creator.list.publishedAt))}
              </span>
            </span>
            <span className="mt-1 line-clamp-3 block text-sm leading-snug text-fg">{creator.list.title}</span>
          </span>
        </a>
      ) : (
        <p className="mt-2 text-xs text-subtle">
          {creator.latest
            ? `No tier list in the feed window — newest upload ${formatRelative(Date.parse(creator.latest.publishedAt))}.`
            : "Nothing in the feed window."}
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

      {creator.recent.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-0.5">
          {creator.recent.map((video) => (
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
