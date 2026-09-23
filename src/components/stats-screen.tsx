import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { findBrawler, loadCatalog } from "@/lib/meta/brawlapi";
import type { Catalog } from "@/lib/meta/types";
import {
  LOW_SAMPLE,
  STATS_RANGES,
  aggregateBattles,
  loadClubLogs,
  rangeStart,
  type MetaQueue,
  type MetaRow,
  type StatsRange,
} from "@/lib/club/stats-loader";
import { useRoleLabel, useT, type StringKey } from "@/lib/i18n/provider";
import { displayBrawlerName, titleCaseMode } from "@/lib/meta/names";
import { formatPicks, formatRelative, formatTrophies } from "@/lib/meta/format";
import { readPref, writePref } from "@/lib/prefs";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { Portrait } from "./portrait";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";
import { TabButtons } from "./tab-buttons";

const QUEUES: Array<{ id: MetaQueue; label: StringKey }> = [
  { id: "all", label: "stats.queue.all" },
  { id: "ladder", label: "stats.queue.ladder" },
  { id: "ranked", label: "stats.queue.ranked" },
];

const CLUB = "club";
const MEMBER_KEY = "n3x.stats.member";
const RANGE_KEY = "n3x.stats.range";
const QUEUE_KEY = "n3x.stats.queue";

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Ranked battles publish no Elo delta, so the change column is ladder-only. */
function changeOf(row: MetaRow) {
  return { value: row.trophyChange, known: row.trophyKnown };
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-GB")}`;
}

function isQueue(value: string | null): value is MetaQueue {
  return value === "all" || value === "ladder" || value === "ranked";
}

function isRange(value: string | null): value is StatsRange {
  return STATS_RANGES.some((entry) => entry.id === value);
}

/**
 * Club stats, or one member's. The official API publishes no global rates, so
 * every number is this club's own battle log, narrowed by the saved range.
 */
