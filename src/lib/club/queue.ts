/**
 * The queue a club screen is showing.
 *
 * Stats and a single map's own screen read the same numbers — the map screen is
 * reached from a Stats row — so they keep one remembered choice instead of two
 * that can disagree about what "this map" means.
 */
import type { MetaQueue } from "./stats";

export const QUEUE_PREF_KEY = "n3x.stats.queue";

export function isQueue(value: string | null): value is MetaQueue {
  return value === "all" || value === "ladder" || value === "ranked";
}
