/**
 * Club meta — the loader behind the Meta tab.
 *
 * One request per member, each its own Worker invocation (a single invocation
 * may only make so many subrequests), with a per-tag cache so a repeat view
 * costs nothing. The arithmetic lives in `club-stats.ts`.
 */
import { apiGet } from "@/lib/api/client";
import { loadClubHome } from "@/lib/club/queries";
import type { PlayerBattle } from "@/lib/club/types";
import { aggregateBattles, type ClubMeta, type MetaQueue } from "./club-stats";
import { cacheGet, cacheSet } from "./cache";

export { LOW_SAMPLE, aggregateBattles } from "./club-stats";
export type { ClubMeta, MetaQueue, MetaRow } from "./club-stats";

const LOG_TTL_MS = 5 * 60_000;
const META_TTL_MS = 10 * 60_000;
const LOG_CONCURRENCY = 6;
const MAX_MEMBERS = 30;

interface BattleLogPayload {
  tag: string;
  battles: PlayerBattle[];
}

async function loadMemberBattles(tag: string): Promise<PlayerBattle[]> {
  const key = `battles:${tag}`;
  const hit = cacheGet<PlayerBattle[]>(key);
  if (hit && Date.now() - hit.savedAt < LOG_TTL_MS) return hit.value;
  try {
    const payload = await apiGet<BattleLogPayload>(`/battles/${tag}`);
    cacheSet(key, payload.battles);
    return payload.battles;
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}

/** The club's meta for one queue, cached on the device for ten minutes. */
export async function loadClubMeta(queue: MetaQueue): Promise<ClubMeta & { unavailable: number; fetchedAt: number }> {
  const cacheKey = `club-meta:${queue}`;
  const hit = cacheGet<ClubMeta & { unavailable: number; fetchedAt: number }>(cacheKey);
  if (hit && Date.now() - hit.savedAt < META_TTL_MS) return hit.value;

  const club = await loadClubHome();
  const tags = club.club.members.map((member) => member.tag).slice(0, MAX_MEMBERS);
  const logs: Array<{ tag: string; battles: PlayerBattle[] }> = [];
  let unavailable = 0;

  for (let index = 0; index < tags.length; index += LOG_CONCURRENCY) {
    const slice = await Promise.all(
      tags.slice(index, index + LOG_CONCURRENCY).map(async (tag) => {
        try {
          return { tag, battles: await loadMemberBattles(tag) };
        } catch {
          return null;
        }
      }),
    );
    for (const log of slice) {
      if (log) logs.push(log);
      else unavailable += 1;
    }
  }
  if (logs.length === 0) throw new Error("No member battle logs could be read");

  const value = { ...aggregateBattles(logs, queue), unavailable, fetchedAt: Date.now() };
  cacheSet(cacheKey, value);
  return value;
}
