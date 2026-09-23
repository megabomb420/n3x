/**
 * One map: its art, whether it is in the live rotation, and what this club has
 * actually done on it.
 *
 * Every number here is the members' own battle logs — the official API publishes
 * no global win or pick rates, and the sites that do publish them (Brawl Time
 * Ninja, Brawlify) cannot be read from a hosted app — so each row carries its
 * own sample size instead of looking like a global ranking.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QUEUE_PREF_KEY, isQueue } from "@/lib/club/queue";
import {
  LOW_SAMPLE,
  aggregateBattles,
  battlesOnMap,
  battlesWithoutResult,
  inQueue,
  loadClubLogs,
  type MetaQueue,
} from "@/lib/club/stats-loader";
import { useT } from "@/lib/i18n/provider";
import { formatWindow, loadRotation } from "@/lib/maps/rotation";
import { findMap, loadCatalog } from "@/lib/meta/brawlapi";
import { formatRelative } from "@/lib/meta/format";
import { displayBrawlerName, titleCaseMode } from "@/lib/meta/names";
import { readPref, writePref } from "@/lib/prefs";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { MapArt } from "./portrait";
import { BrawlerRow, Breakdown, QUEUES, Stat, pct } from "./stat-rows";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";
import { TabButtons } from "./tab-buttons";

export function MapScreen({ map }: { map: string }) {
  const t = useT();
  const online = useOnline();
  const [queue, setQueue] = useState<MetaQueue>("all");
  const [prefsReady, setPrefsReady] = useState(false);

  const logs = useQuery({
    queryKey: ["club-logs"],
    queryFn: loadClubLogs,
    refetchInterval: 300_000,
  });
  const rotation = useQuery({ queryKey: ["rotation"], queryFn: loadRotation });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;

  useEffect(() => {
    const saved = readPref(QUEUE_PREF_KEY);
    const next = isQueue(saved) ? saved : "all";
    writePref(QUEUE_PREF_KEY, next);
    setQueue(next);
    setPrefsReady(true);
  }, []);

  const bundle = logs.data;
  const live = useMemo(() => {
    const events = [...(rotation.data?.active ?? []), ...(rotation.data?.upcoming ?? [])];
    return events.find((event) => event.map === map) ?? null;
  }, [rotation.data, map]);

  const meta = useMemo(
    () => (bundle && prefsReady ? aggregateBattles(bundle.logs, queue, { map }) : null),
    [bundle, prefsReady, queue, map],
  );
  const recent = useMemo(
    () =>
      bundle
        ? battlesOnMap(bundle.logs, map, 30)
            .filter(({ battle }) => inQueue(battle, queue))
            .slice(0, 12)
        : [],
    [bundle, map, queue],
  );
  const names = useMemo(
    () => new Map((bundle?.members ?? []).map((entry) => [entry.tag, entry.name])),
    [bundle],
  );
  const unpublished = useMemo(
    () => (bundle ? battlesWithoutResult(bundle.logs, map) : 0),
    [bundle, map],
  );

  function chooseQueue(next: MetaQueue) {
    setQueue(next);
    writePref(QUEUE_PREF_KEY, next);
  }

  if (logs.isLoading || !prefsReady) {
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
  if (!bundle || !meta) return null;

  const art = catalog ? findMap(catalog, map, live?.mode) : null;
  const days =
    meta.windowStart == null
      ? null
      : Math.max(1, Math.round((Date.now() - Date.parse(meta.windowStart)) / 86_400_000));

  return (
    <div className="flex flex-col gap-3 px-3">
      <Link to="/maps/" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted">
        <ChevronLeft className="size-4" /> {t("nav.maps")}
      </Link>

      {!online ? <OfflineBanner stale /> : null}

      <section className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        <div className="relative aspect-[2/1] bg-surface-2">
          <MapArt src={art?.imageUrl ?? null} alt={map} className="h-full w-full" />
          {live ? (
            <span className="absolute right-2 top-2 rounded-full bg-win px-2 py-0.5 text-[10px] font-medium text-bg">
              {t("maps.active")}
            </span>
          ) : null}
        </div>
        <div className="px-3 py-2.5">
          <h2 className="font-display text-2xl leading-none tracking-wide">{map}</h2>
          <p className="mt-1 text-xs text-muted">
            {live
              ? `${live.mode ? titleCaseMode(live.mode) : t("maps.modeUnknown")} · ${formatWindow(live.startTime, live.endTime, t)}`
              : t("map.notLive")}
          </p>
        </div>
      </section>

      <TabButtons
        label={t("map.club")}
        value={queue}
        onChange={chooseQueue}
        options={QUEUES.map((entry) => ({ id: entry.id, label: t(entry.label), hint: meta.totals[entry.id] }))}
      />

      <section className="rounded-2xl bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-subtle">{t("map.club")}</p>
            <p className="truncate font-display text-3xl leading-none tracking-wide">
              {meta.battles.toLocaleString("en-GB")}
            </p>
            <p className="mt-1 truncate text-xs text-muted">{t("stats.battles")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-subtle">{t("stats.winRate")}</p>
            <p
              className={cn(
                "font-display text-3xl leading-none tracking-wide",
                meta.winRate >= 0.5 ? "text-win" : "text-fg",
              )}
            >
              {pct(meta.winRate)}
            </p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label={t("stats.wins")} value={meta.wins.toLocaleString("en-GB")} />
          <Stat label={t("club.members")} value={String(meta.members)} />
          <Stat label={t("stats.window")} value={days == null ? "—" : `${days}d`} />
        </dl>
        <p className="mt-3 text-[11px] text-subtle">
          {t(`stats.queue.${queue}` as const)}
          {meta.windowStart && meta.windowEnd
            ? ` · ${new Date(meta.windowStart).toLocaleDateString("en-GB")} → ${new Date(meta.windowEnd).toLocaleDateString("en-GB")}`
            : ""}
          {" · "}
          {t("common.updated", { when: formatRelative(bundle.fetchedAt) })}
        </p>
        {unpublished > 0 ? (
          <p className="mt-1 text-[11px] text-low">{t("map.unpublished", { n: unpublished })}</p>
        ) : null}
      </section>

      {meta.battles === 0 ? (
        <EmptyState title={t("map.empty.title")} body={t("map.empty.body")} />
      ) : (
        <>
          <section>
            <h2 className="mb-1.5 font-display text-lg tracking-wide">{t("map.brawlers")}</h2>
            <ul className="flex flex-col gap-1.5">
              {meta.brawlers.map((row) => (
                <BrawlerRow key={row.name} row={row} queue={queue} catalog={catalog} />
              ))}
            </ul>
          </section>

          <Breakdown title={t("stats.modes")} rows={meta.modes} label={titleCaseMode} />

          <section>
            <h2 className="mb-1.5 font-display text-lg tracking-wide">{t("map.recent")}</h2>
            <ul className="flex flex-col gap-1.5">
              {recent.map(({ tag, battle }, i) => (
                <li key={`${tag}-${battle.timestamp}-${i}`} className="rounded-xl bg-surface px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        battle.victory === true ? "text-win" : battle.victory === false ? "text-danger" : "text-fg",
                      )}
                    >
                      {battle.result ||
                        (battle.victory === true
                          ? t("member.victory")
                          : battle.victory === false
                            ? t("member.defeat")
                            : t("member.battle"))}
                    </p>
                    <p className="text-xs text-subtle">{formatRelative(battle.timestamp)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {names.get(tag) ?? `#${tag}`}
                    {battle.mode ? ` · ${titleCaseMode(battle.mode)}` : ""}
                    {battle.brawler ? ` · ${displayBrawlerName(battle.brawler)}` : ""}
                    {battle.ranked ? ` · ${t("stats.queue.ranked")}` : ""}
                    {battle.trophyChange != null
                      ? ` · ${battle.trophyChange > 0 ? "+" : ""}${battle.trophyChange}${battle.ranked ? " ELO" : ""}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <p className="pb-2 text-[11px] leading-relaxed text-subtle">{t("map.note", { low: LOW_SAMPLE })}</p>
    </div>
  );
}