export function StatsScreen() {
  const t = useT();
  const roleLabel = useRoleLabel();
  const online = useOnline();
  const [queue, setQueue] = useState<MetaQueue>("all");
  const [range, setRange] = useState<StatsRange>("all");
  const [memberTag, setMemberTag] = useState(CLUB);
  const [prefsReady, setPrefsReady] = useState(false);
  const [sort, setSort] = useState<"picks" | "winRate">("picks");
  const query = useQuery({
    queryKey: ["club-logs"],
    queryFn: loadClubLogs,
    refetchInterval: 300_000,
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;
  const bundle = query.data;

  useEffect(() => {
    const savedQueue = readPref(QUEUE_KEY);
    const savedRange = readPref(RANGE_KEY);
    const savedMember = readPref(MEMBER_KEY);
    const nextQueue = isQueue(savedQueue) ? savedQueue : "all";
    const nextRange = isRange(savedRange) ? savedRange : "all";
    const nextMember = savedMember && savedMember.length > 0 ? savedMember : CLUB;
    writePref(QUEUE_KEY, nextQueue);
    writePref(RANGE_KEY, nextRange);
    writePref(MEMBER_KEY, nextMember);
    setQueue(nextQueue);
    setRange(nextRange);
    setMemberTag(nextMember);
    setPrefsReady(true);
  }, []);

  const member = bundle?.members.find((entry) => entry.tag === memberTag) ?? null;
  const activeTag = member ? member.tag : null;

  const meta = useMemo(() => {
    if (!bundle || !prefsReady) return null;
    return aggregateBattles(bundle.logs, queue, {
      tag: activeTag,
      sinceMs: rangeStart(range, Date.now()),
    });
  }, [bundle, prefsReady, queue, activeTag, range]);

  function chooseQueue(next: MetaQueue) {
    setQueue(next);
    writePref(QUEUE_KEY, next);
  }

  function chooseRange(next: StatsRange) {
    setRange(next);
    writePref(RANGE_KEY, next);
  }

  function chooseMember(next: string) {
    setMemberTag(next);
    writePref(MEMBER_KEY, next);
  }

  if (query.isLoading || !prefsReady) {
    return (
      <div className="px-3">
        <SkeletonRows count={8} />
      </div>
    );
  }
  if (query.isError && !bundle) {
    return (
      <div className="px-3">
        <ErrorState
          title={t("state.stats.title")}
          body={query.error instanceof Error ? query.error.message : t("state.stats.body")}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (!bundle || !meta) return null;

  const subject = member?.name ?? t("stats.wholeClub");
  const rangeLabel = t(`stats.range.${range}` as const);

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(bundle)} /> : null}

      <TabButtons
        label={t("nav.stats")}
        value={queue}
        onChange={chooseQueue}
        options={QUEUES.map((entry) => ({ id: entry.id, label: t(entry.label), hint: meta.totals[entry.id] }))}
      />

      <TabButtons
        label={t("stats.window")}
        value={range}
        onChange={chooseRange}
        options={STATS_RANGES.map((entry) => ({ id: entry.id, label: t(`stats.range.${entry.id}` as const) }))}
      />

      <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
          <span className="shrink-0 text-xs uppercase tracking-wider text-subtle">{t("stats.player")}</span>
          <select
            value={member ? member.tag : CLUB}
            onChange={(event) => chooseMember(event.target.value)}
            className="min-h-9 min-w-0 flex-1 bg-transparent text-right text-sm text-fg outline-none"
            aria-label={t("stats.player")}
          >
            <option value={CLUB}>{t("stats.wholeClub")}</option>
            {bundle.members.map((entry) => (
              <option key={entry.tag} value={entry.tag}>
                {entry.name}
              </option>
            ))}
          </select>
      </label>

      <section className="rounded-2xl bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-subtle">{t("stats.battles")}</p>
            <p className="truncate font-display text-3xl leading-none tracking-wide">{meta.battles.toLocaleString("en-GB")}</p>
            <p className="mt-1 truncate text-xs text-muted">
              {subject}
              {member ? ` · ${roleLabel(member.role)} · ${formatTrophies(member.trophies)}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-subtle">{t("stats.winRate")}</p>
            <p className={cn("font-display text-3xl leading-none tracking-wide", meta.winRate >= 0.5 ? "text-win" : "text-fg")}>
              {pct(meta.winRate)}
            </p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label={t("stats.wins")} value={meta.wins.toLocaleString("en-GB")} />
          <Stat
            label={member ? t("stats.role") : t("club.members")}
            value={member ? roleLabel(member.role) : String(meta.members)}
            hint={!member && bundle.unavailable > 0 ? `${bundle.unavailable}` : undefined}
          />
          <Stat
            label={t("stats.window")}
            value={meta.windowStart ? `${Math.max(1, Math.round((Date.now() - Date.parse(meta.windowStart)) / 86_400_000))}d` : "—"}
          />
        </dl>
        <p className="mt-3 text-[11px] text-subtle">
          {rangeLabel}
          {meta.windowStart && meta.windowEnd
            ? ` · ${new Date(meta.windowStart).toLocaleDateString("en-GB")} → ${new Date(meta.windowEnd).toLocaleDateString("en-GB")}`
            : ""}
          {" · "}
          {t("common.updated", { when: formatRelative(bundle.fetchedAt) })}
        </p>
      </section>

      <details className="rounded-xl bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted [&::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none text-subtle">{t("stats.legend.title")}</summary>
        <div className="mt-2 space-y-1.5">
          <p>{t("stats.legend.picks")}</p>
          <p>{t("stats.legend.winRate")}</p>
          <p>{t("stats.legend.smallSample", { low: LOW_SAMPLE })}</p>
          <p className="text-subtle">{t("stats.legend.more")}</p>
        </div>
      </details>

      {meta.battles === 0 ? (
        <EmptyState
          title={t("stats.empty.title")}
          body={
            member
              ? t("stats.empty.member", { name: member.name, range: rangeLabel })
              : t("stats.empty.club")
          }
        />
      ) : (
        <>
          <section>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg tracking-wide">{t("stats.brawlers")}</h2>
              <div className="w-44 shrink-0">
                <TabButtons
                  label={t("stats.brawlers")}
                  value={sort}
                  onChange={setSort}
                  options={[
                    { id: "picks", label: t("stats.picks") },
                    { id: "winRate", label: t("stats.winRateSort") },
                  ]}
                />
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {[...meta.brawlers]
                .sort((a, b) =>
                  sort === "picks" ? b.picks - a.picks || b.winRate - a.winRate : b.winRate - a.winRate || b.picks - a.picks,
                )
                .map((row) => (
                  <BrawlerRow key={row.name} row={row} queue={queue} catalog={catalog} />
                ))}
            </ul>
          </section>

          <Breakdown title={t("stats.modes")} rows={meta.modes} label={titleCaseMode} />
          <Breakdown title={t("stats.maps")} rows={meta.maps} label={(name) => name} limit={10} />
        </>
      )}

      <p className="pb-2 text-[11px] leading-relaxed text-subtle">{t("stats.note", { low: LOW_SAMPLE })}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="truncate text-sm text-fg">{value}</dd>
      {hint ? <dd className="truncate text-[10px] text-subtle">{hint}</dd> : null}
    </div>
  );
}

/**
 * Win rate as a bar measured from 50%, so a 55% row reads as a nudge past even
 * instead of 55% of the track being filled. Shared by the brawler list and the
 * mode/map breakdowns so one number looks the same everywhere.
 */
function RateBar({ rate, className }: { rate: number; className?: string }) {
  const above = rate >= 0.5;
  const width = Math.max(2, Math.round(Math.abs(rate - 0.5) * 100));
  return (
    <div className={cn("relative h-1.5 overflow-hidden rounded-full bg-surface-3", className)}>
      <span aria-hidden className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border-strong" />
      <span
        className={cn("absolute top-0 h-full rounded-full", above ? "bg-win" : "bg-gold")}
        style={above ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
      />
    </div>
  );
}

function BrawlerRow({ row, queue, catalog }: { row: MetaRow; queue: MetaQueue; catalog: Catalog | null }) {
  const t = useT();
  const small = row.picks < LOW_SAMPLE;
  const change = changeOf(row);
  return (
    <li className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2">
      <Portrait catalog={findBrawler(catalog, row.name)} cubeName={row.name} size={32} decorative />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <p className="truncate text-sm text-fg">{displayBrawlerName(row.name)}</p>
          {small ? <span className="shrink-0 text-[10px] text-low">{t("stats.smallSample")}</span> : null}
        </div>
        <RateBar rate={row.winRate} className="mt-1 w-20" />
      </div>
      <div className="w-16 shrink-0 text-right">
        <p className="text-sm text-fg">{pct(row.winRate)}</p>
        <p className="text-[10px] text-subtle">{formatPicks(row.picks)}</p>
      </div>
      {queue === "ranked" ? null : (
        <p
          className={cn(
            "w-16 shrink-0 text-right text-xs",
            change.known === 0 ? "text-subtle" : change.value >= 0 ? "text-win" : "text-danger",
          )}
        >
          {change.known === 0 ? "—" : signed(change.value)}
        </p>
      )}
    </li>
  );
}

function Breakdown({
  title,
  rows,
  label,
  limit,
}: {
  title: string;
  rows: MetaRow[];
  label: (name: string) => string;
  limit?: number;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (shown.length === 0) return null;
  return (
    <section>
      <h2 className="mb-1.5 font-display text-lg tracking-wide">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {shown.map((row) => (
          <li key={row.name} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-sm text-fg">{label(row.name)}</p>
            <RateBar rate={row.winRate} className="w-20 shrink-0" />
            <p className="w-10 shrink-0 text-right text-xs text-muted">{pct(row.winRate)}</p>
            <p className="w-10 shrink-0 text-right text-[10px] text-subtle">{formatPicks(row.picks)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

