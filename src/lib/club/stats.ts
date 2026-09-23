/**
 * Club stats arithmetic — pure, no I/O, so it can be tested directly.
 *
 * The official API publishes no global win or pick rates, so club stats are
 * aggregated from the members' own battle logs. Every number carries its sample
 * size: a brawler with two games reads as two games.
 */
import type { PlayerBattle } from "./types.ts";

export type MetaQueue = "all" | "ladder" | "ranked";

/** How far back a Stats view looks. `all` is the battle log the API actually returned. */
export type StatsRange = "7d" | "14d" | "30d" | "all";

export const STATS_RANGES: ReadonlyArray<{ id: StatsRange; label: string; ms: number | null }> = [
  { id: "7d", label: "7 days", ms: 7 * 86_400_000 },
  { id: "14d", label: "14 days", ms: 14 * 86_400_000 },
  { id: "30d", label: "30 days", ms: 30 * 86_400_000 },
  { id: "all", label: "All logs", ms: null },
];

export function rangeStart(range: StatsRange, now: number): number | null {
  const ms = STATS_RANGES.find((entry) => entry.id === range)?.ms ?? null;
  return ms == null ? null : now - ms;
}

/** Below this many picks a row is labelled a small sample rather than ranked. */
export const LOW_SAMPLE = 5;

export interface MetaRow {
  name: string;
  picks: number;
  wins: number;
  winRate: number;
  /** Net trophies on the ladder, net Elo in Ranked. */
  trophyChange: number;
  /** How many of the picks actually carried a trophy/Elo change; 0 means "not published". */
  changeKnown: number;
}

export interface ClubMeta {
  queue: MetaQueue;
  battles: number;
  wins: number;
  winRate: number;
  members: number;
  windowStart: string | null;
  windowEnd: string | null;
  totals: Record<MetaQueue, number>;
  brawlers: MetaRow[];
  modes: MetaRow[];
  maps: MetaRow[];
}

/** Optional narrowing. Omitted fields mean the whole club and the whole log. */
export interface StatsScope {
  tag?: string | null;
  sinceMs?: number | null;
}

/** One queue's competitive battles, grouped by whatever `key` returns. */
export function aggregateBattles(
  logs: Array<{ tag: string; battles: PlayerBattle[] }>,
  queue: MetaQueue,
  scope: StatsScope = {},
): Omit<ClubMeta, "unavailable" | "fetchedAt"> {
  const wanted = scope.tag ? logs.filter((log) => log.tag === scope.tag) : logs;
  const competitive: Array<{ battle: PlayerBattle; ranked: boolean }> = [];
  const members = new Set<string>();
  let windowStart: number | null = null;
  let windowEnd: number | null = null;

  for (const log of wanted) {
    if (!Array.isArray(log.battles) || log.battles.length === 0) continue;
    for (const battle of log.battles) {
      if (!battle.competitive || battle.result === null) continue;
      const at = Date.parse(battle.timestamp);
      if (scope.sinceMs != null && (!Number.isFinite(at) || at < scope.sinceMs)) continue;
      members.add(log.tag);
      competitive.push({ battle, ranked: battle.ranked });
      if (!Number.isFinite(at)) continue;
      windowStart = windowStart === null || at < windowStart ? at : windowStart;
      windowEnd = windowEnd === null || at > windowEnd ? at : windowEnd;
    }
  }

  const selected = competitive.filter((row) =>
    queue === "all" ? true : queue === "ranked" ? row.ranked : !row.ranked,
  );

  const table = (key: (battle: PlayerBattle) => string | null): MetaRow[] => {
    const groups = new Map<string, MetaRow>();
    for (const { battle } of selected) {
      const name = key(battle);
      if (!name) continue;
      const row = groups.get(name) ?? { name, picks: 0, wins: 0, winRate: 0, trophyChange: 0, changeKnown: 0 };
      row.picks += 1;
      if (battle.victory) row.wins += 1;
      if (typeof battle.trophyChange === "number") {
        row.trophyChange += battle.trophyChange;
        row.changeKnown += 1;
      }
      groups.set(name, row);
    }
    return [...groups.values()]
      .map((row) => ({ ...row, winRate: row.picks > 0 ? row.wins / row.picks : 0 }))
      .sort((a, b) => b.picks - a.picks || b.winRate - a.winRate || a.name.localeCompare(b.name));
  };

  const wins = selected.filter((row) => row.battle.victory).length;
  return {
    queue,
    battles: selected.length,
    wins,
    winRate: selected.length > 0 ? wins / selected.length : 0,
    members: members.size,
    windowStart: windowStart === null ? null : new Date(windowStart).toISOString(),
    windowEnd: windowEnd === null ? null : new Date(windowEnd).toISOString(),
    totals: {
      all: competitive.length,
      ladder: competitive.filter((row) => !row.ranked).length,
      ranked: competitive.filter((row) => row.ranked).length,
    },
    brawlers: table((battle) => battle.brawler),
    modes: table((battle) => battle.mode),
    maps: table((battle) => battle.map),
  };
}
