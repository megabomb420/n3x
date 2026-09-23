/**
 * One map: its picture, whether it is in the live rotation, the publisher's
 * global numbers for it, and what this club has actually done on it.
 *
 * The official API publishes no global win or pick rates at all, so the global
 * part is the publisher's own reading — one population, no trophy split — and
 * says so. Its table is shown in the publisher's own order, which is that map's
 * ranking, with the publisher's overall tier next to each name as a badge: the
 * tiers are not map-specific, and grouping by them buried the best brawlers for
 * the map in the middle of the list.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { battlesOnMap, battlesWithoutResult, loadClubLogs } from "@/lib/club/stats-loader";
import { useT, type StringKey } from "@/lib/i18n/provider";
import { loadMapStats, type MapStatBucket } from "@/lib/maps/map-stats";
import { findMapEvent, formatWindow, loadRotation } from "@/lib/maps/rotation";
import { findBrawler, findMap, loadCatalog } from "@/lib/meta/brawlapi";
import { formatPicks } from "@/lib/meta/format";
import { displayBrawlerName, titleCaseMode } from "@/lib/meta/names";
import { useOnline } from "@/hooks/use-online";
import { BattleRow } from "./battle-row";
import { MapArt } from "./map-art";
import { MapPicture } from "./map-picture";
import { Portrait } from "./portrait";
import { RateBar } from "./stat-rows";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

/** How many of our own battles the map's page lists. */
const RECENT = 12;

/** The publisher's four lists, in its own words, as keys we can translate. */
const BUCKET_KEYS: Record<MapStatBucket["kind"], StringKey | null> = {
  picks: "map.bucket.picks",
  winners: "map.bucket.winners",
  mostUsed: "map.bucket.mostUsed",
  notRecommended: "map.bucket.notRecommended",
  other: null,
};

