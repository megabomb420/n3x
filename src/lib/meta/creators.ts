/**
 * The game's meta, as the people who publish it see it: the newest tier-list
 * and meta uploads from the creators' public YouTube feeds.
 *
 * The feeds carry no CORS headers, so the browser reads them through the Worker
 * (`GET /creators`), which also classifies the titles. Titles and dates only —
 * placements inside a video are not transcribed, because the app cannot see
 * them and guessing from a thumbnail would be invention.
 */
import { apiGet } from "@/lib/api/client";
import { cacheGet, cacheSet } from "./cache";

export interface CreatorVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  watchUrl: string;
  thumbnailUrl: string;
  kind: string | null;
}

export interface CreatorEntry {
  id: string;
  name: string;
  handle: string;
  channelUrl: string;
  /** Newest upload of any kind, so "nothing recent" is still answerable. */
  latest: CreatorVideo | null;
  /** The tier list the screen leads with. */
  list: CreatorVideo | null;
  recent: CreatorVideo[];
  error?: string;
}

export interface CreatorsPayload {
  updatedAt: number;
  source: string;
  creators: CreatorEntry[];
}

const CACHE_TTL_MS = 30 * 60_000;

/** Creator meta, cached on the device for half an hour. */
export async function loadCreators(): Promise<CreatorsPayload & { fetchedAt: number }> {
  const key = "creators:v1";
  const hit = cacheGet<CreatorsPayload>(key);
  if (hit && Date.now() - hit.savedAt < CACHE_TTL_MS) return { ...hit.value, fetchedAt: hit.savedAt };
  try {
    const payload = await apiGet<CreatorsPayload>("/creators");
    cacheSet(key, payload);
    return { ...payload, fetchedAt: Date.now() };
  } catch (err) {
    if (hit) return { ...hit.value, fetchedAt: hit.savedAt };
    throw err;
  }
}
