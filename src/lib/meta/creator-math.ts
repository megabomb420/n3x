/**
 * Creator-meta arithmetic — pure, no I/O, so it can be tested directly.
 *
 * The tab shows titles and dates only; everything here works on titles, never on
 * what is inside a video.
 */
export interface CreatorVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  watchUrl: string;
  thumbnailUrl: string;
  kind: string | null;
}

/** `tierLists` shows only uploads the backend tagged; `everything` shows the feed. */
export type MetaFilter = "tierLists" | "everything";

const TIER_LIST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_KEPT = 3;

/**
 * The upload a card leads with: a tier list from the last week if there is one
 * (a full ranking says more than yesterday's guide), otherwise the newest tagged
 * upload, otherwise — in `everything` — the channel's newest upload at all.
 */
export function pickLeadVideo(entries: CreatorVideo[], filter: MetaFilter): CreatorVideo | null {
  const tagged = entries.filter((entry) => entry.kind);
  if (filter === "everything") return entries[0] ?? null;
  const newest = tagged[0] ?? null;
  if (!newest) return null;
  const newestAt = Date.parse(newest.publishedAt);
  const recentTierList = tagged.find(
    (entry) => entry.kind === "tier list" && newestAt - Date.parse(entry.publishedAt) <= TIER_LIST_WINDOW_MS,
  );
  return recentTierList ?? newest;
}

/** The compact list under a card's lead video. */
export function otherVideos(
  entries: CreatorVideo[],
  lead: CreatorVideo | null,
  filter: MetaFilter,
  limit = RECENT_KEPT,
): CreatorVideo[] {
  const rest = filter === "everything" ? entries : entries.filter((entry) => entry.kind);
  return rest.filter((entry) => entry.videoId !== lead?.videoId).slice(0, limit);
}

/** Names of at least three characters that appear as whole words in a title. */
export function namesInTitle(title: string, names: string[]): string[] {
  return names.filter((name) => {
    if (name.length < 3) return false;
    return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title);
  });
}

/**
 * How often each name is mentioned across the titles of a window, most named
 * first. This is a reading of the headlines, not a tier list: a brawler named
 * twice is named twice.
 */
export function countMentions(
  videos: CreatorVideo[],
  names: string[],
  sinceMs: number,
  limit = 8,
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const video of videos) {
    if (Date.parse(video.publishedAt) < sinceMs) continue;
    for (const name of namesInTitle(video.title, names)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
