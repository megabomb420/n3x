import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { findBrawler, loadCatalog } from "@/lib/meta/brawlapi";
import type { Catalog } from "@/lib/meta/types";
import { LOW_SAMPLE, loadClubMeta, type MetaQueue, type MetaRow } from "@/lib/meta/club-meta";
import { displayBrawlerName, titleCaseMode } from "@/lib/meta/names";
import { formatPicks, formatRelative } from "@/lib/meta/format";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { Portrait } from "./portrait";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

const QUEUES: Array<{ id: MetaQueue; label: string }> = [
  { id: "all", label: "All" },
  { id: "ladder", label: "Ladder" },
  { id: "ranked", label: "Ranked" },
];

const pct = (value: number) => `${Math.round(value * 100)}%`;

function signed(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-GB")}`;
}

/**
 * Club meta: what the club played and won with, straight from the members'
 * battle logs. No global win rates exist in the official API, so this screen
 * shows its own sample sizes instead of borrowing a tier list.
 */
export function MetaScreen() {
  const online = useOnline();
  const [queue, setQueue] = useState<MetaQueue>("all");
  const [sort, setSort] = useState<"picks" | "winRate">("picks");
  const query = useQuery({
    queryKey: ["club-meta", queue],
    queryFn: () => loadClubMeta(queue),
    refetchInterval: 300_000,
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;
  const meta = query.data;

  const brawlers = useMemo(() => {
    const rows = meta?.brawlers ?? [];
    return [...rows].sort((a, b) =>
      sort === "picks"
        ? b.picks - a.picks || b.winRate - a.winRate
        : b.winRate - a.winRate || b.picks - a.picks,
    );
  }, [meta, sort]);

  if (query.isLoading) {
    return (
      <div className="px-3">
        <SkeletonRows count={8} />
      </div>
    );
  }
  if (query.isError && !meta) {
    return (
      <div className="px-3">
        <ErrorState
          title="Meta unavailable"
          body={query.error instanceof Error ? query.error.message : "Could not read the club's battle logs."}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (!meta) return null;

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(meta)} /> : null}

      <Segmented
        value={queue}
        onChange={setQueue}
        options={QUEUES.map((entry) => ({ id: entry.id, label: entry.label, hint: meta.totals[entry.id] }))}
      />

      <section className="rounded-2xl bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Battles analysed</p>
            <p className="font-display text-3xl leading-none tracking-wide">{meta.battles.toLocaleString("en-GB")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-subtle">Club win rate</p>
            <p className={cn("font-display text-3xl leading-none tracking-wide", meta.winRate >= 0.5 ? "text-win" : "text-fg")}>
              {pct(meta.winRate)}
            </p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Wins" value={meta.wins.toLocaleString("en-GB")} />
          <Stat label="Members" value={String(meta.members)} hint={meta.unavailable > 0 ? `${meta.unavailable} without logs` : undefined} />
          <Stat
            label="Window"
            value={meta.windowStart ? `${Math.max(1, Math.round((Date.now() - Date.parse(meta.windowStart)) / 86_400_000))}d` : "—"}
          />
        </dl>
        <p className="mt-3 text-[11px] text-subtle">
          {meta.windowStart && meta.windowEnd
            ? `${new Date(meta.windowStart).toLocaleDateString("en-GB")} → ${new Date(meta.windowEnd).toLocaleDateString("en-GB")} · `
            : ""}
          updated {formatRelative(meta.fetchedAt)} · club battle logs, Supercell API
        </p>
      </section>

      {meta.battles === 0 ? (
        <EmptyState
          title="No competitive battles yet"
          body="Nothing on this queue in the members' recent battle logs. Ladder and Ranked games show up here as they are played."
        />
      ) : (
        <>
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="font-display text-lg tracking-wide">Brawlers</h2>
              <div className="flex overflow-hidden rounded-full border border-border text-[11px]">
                {(["picks", "winRate"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSort(mode)}
                    className={cn(
                      "min-h-8 px-3",
                      sort === mode ? "bg-surface-3 text-fg" : "text-subtle",
                    )}
                  >
                    {mode === "picks" ? "Picks" : "Win rate"}
                  </button>
                ))}
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {brawlers.map((row) => (
                <BrawlerRow key={row.name} row={row} catalog={catalog} />
              ))}
            </ul>
          </section>

          <Breakdown title="Modes" rows={meta.modes} label={titleCaseMode} />
          <Breakdown title="Maps" rows={meta.maps} label={(name) => name} limit={10} />
        </>
      )}

      <p className="pb-2 text-[11px] leading-relaxed text-subtle">
        Counting competitive battles only — friendlies and event modes stay out. The official API publishes no global
        win or pick rates, so these are this club's own games; a row with fewer than {LOW_SAMPLE} picks is marked as a
        small sample rather than ranked against the rest.
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{value}</dd>
      {hint ? <p className="text-[10px] text-low">{hint}</p> : null}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string; hint?: number }>;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            "min-h-9 flex-1 rounded-full px-3 text-xs font-medium",
            value === option.id ? "bg-surface-3 text-fg" : "text-subtle",
          )}
        >
          {option.label}
          {option.hint != null ? <span className="ml-1 text-[10px] text-subtle">{option.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

function BrawlerRow({
  row,
  catalog,
}: {
  row: MetaRow;
  catalog: Catalog | null;
}) {
  const small = row.picks < LOW_SAMPLE;
  return (
    <li className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2">
      <Portrait catalog={findBrawler(catalog, row.name)} cubeName={row.name} size={32} decorative />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <p className="truncate text-sm text-fg">{displayBrawlerName(row.name)}</p>
          {small ? <span className="shrink-0 text-[10px] text-low">small sample</span> : null}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn("h-full rounded-full", row.winRate >= 0.5 ? "bg-win" : "bg-gold")}
            style={{ width: `${Math.round(row.winRate * 100)}%` }}
          />
        </div>
      </div>
      <div className="w-16 shrink-0 text-right">
        <p className="text-sm text-fg">{pct(row.winRate)}</p>
        <p className="text-[10px] text-subtle">{formatPicks(row.picks)}</p>
      </div>
      <p className={cn("w-14 shrink-0 text-right text-xs", row.trophyChange >= 0 ? "text-win" : "text-danger")}>
        {signed(row.trophyChange)}
      </p>
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
            <div className="w-24 shrink-0">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn("h-full rounded-full", row.winRate >= 0.5 ? "bg-win" : "bg-gold")}
                  style={{ width: `${Math.round(row.winRate * 100)}%` }}
                />
              </div>
            </div>
            <p className="w-10 shrink-0 text-right text-xs text-muted">{pct(row.winRate)}</p>
            <p className="w-10 shrink-0 text-right text-[10px] text-subtle">{formatPicks(row.picks)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
