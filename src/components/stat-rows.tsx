/**
 * The row shapes the club's own numbers are read in.
 *
 * Stats and a single map's own screen show the same brawler, mode and map rows,
 * so the bar, the summary tile, the brawler row and the breakdown live here
 * instead of one screen importing UI out of another.
 */
import { Link } from "@tanstack/react-router";
import { LOW_SAMPLE, type MetaQueue, type MetaRow } from "@/lib/club/stats-loader";
import { useT, type StringKey } from "@/lib/i18n/provider";
import { findBrawler } from "@/lib/meta/brawlapi";
import { formatPicks } from "@/lib/meta/format";
import { displayBrawlerName } from "@/lib/meta/names";
import type { Catalog } from "@/lib/meta/types";
import { cn } from "@/lib/utils";
import { Portrait } from "./portrait";

export const pct = (value: number) => `${Math.round(value * 100)}%`;

/** The queue tabs every club screen offers, so they cannot drift apart. */
export const QUEUES: Array<{ id: MetaQueue; label: StringKey }> = [
  { id: "all", label: "stats.queue.all" },
  { id: "ladder", label: "stats.queue.ladder" },
  { id: "ranked", label: "stats.queue.ranked" },
];

/** Ranked battles publish no Elo delta, so the change column is ladder-only. */
function changeOf(row: MetaRow) {
  return { value: row.trophyChange, known: row.trophyKnown };
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-GB")}`;
}

/** One figure of a summary card. */
export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
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
export function RateBar({ rate, className }: { rate: number; className?: string }) {
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

export function BrawlerRow({
  row,
  queue,
  catalog,
}: {
  row: MetaRow;
  queue: MetaQueue;
  catalog: Catalog | null;
}) {
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

/** The row of Stats and a map's own screen that leads on to a single map. */
export type MapLink = { to: "/maps/$map/"; params: { map: string } };

export function Breakdown({
  title,
  rows,
  label,
  limit,
  link,
}: {
  title: string;
  rows: MetaRow[];
  label: (name: string) => string;
  limit?: number;
  /** Rows that name a map become links to that map's own screen. */
  link?: (name: string) => MapLink | null;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (shown.length === 0) return null;
  return (
    <section>
      <h2 className="mb-1.5 font-display text-lg tracking-wide">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {shown.map((row) => {
          const target = link?.(row.name) ?? null;
          const body = (
            <>
              <p className="min-w-0 flex-1 truncate text-sm text-fg">{label(row.name)}</p>
              <RateBar rate={row.winRate} className="w-20 shrink-0" />
              <p className="w-10 shrink-0 text-right text-xs text-muted">{pct(row.winRate)}</p>
              <p className="w-10 shrink-0 text-right text-[10px] text-subtle">{formatPicks(row.picks)}</p>
            </>
          );
          const shape = "flex items-center gap-3 rounded-xl bg-surface px-3 py-2";
          return (
            <li key={row.name}>
              {target ? (
                <Link to={target.to} params={target.params} className={shape}>
                  {body}
                </Link>
              ) : (
                <div className={shape}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