export function MapScreen({ map }: { map: string }) {
  const t = useT();
  const online = useOnline();
  const [picture, setPicture] = useState(false);

  const logs = useQuery({
    queryKey: ["club-logs"],
    queryFn: loadClubLogs,
    refetchInterval: 300_000,
  });
  const rotation = useQuery({ queryKey: ["rotation"], queryFn: loadRotation });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;
  const status = useMemo(() => findMapEvent(rotation.data, map), [rotation.data, map]);
  const art = catalog ? findMap(catalog, map, status?.event.mode) : null;
  const stats = useQuery({
    queryKey: ["map-stats", map, art?.modeName ?? null],
    queryFn: () => loadMapStats(map, art?.modeName ?? null),
  });
  const global = stats.data;

  const bundle = logs.data;
  const recent = useMemo(
    () => (bundle ? battlesOnMap(bundle.logs, map, 30).slice(0, RECENT) : []),
    [bundle, map],
  );
  const names = useMemo(
    () => new Map((bundle?.members ?? []).map((entry) => [entry.tag, entry.name])),
    [bundle],
  );
  const unpublished = useMemo(
    () => (bundle ? battlesWithoutResult(bundle.logs, map) : 0),
    [bundle, map],
  );

  if (logs.isLoading) {
    return (
      <div className="px-3">
        <SkeletonRows count={8} />
      </div>
    );
  }
  if (logs.isError && !bundle) {
    return (
      <div className="px-3">
        <ErrorState
          title={t("state.map.title")}
          body={logs.error instanceof Error ? logs.error.message : t("state.map.body")}
          onRetry={() => void logs.refetch()}
        />
      </div>
    );
  }
  if (!bundle) return null;

  // What the publisher's column is called: Showdown ranks by placement, so its
  // figure is never shown under a win-rate label.
  const top4 = global?.metric === "top4";
  const metricLabel = top4 ? t("map.top4Rate") : t("stats.winRate");
  const secondaryLabel = top4 ? t("map.games") : t("map.useRate");

  return (
    <div className="flex flex-col gap-3 px-3">
      <Link to="/maps/" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted">
        <ChevronLeft className="size-4" /> {t("nav.maps")}
      </Link>

      {!online ? <OfflineBanner stale /> : null}

      <section className="rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        <button
          type="button"
          onClick={() => setPicture(true)}
          className="block w-full overflow-hidden rounded-2xl text-left"
        >
          <div className="relative flex aspect-[4/5] items-center justify-center bg-surface-2">
            <MapArt
              mapArt={art?.imageUrl ?? null}
              modeArt={art?.modeImage ?? null}
              alt={map}
              fit="contain"
              className="bleed h-full w-full"
            />
            {status?.live ? (
              <span className="absolute right-2 top-2 rounded-full bg-win px-2 py-0.5 text-[10px] font-medium text-bg">
                {t("maps.active")}
              </span>
            ) : null}
          </div>
          <div className="px-3 py-2.5">
            <h2 className="font-display text-2xl leading-none tracking-wide">{map}</h2>
            <p className="mt-1 text-xs text-muted">
              {status
                ? `${status.event.mode ? titleCaseMode(status.event.mode) : t("maps.modeUnknown")} · ${formatWindow(status.event.startTime, status.event.endTime, t)}`
                : t("map.notLive")}
            </p>
            <p className="mt-1 text-[11px] text-subtle">{t("map.pictureHint")}</p>
          </div>
        </button>
      </section>

      {stats.isError && !global ? (
        <ErrorState
          title={t("state.map.title")}
          body={stats.error instanceof Error ? stats.error.message : t("state.map.body")}
          onRetry={() => void stats.refetch()}
        />
      ) : null}
      {stats.isLoading ? <SkeletonRows count={6} /> : null}

      {global && global.rows.length > 0 ? (
        <>
          <section className="rounded-2xl bg-surface p-4">
            <p className="text-xs uppercase tracking-wider text-subtle">{t("map.global")}</p>
            <p className="mt-1 font-display text-3xl leading-none tracking-wide">
              {formatPicks(global.sampleBattles)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("map.sampleBy", { source: global.source })}
            </p>
            <p className="mt-2 text-[11px] text-subtle">
              {global.updatedAt ? t("map.published", { when: global.updatedAt }) : ""}
              {global.stale ? ` · ${t("meta.noteStale")}` : ""}
            </p>
            <p className="mt-2 text-[11px] text-low">{t("map.noSplit")}</p>
          </section>

          {global.buckets.map((bucket) => (
            <BucketSection key={`${bucket.kind}-${bucket.title}`} bucket={bucket} />
          ))}

          <section>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg tracking-wide">{t("map.table")}</h2>
              <span className="shrink-0 text-[11px] text-subtle">
                {t("meta.brawlersCount", { count: global.rows.length })}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {global.rows.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2"
                >
                  <Portrait
                    catalog={findBrawler(catalog, row.name.toUpperCase())}
                    cubeName={row.name.toUpperCase()}
                    size={32}
                    decorative
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">
                      {displayBrawlerName(row.name.toUpperCase())}
                      <span className="ml-1.5 rounded bg-surface-2 px-1 py-0.5 align-middle text-[10px] text-subtle">
                        {row.tier}
                      </span>
                    </p>
                    <p className="truncate text-[10px] text-subtle">{row.role ?? ""}</p>
                  </div>
                  <RateBar rate={row.winRate / 100} className="w-14 shrink-0" />
                  <div className="w-12 shrink-0 text-right">
                    <p className="text-sm text-fg">{Math.round(row.winRate)}%</p>
                    <p className="text-[10px] text-subtle">{metricLabel}</p>
                  </div>
                  <div className="w-12 shrink-0 text-right">
                    <p className="text-xs text-muted">
                      {row.useRate == null
                        ? row.games == null
                          ? "—"
                          : formatPicks(row.games)
                        : `${row.useRate}%`}
                    </p>
                    <p className="text-[10px] text-subtle">{secondaryLabel}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">{t("map.tierNote")}</p>
          </section>
        </>
      ) : null}

      {recent.length === 0 ? (
        <EmptyState title={t("map.empty.title")} body={t("map.empty.body")} />
      ) : (
        <section>
          <h2 className="mb-1.5 font-display text-lg tracking-wide">{t("map.clubBattles")}</h2>
          <ul className="flex flex-col gap-1.5">
            {recent.map(({ tag, battle }, index) => (
              <BattleRow
                key={`${tag}-${battle.timestamp}-${index}`}
                battle={battle}
                member={names.get(tag) ?? `#${tag}`}
              />
            ))}
          </ul>
        </section>
      )}

      {unpublished > 0 ? (
        <p className="text-[11px] text-low">{t("map.unpublished", { n: unpublished })}</p>
      ) : null}

      <p className="pb-2 text-[11px] leading-relaxed text-subtle">
        {global?.source ? t("map.note", { source: global.source }) : t("map.noteClub")}
      </p>

      {picture ? (
        <MapPicture
          map={map}
          art={art}
          event={status?.event ?? null}
          live={Boolean(status?.live)}
          onClose={() => setPicture(false)}
        />
      ) : null}
    </div>
  );
}

/** One of the publisher's four lists for this map. */
function BucketSection({ bucket }: { bucket: MapStatBucket }) {
  const t = useT();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;
  const key = BUCKET_KEYS[bucket.kind];
  return (
    <section>
      <h2 className="mb-1.5 font-display text-lg tracking-wide">{key ? t(key) : bucket.title}</h2>
      <ul className="flex flex-col gap-1.5">
        {bucket.items.map((item) => (
          <li key={item.name} className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2">
            <Portrait
              catalog={findBrawler(catalog, item.name.toUpperCase())}
              cubeName={item.name.toUpperCase()}
              size={32}
              decorative
            />
            <p className="min-w-0 flex-1 truncate text-sm text-fg">
              {displayBrawlerName(item.name.toUpperCase())}
            </p>
            <p className="w-14 shrink-0 text-right text-sm text-fg">{Math.round(item.winRate)}%</p>
            <p className="w-14 shrink-0 text-right text-xs text-muted">
              {item.useRate == null ? "—" : `${item.useRate}%`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
