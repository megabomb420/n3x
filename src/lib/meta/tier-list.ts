/**
 * The Meta board loader. Placements come from a published tier list. Creator
 * links are a separate strip — this module never turns a video title into a tier.
 */
import { apiGet } from "@/lib/api/client";
import { cacheGet, cacheSet } from "./cache";
import type { TierRow } from "./tier-board";

export type { TierRow } from "./tier-board";
export { TIER_ORDER, groupTiers } from "./tier-board";

export type TierScope = "overall" | "ranked";

export interface TierList {
  scope: TierScope;
  source: string;
  sourceUrl: string;
  updatedAt: number;
  rows: TierRow[];
  stale?: boolean;
  error?: string;
}

const CACHE_TTL_MS = 15 * 60_000;

/** One scope's published tier list. A failed read is not cached. */
export async function loadTierList(scope: TierScope): Promise<TierList> {
  const key = `tier-list:v1:${scope}`;
  const hit = cacheGet<TierList>(key);
  if (hit && Date.now() - hit.savedAt < CACHE_TTL_MS && hit.value.rows.length > 0) return hit.value;
  const list = await apiGet<TierList>(`/tier-list?scope=${scope}`);
  if (list.rows.length > 0) cacheSet(key, list);
  return list;
}
