import { createServerFn } from "@tanstack/react-start";
import { cacheGet, cacheSet, freshnessFromAge } from "./cache";
import type { FreshnessKind } from "./types";

export type CompetitiveKind = "ranked" | "draft" | "list" | "meta" | "guide";

export interface CompetitivePost {
  id: string;
  title: string;
  author: string;
  publishedAt: string;
  url: string;
  thumbnailUrl: string | null;
  kind: CompetitiveKind;
}

export interface CompetitiveFeedPayload {
  posts: CompetitivePost[];
  fetchedAt: number;
  source: string;
  sourceUrl: string;
  freshness: FreshnessKind;
  cacheAgeMs: number | null;
}

const SUB = "BrawlStarsCompetitive";
const FEED_URL = `https://www.reddit.com/r/${SUB}/new.rss`;
const FALLBACK_FEED = `https://www.reddit.com/r/${SUB}.rss`;
const CACHE_KEY = "reddit-bsc:v1";
const CLIENT_TTL_MS = 10 * 60_000;
const SERVER_TTL_MS = 90_000;
const MAX_POSTS = 8;

interface RssEntry {
  id: string;
  title: string;
  author: string;
  publishedAt: string;
  url: string;
  thumbnailUrl: string | null;
}

let serverCache: { at: number; posts: CompetitivePost[] } | null = null;

function decodeXml(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&([a-z]+);/g, (m, name) => named[name] ?? m)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

function parseFeed(xml: string): RssEntry[] {
  const chunks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const out: RssEntry[] = [];
  for (const chunk of chunks) {
    const rawId = tag(chunk, "id");
    const title = tag(chunk, "title");
    const publishedAt = tag(chunk, "published") || tag(chunk, "updated");
    const url =
      chunk.match(/<link[^>]*href="([^"]+)"/i)?.[1] ??
      "";
    const author = tag(chunk, "name").replace(/^\/u\//, "");
    const thumbRaw =
      chunk.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] ?? "";
    if (!title || !publishedAt || !url) continue;
    out.push({
      id: rawId || url,
      title,
      author,
      publishedAt,
      url: decodeXml(url),
      thumbnailUrl: thumbRaw ? decodeXml(thumbRaw) : null,
    });
  }
  return out;
}

export function classifyCompetitive(title: string): {
  score: number;
  kind: CompetitiveKind | null;
} {
  const t = title.toLowerCase();
  if (/welcome to r\//.test(t)) return { score: 0, kind: null };
  if (/\bfps\b|oneplus|iphone|android phone|does brawl stars actually run/.test(t)) {
    return { score: 0, kind: null };
  }
  if (/am i the worst|recover my trophies/.test(t)) return { score: 0, kind: null };
  if (/^what if\b/.test(t) && !/ranked|legendary|masters|mythic|draft/.test(t)) {
    return { score: 0, kind: null };
  }
  if (
    /balance change concept|buffies ideas|should .* (be )?(nerfed|buffed)/.test(t) &&
    !/\branked\b|\bmeta\b|\bdraft\b/.test(t)
  ) {
    return { score: 0, kind: null };
  }

  if (/tier\s*list|tierlist/.test(t)) return { score: 100, kind: "list" };
  if (/\bdraft\b|first pick|last pick|\bbans?\b/.test(t)) return { score: 95, kind: "draft" };
  if (
    /\branked\b|\blegendary\b|\bmasters?\b|\bmythic\b|\bdiamond\b|hard stuck|\bl[123]\+?\b/.test(
      t,
    )
  ) {
    return { score: 90, kind: "ranked" };
  }
  if (/\bmeta\b|how is .+ doing|\bcounter\b/.test(t)) return { score: 80, kind: "meta" };
  if (/\bguide\b/.test(t)) return { score: 70, kind: "guide" };
  return { score: 0, kind: null };
}

function pickPosts(entries: RssEntry[]): CompetitivePost[] {
  const matched: CompetitivePost[] = [];
  for (const entry of entries) {
    const { score, kind } = classifyCompetitive(entry.title);
    if (!kind || score <= 0) continue;
    matched.push({
      id: entry.id,
      title: entry.title,
      author: entry.author || "unknown",
      publishedAt: entry.publishedAt,
      url: entry.url,
      thumbnailUrl: entry.thumbnailUrl,
      kind,
    });
  }
  matched.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return matched.slice(0, MAX_POSTS);
}

async function fetchFeed(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/atom+xml, application/xml, text/xml",
        "user-agent": "N3X-PWA/1.0 (Brawl Stars club companion)",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Reddit feed ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCompetitivePosts(): Promise<CompetitivePost[]> {
  if (serverCache && Date.now() - serverCache.at < SERVER_TTL_MS) {
    return serverCache.posts;
  }
  let xml: string;
  try {
    xml = await fetchFeed(FEED_URL);
  } catch {
    xml = await fetchFeed(FALLBACK_FEED);
  }
  const posts = pickPosts(parseFeed(xml));
  serverCache = { at: Date.now(), posts };
  return posts;
}

export const getCompetitiveReddit = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ posts: CompetitivePost[]; fetchedAt: number }> => {
    const posts = await fetchCompetitivePosts();
    return { posts, fetchedAt: Date.now() };
  },
);

function online(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function loadCompetitiveReddit(): Promise<CompetitiveFeedPayload> {
  const hit = cacheGet<{ posts: CompetitivePost[]; fetchedAt: number }>(CACHE_KEY);
  const fresh = hit && Date.now() - hit.savedAt < CLIENT_TTL_MS;
  if (fresh) {
    const cacheAgeMs = Date.now() - hit.savedAt;
    return {
      posts: hit.value.posts,
      fetchedAt: hit.value.fetchedAt,
      source: `r/${SUB}`,
      sourceUrl: `https://www.reddit.com/r/${SUB}`,
      cacheAgeMs,
      freshness: freshnessFromAge(cacheAgeMs, online()),
    };
  }
  try {
    const value = await getCompetitiveReddit();
    cacheSet(CACHE_KEY, value);
    return {
      ...value,
      source: `r/${SUB}`,
      sourceUrl: `https://www.reddit.com/r/${SUB}`,
      cacheAgeMs: null,
      freshness: "live",
    };
  } catch (err) {
    if (hit) {
      const cacheAgeMs = Date.now() - hit.savedAt;
      return {
        posts: hit.value.posts,
        fetchedAt: hit.value.fetchedAt,
        source: `r/${SUB}`,
        sourceUrl: `https://www.reddit.com/r/${SUB}`,
        cacheAgeMs,
        freshness: freshnessFromAge(cacheAgeMs, online()),
      };
    }
    throw err;
  }
}

export function competitiveKindLabel(kind: CompetitiveKind): string {
  switch (kind) {
    case "ranked":
      return "Ranked";
    case "draft":
      return "Draft";
    case "list":
      return "Tier list";
    case "meta":
      return "Meta";
    case "guide":
      return "Guide";
  }
}
