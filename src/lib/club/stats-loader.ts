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
import { loadClubHome, loadClubPlayer } from "./queries";
import type { PlayerBattle } from "./types";

export {
  LOW_SAMPLE,
  STATS_RANGES,
  aggregateBattles,
  battlesOnMap,
  battlesWithoutResult,
  inQueue,
  rangeStart,
} from "./stats";
export type { ClubMeta, MetaQueue, MetaRow, StatsRange } from "./stats";

const LOG_TTL_MS = 5 * 60_000;
const BUNDLE_TTL_MS = 10 * 60_000;
const RANKED_TTL_MS = 10 * 60_000;
const LOG_CONCURRENCY = 6;
const RANKED_CONCURRENCY = 6;
const MAX_MEMBERS = 30;
/** Bumped when a stored shape changes, so an old payload is never re-read. */
const CACHE_TAG = "v3";

export interface StatsMember {
  tag: string;
  name: string;
  role: string;
  trophies: number;
  iconUrl: string | null;
}

/** Current Ranked standing, read from the member's own profile. */
export interface MemberRanked {
  tag: string;
  elo: number | null;
  rankName: string | null;
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

/**
 * Ranked Elo and tier for every member, from their own profile — the club
 * endpoint publishes trophies only. Batched, and cached for ten minutes so
 * reopening the list does not hammer the Worker with 25 profiles.
 */
export async function loadMemberRanked(
  tags: string[],
  onProgress?: (soFar: MemberRanked[]) => void,
): Promise<MemberRanked[]> {
  const out: MemberRanked[] = tags.map((tag) => ({ tag, elo: null, rankName: null }));

  for (let index = 0; index < tags.length; index += RANKED_CONCURRENCY) {
    const slice = tags.slice(index, index + RANKED_CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (tag, offset) => {
        const key = `ranked:${CACHE_TAG}:${tag}`;
        const hit = cacheGet<MemberRanked>(key);
        if (hit && Date.now() - hit.savedAt < RANKED_TTL_MS) return { at: index + offset, value: hit.value };
        try {
          const profile = await loadClubPlayer(tag);
          const value: MemberRanked = { tag, elo: profile.rankedElo, rankName: profile.rankedRankName };
          cacheSet(key, value);
          return { at: index + offset, value };
        } catch {
          const value: MemberRanked = { tag, elo: hit?.value.elo ?? null, rankName: hit?.value.rankName ?? null };
          return { at: index + offset, value };
        }
      }),
    );
    for (const result of results) out[result.at] = result.value;
    // A profile takes a second or two, so the board fills in as batches land
    // instead of showing skeletons for the whole run.
    onProgress?.([...out]);
  }
  return out;
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
    iconUrl: member.iconUrl,
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
