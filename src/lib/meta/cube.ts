import type { CubeResult, CubeRow, FilterState, LeagueFilterId, Queue, TrophyFilterId } from "./types";
import { clearCubeToken, resolveCubeToken } from "./token";
import { seasonValuesForWindow } from "./seasons";

const CUBE_URL = "https://cube.brawltime.ninja/cubejs-api/v1/load";
const CUBE_TIMEOUT_MS = 18_000;

export const CUBE_SOURCE = "Brawl Time Ninja (cube.brawltime.ninja)";

export interface MetaQueryInput {
  queue: Queue;
  season: "current" | "sixWeeks";
  trophy: TrophyFilterId;
  league: LeagueFilterId;
  mode: string | null;
  map: string | null;
  brawler?: string | null;
  dimensions: string[];
  measures?: string[];
  limit?: number;
  orderMeasure?: string;
}

const DEFAULT_MEASURES = [
  "map.winRateAdj_measure",
  "map.winRate_measure",
  "map.useRate_measure",
  "map.picks_measure",
  "map.pickRate_measure",
  "map.timestamp_measure",
];

/** Provider trophyRange is a 100-trophy bucket index stored as a string. Ladder only. */
const TROPHY_IN: Record<TrophyFilterId, string[] | null> = {
  all: null,
  "0-999": rangeStrings(0, 9),
  "1000+": rangeStrings(10, 80),
  "1500+": rangeStrings(15, 80),
  "2000+": rangeStrings(20, 80),
};

/**
 * Ranked (powerplay=1) writes league rank into the same trophyRange field.
 * Index 1–22 = Bronze I … Pro (Ranked 2.0). Confirmed against cube volume
 * spikes at every league floor (4, 7, 10, 13, 16, 19) and Brawl Time Ninja's
 * own `playerLeague` slicer.
 */
const LEAGUE_IN: Record<LeagueFilterId, string[] | null> = {
  all: null,
  "gold+": rangeStrings(7, 22),
  "diamond+": rangeStrings(10, 22),
  "mythic+": rangeStrings(13, 22),
  "legendary+": rangeStrings(16, 22),
  "masters+": rangeStrings(19, 22),
};

export const LEAGUE_OPTIONS: { id: LeagueFilterId; label: string; elo: string }[] = [
  { id: "all", label: "All ELO", elo: "Every league" },
  { id: "gold+", label: "Gold+", elo: "1500 ELO" },
  { id: "diamond+", label: "Diamond+", elo: "3000 ELO" },
  { id: "mythic+", label: "Mythic+", elo: "4500 ELO" },
  { id: "legendary+", label: "Legendary+", elo: "6000 ELO" },
  { id: "masters+", label: "Masters+", elo: "8250 ELO" },
];

function rangeStrings(from: number, to: number): string[] {
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(String(i));
  return out;
}

export function trophyFilterLabel(id: TrophyFilterId): string {
  switch (id) {
    case "all":
      return "All trophies";
    case "0-999":
      return "0–999";
    case "1000+":
      return "1000+";
    case "1500+":
      return "1500+";
    case "2000+":
      return "2000+";
  }
}

export function leagueFilterLabel(id: LeagueFilterId): string {
  return LEAGUE_OPTIONS.find((o) => o.id === id)?.label ?? "All ELO";
}

export function rangeFilterLabel(queue: Queue, filters: FilterState): string {
  return queue === "ranked"
    ? leagueFilterLabel(filters.league ?? "all")
    : trophyFilterLabel(filters.trophy);
}

export function trophyRangeValues(
  queue: Queue,
  trophy: TrophyFilterId,
  league: LeagueFilterId | undefined,
): string[] | null {
  if (queue === "ranked") return LEAGUE_IN[league ?? "all"];
  return TROPHY_IN[trophy];
}

export function trophyRangeCubeFilter(
  queue: Queue,
  trophy: TrophyFilterId,
  league: LeagueFilterId | undefined,
): { member: string; operator: string; values: string[] } | null {
  const values = trophyRangeValues(queue, trophy, league);
  if (!values) return null;
  return {
    member: "map.trophyRange_dimension",
    operator: "equals",
    values,
  };
}

function buildFilters(input: MetaQueryInput) {
  const filters: Array<{ member: string; operator: string; values: string[] }> = [
    {
      member: "map.season_dimension",
      operator: "equals",
      values: seasonValuesForWindow(input.season),
    },
    {
      member: "map.powerplay_dimension",
      operator: "equals",
      values: [input.queue === "ranked" ? "1" : "0"],
    },
  ];
  const range = trophyRangeCubeFilter(input.queue, input.trophy, input.league);
  if (range) filters.push(range);
  if (input.mode) {
    filters.push({
      member: "map.mode_dimension",
      operator: "equals",
      values: [input.mode],
    });
  }
  if (input.map) {
    filters.push({
      member: "map.map_dimension",
      operator: "equals",
      values: [input.map],
    });
  }
  if (input.brawler) {
    filters.push({
      member: "map.brawler_dimension",
      operator: "equals",
      values: [input.brawler],
    });
  }
  return filters;
}

export async function cubeLoad(query: Record<string, unknown>): Promise<CubeResult> {
  const token = await resolveCubeToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CUBE_TIMEOUT_MS);
  try {
    const res = await fetch(CUBE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: token.token,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        origin: "https://brawltime.ninja",
        referer: "https://brawltime.ninja/",
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (res.status === 403) {
      clearCubeToken();
      throw new Error("Cube token rejected");
    }
    if (!res.ok) {
      throw new Error(`Stats source unavailable (${res.status})`);
    }
    const json: unknown = await res.json();
    const body = json as {
      error?: string;
      data?: CubeRow[];
      lastRefreshTime?: string;
      query?: unknown;
    };
    if (body.error) throw new Error(body.error);
    return {
      data: Array.isArray(body.data) ? body.data : [],
      lastRefreshTime: body.lastRefreshTime ?? null,
      query: body.query,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Stats source timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function queryMapCube(input: MetaQueryInput): Promise<CubeResult> {
  const measures = input.measures ?? DEFAULT_MEASURES;
  return cubeLoad({
    measures,
    dimensions: input.dimensions,
    filters: buildFilters(input),
    order: { [input.orderMeasure ?? "map.picks_measure"]: "desc" },
    limit: input.limit ?? 500,
    timezone: "UTC",
  });
}

export function num(row: CubeRow, key: string): number {
  const v = row[key];
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function str(row: CubeRow, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v);
}
