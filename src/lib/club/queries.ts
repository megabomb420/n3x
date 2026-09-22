/**
 * Club and member data, read from the hosted `n3x-api` Worker.
 *
 * One fetch, one shape: the Worker already returns `ClubLive` / `PlayerProfile`
 * with the join/leave log attached, so this module only adds the caches the UI
 * relies on (a 45s club window and a 60s player window, plus the last good
 * payload kept for the offline banner).
 */
import { apiGet } from "@/lib/api/client";
import { cacheGet, cacheSet, freshnessFromAge } from "@/lib/meta/cache";
import type { FreshnessKind } from "@/lib/meta/types";
import { bareTag, sortMembers } from "./format";
import { CLUB_NAME, CLUB_TAG, type ClubHomePayload, type PlayerProfile } from "./types";

const CLUB_TTL_MS = 45_000;
const PLAYER_TTL_MS = 60_000;

function online(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export interface ClubHomeView extends ClubHomePayload {
  freshness: FreshnessKind;
  cacheAgeMs: number | null;
}

/** The roster, the recent join/leave log and where they came from. */
export async function loadClubHome(): Promise<ClubHomeView> {
  const hit = cacheGet<ClubHomePayload>("club-home");
  if (hit && Date.now() - hit.savedAt < CLUB_TTL_MS) {
    const cacheAgeMs = Date.now() - hit.savedAt;
    return { ...hit.value, cacheAgeMs, freshness: freshnessFromAge(cacheAgeMs, online()) };
  }
  try {
    const payload = await apiGet<ClubHomePayload>("/club");
    const value: ClubHomePayload = {
      ...payload,
      club: { ...payload.club, members: sortMembers(payload.club.members) },
    };
    cacheSet("club-home", value);
    return { ...value, cacheAgeMs: null, freshness: "live" };
  } catch (err) {
    if (hit) {
      const cacheAgeMs = Date.now() - hit.savedAt;
      return { ...hit.value, cacheAgeMs, freshness: freshnessFromAge(cacheAgeMs, online()) };
    }
    throw err;
  }
}

/** One member's profile: trophies, Ranked Elo, brawlers, recent battles. */
export async function loadClubPlayer(tag: string): Promise<PlayerProfile> {
  const clean = bareTag(tag);
  const key = `club-player:${clean}`;
  const hit = cacheGet<PlayerProfile>(key);
  if (hit && Date.now() - hit.savedAt < PLAYER_TTL_MS) return hit.value;
  try {
    const profile = await apiGet<PlayerProfile>(`/player/${clean}`);
    cacheSet(key, profile);
    return profile;
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}

export { CLUB_NAME, CLUB_TAG };
