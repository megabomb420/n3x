import type { FreshnessKind } from "./types";

const PREFIX = "hotlane:v2:";
const STALE_MS = 30 * 60 * 1000;
const VERY_STALE_MS = 6 * 60 * 60 * 1000;

export interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function cacheGet<T>(key: string): CacheEntry<T> | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  const s = storage();
  if (!s) return;
  try {
    const entry: CacheEntry<T> = { savedAt: Date.now(), value };
    s.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota / private mode — ignore
  }
}

export function freshnessFromAge(ageMs: number | null, online: boolean): FreshnessKind {
  if (!online && ageMs != null) return ageMs > STALE_MS ? "stale" : "offline";
  if (ageMs == null) return "live";
  if (ageMs > VERY_STALE_MS) return "stale";
  if (ageMs > STALE_MS) return "stale";
  return ageMs < 15_000 ? "live" : "cached";
}

export { STALE_MS, VERY_STALE_MS };
