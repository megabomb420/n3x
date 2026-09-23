/**
 * One map's published, global numbers — the same publisher Meta already reads.
 * Nothing here is the club's data: the official API publishes no win rates at
 * all, so the app shows the publisher's count with its sample size and date.
 * The publisher has a single population, so there is no trophy split to show.
 */
import { apiGet } from "@/lib/api/client";
import { cacheGet, cacheSet } from "@/lib/meta/cache";
import type { TierRow } from "@/lib/meta/tier-board";

const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_TAG = "v1";

/**
 * What the publisher's table ranks by. Ordinary modes publish a win rate;
 * Showdown has no win or loss, so it publishes a top-4 placement rate (and
 * games rather than a use rate). The screen labels the column from this, and
 * never calls a placement rate a win rate.
 */
export type MapStatMetric = "winRate" | "top4";

export interface MapStatBucket {
  kind: "picks" | "winners" | "mostUsed" | "notRecommended" | "other";
  title: string;
  items: Array<{ name: string; winRate: number; useRate: number | null }>;
}

export interface MapStats {
  map: string;
  mode: string | null;
  source: string;
  sourceUrl: string;
  fetchedAt: number;
  sampleBattles: number;
  updatedAt: string | null;
  metric: MapStatMetric;
  rows: TierRow[];
  buckets: MapStatBucket[];
  stale?: boolean;
  error?: string;
}

/** One map's published numbers. A failed read is not cached. */
export async function loadMapStats(map: string, mode: string | null): Promise<MapStats> {
  const key = `map-stats:${CACHE_TAG}:${mode ?? ""}:${map}`;
  const hit = cacheGet<MapStats>(key);
  if (hit && Date.now() - hit.savedAt < CACHE_TTL_MS && hit.value.rows.length > 0) return hit.value;
  const stats = await apiGet<MapStats>(
    `/map-stats?map=${encodeURIComponent(map)}&mode=${encodeURIComponent(mode ?? "")}`,
  );
  if (stats.rows.length > 0) cacheSet(key, stats);
  return stats;
}
