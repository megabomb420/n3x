/**
 * The game's meta, as the people who publish it see it: recent uploads from the
 * creators' public YouTube feeds, classified by the backend.
 *
 * One request per channel (`GET /creators/<id>`) — a Worker invocation may only
 * make so many subrequests, so the fan-out happens here, four channels at a time,
 * with a per-channel cache. Titles and dates only; placements inside a video are
 * never transcribed.
 */
import { apiGet } from "@/lib/api/client";
import type { CreatorVideo } from "./creator-math";
import { cacheGet, cacheSet } from "./cache";

export type { CreatorVideo, MetaFilter } from "./creator-math";
export { countMentions, namesInTitle, otherVideos, pickLeadVideo } from "./creator-math";

export interface CreatorChannel {
  id: string;
  name: string;
  handle: string;
  channelUrl: string;
}

export interface CreatorIndex {
  updatedAt: number;
  source: string;
  creators: CreatorChannel[];
}

export interface CreatorFeed extends CreatorChannel {
  fetchedAt: number;
  entries: CreatorVideo[];
  error?: string;
}

const CACHE_TTL_MS = 30 * 60_000;
const INDEX_TTL_MS = 5 * 60_000;
const CONCURRENCY = 4;
/** Bumped when a stored shape changes, so an old payload is never re-read. */
const CACHE_TAG = "v3";

async function loadCreatorChannel(channel: CreatorChannel): Promise<CreatorFeed> {
  const key = `creator:${CACHE_TAG}:${channel.id}`;
  const hit = cacheGet<CreatorFeed>(key);
  if (hit && Date.now() - hit.savedAt < CACHE_TTL_MS) return hit.value;
  try {
    const feed = await apiGet<CreatorFeed>(`/creators/${channel.id}?tag=${CACHE_TAG}`);
    cacheSet(key, feed);
    return feed;
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}

/** Every known channel with its recent uploads; a failing feed keeps its error. */
export async function loadCreatorFeeds(): Promise<{ channels: CreatorFeed[]; fetchedAt: number }> {
  // The index is tiny and decides which channels exist, so it is revalidated on
  // a short window; the feeds themselves stay cached for half an hour.
  const indexKey = `creators-index:${CACHE_TAG}`;
  const indexHit = cacheGet<CreatorIndex>(indexKey);
  let index = indexHit && Date.now() - indexHit.savedAt < INDEX_TTL_MS ? indexHit.value : null;
  if (!index) {
    index = await apiGet<CreatorIndex>(`/creators?tag=${CACHE_TAG}`);
    cacheSet(indexKey, index);
  }

  const channels: CreatorFeed[] = [];
  for (let start = 0; start < index.creators.length; start += CONCURRENCY) {
    const slice = index.creators.slice(start, start + CONCURRENCY);
    const settled = await Promise.all(
      slice.map(async (channel) => {
        try {
          return await loadCreatorChannel(channel);
        } catch (err) {
          return { ...channel, fetchedAt: Date.now(), entries: [], error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );
    channels.push(...settled);
  }
  return { channels, fetchedAt: Date.now() };
}
