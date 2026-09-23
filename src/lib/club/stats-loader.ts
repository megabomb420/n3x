/**
 * Club stats loader.
 *
 * One request per member, each its own Worker invocation (a single invocation
 * may only make so many subrequests), with a per-tag cache so a repeat view
 * costs nothing. Member and time-range choices are applied later, in
 * `aggregateBattles`, so switching them does not refetch.
 */
import { apiGet } from "@/lib/api/client";
import { cacheGet, cacheSet } from "@/lib/meta/cache";
import { loadClubHome } from "./queries";
import type { PlayerBattle } from "./types";

export { LOW_SAMPLE, STATS_RANGES, aggregateBattles, rangeStart } from "./stats";
export type { ClubMeta, MetaQueue, MetaRow, StatsRange } from "./stats";

const LOG_TTL_MS = 5 * 60_000;
const BUNDLE_TTL_MS = 10 * 60_000;
const LOG_CONCURRENCY = 6;
const MAX_MEMBERS = 30;
/** Bumped when a stored shape changes, so an old payload is never re-read. */
const CACHE_TAG = "v2";

export interface StatsMember {
  tag: string;
  name: string;
  role: string;
  trophies: number;
}

export interface ClubLogs {
  members: StatsMember[];
  logs: Array<{ tag: string; battles: PlayerBattle[] }>;
  unavailable: number;
  fetchedAt: number;
}

interface BattleLogPayload {
  tag: string;
  battles: PlayerBattle[];
}

async function loadMemberBattles(tag: string): Promise<PlayerBattle[]> {
  const key = `battles:${CACHE_TAG}:${tag}`;
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

/** Every member's recent log, plus the roster the member picker reads. */
export async function loadClubLogs(): Promise<ClubLogs> {
  const cacheKey = `club-logs:${CACHE_TAG}`;
  const hit = cacheGet<ClubLogs>(cacheKey);
  if (hit && Date.now() - hit.savedAt < BUNDLE_TTL_MS) return hit.value;

  const club = await loadClubHome();
  const members = club.club.members.slice(0, MAX_MEMBERS).map((member) => ({
    tag: member.tag,
    name: member.name,
    role: String(member.role),
    trophies: member.trophies,
  }));
  const logs: Array<{ tag: string; battles: PlayerBattle[] }> = [];
  let unavailable = 0;

  for (let index = 0; index < members.length; index += LOG_CONCURRENCY) {
    const slice = await Promise.all(
      members.slice(index, index + LOG_CONCURRENCY).map(async (member) => {
        try {
          return { tag: member.tag, battles: await loadMemberBattles(member.tag) };
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

  const value = { members, logs, unavailable, fetchedAt: Date.now() };
  cacheSet(cacheKey, value);
  return value;
}
