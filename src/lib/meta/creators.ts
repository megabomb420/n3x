import { createServerFn } from "@tanstack/react-start";
import { cacheGet, cacheSet, freshnessFromAge } from "./cache";
import { loadCatalog, findBrawler } from "./brawlapi";
import { cubeLoad, num, str } from "./cube";
import { seasonValuesForWindow } from "./seasons";
import type { BrawlerCatalogItem, FreshnessKind } from "./types";

export type CreatorListKind = "full" | "meta" | "top";

export interface CreatorDef {
  id: string;
  name: string;
  handle: string;
  channelId: string;
}

export interface CreatorList {
  creator: CreatorDef;
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  watchUrl: string;
  views: number | null;
  kind: CreatorListKind;
}

export interface CommunityVoteRow {
  cubeName: string;
  votes: number;
  timestamp: string | null;
  catalog: BrawlerCatalogItem | null;
}

export interface CreatorListsPayload {
  lists: CreatorList[];
  fetchedAt: number;
  freshness: FreshnessKind;
  cacheAgeMs: number | null;
}

export interface CommunityVotesPayload {
  rows: CommunityVoteRow[];
  sampleSize: number;
  lastVoteAt: string | null;
  source: string;
  fetchedAt: number;
  freshness: FreshnessKind;
  cacheAgeMs: number | null;
}

export const CREATORS: CreatorDef[] = [
  {
    id: "spenlc",
    name: "SpenLC",
    handle: "@spenlc",
    channelId: "UCsuS8BRN4y6_QoBvAqTtSSg",
  },
  {
    id: "ash",
    name: "Ash",
    handle: "@ashbrawlstars",
    channelId: "UC874WmmCVtIwTG4gQbWHKUQ",
  },
  {
    id: "kairos",
    name: "KairosTime",
    handle: "@kairosgaming",
    channelId: "UCmG2EhfOwSjpPMX4LjGY__A",
  },
  {
    id: "cryingman",
    name: "CryingMan",
    handle: "@cryingman",
    channelId: "UCGShu88Lh2ZAtXX0qbV9fXA",
  },
];

const FEED = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

const LISTS_KEY = "creators:v3";
const VOTES_KEY = "community-votes:v1";
const LISTS_TTL_MS = 10 * 60_000;
const VOTES_TTL_MS = 2 * 60_000;

interface RssEntry {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number | null;
}

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

function attr(block: string, name: string, attrName: string): string {
  const re = new RegExp(`<${name}[^>]*\\s${attrName}="([^"]+)"`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

function parseFeed(xml: string): RssEntry[] {
  const chunks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const out: RssEntry[] = [];
  for (const chunk of chunks) {
    const videoId = tag(chunk, "yt:videoId");
    const title = tag(chunk, "title");
    const publishedAt = tag(chunk, "published");
    if (!videoId || !title || !publishedAt) continue;
    const viewsRaw = attr(chunk, "media:statistics", "views");
    const views = viewsRaw ? Number(viewsRaw) : null;
    out.push({
      videoId,
      title,
      publishedAt,
      views: Number.isFinite(views) ? views : null,
    });
  }
  return out;
}

function classify(title: string): { score: number; kind: CreatorListKind | null } {
  const t = title.toLowerCase();
  if (/\blive\b/.test(t) || /stream ends/.test(t)) return { score: 0, kind: null };
  if (/tier list/.test(t) && /rank(ing|s)? all|worst to best|pro tier/.test(t)) {
    return { score: 100, kind: "full" };
  }
  if (/pro tier list|best & worst|best & worst/.test(t)) {
    return { score: 95, kind: "full" };
  }
  if (/tier list/.test(t)) return { score: 90, kind: "full" };
  if (/ranking all|ranks all/.test(t)) return { score: 85, kind: "full" };
  if (/explaining new meta|new meta/.test(t)) return { score: 70, kind: "meta" };
  if (/top 10 best brawlers|best 15 brawlers|must max brawlers/.test(t)) {
    return { score: 55, kind: "top" };
  }
  return { score: 0, kind: null };
}

function pickLatest(entries: RssEntry[]): { entry: RssEntry; kind: CreatorListKind } | null {
  const matched: { entry: RssEntry; kind: CreatorListKind; score: number }[] = [];
  for (const entry of entries) {
    const { score, kind } = classify(entry.title);
    if (!kind || score <= 0) continue;
    matched.push({ entry, kind, score });
  }
  if (matched.length === 0) return null;
  matched.sort((a, b) => (a.entry.publishedAt < b.entry.publishedAt ? 1 : -1));
  const newest = matched[0];
  const newestMs = Date.parse(newest.entry.publishedAt);
  const recentFull = matched.find((m) => {
    if (m.kind !== "full") return false;
    const age = newestMs - Date.parse(m.entry.publishedAt);
    return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
  });
  const chosen = recentFull ?? newest;
  return { entry: chosen.entry, kind: chosen.kind };
}

async function fetchFeed(channelId: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(FEED(channelId), {
      headers: {
        accept: "application/atom+xml, application/xml, text/xml",
        "user-agent": "N3X-PWA/1.0 (Brawl Stars club companion)",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`YouTube feed ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function listForCreator(creator: CreatorDef): Promise<CreatorList | null> {
  const xml = await fetchFeed(creator.channelId);
  const picked = pickLatest(parseFeed(xml));
  if (!picked) return null;
  const { entry, kind } = picked;
  return {
    creator,
    videoId: entry.videoId,
    title: entry.title,
    publishedAt: entry.publishedAt,
    thumbnailUrl: `https://i.ytimg.com/vi/${entry.videoId}/mqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${entry.videoId}`,
    views: entry.views,
    kind,
  };
}

async function fetchAllCreatorLists(): Promise<{ lists: CreatorList[]; fetchedAt: number }> {
  const results = await Promise.allSettled(CREATORS.map(listForCreator));
  const lists: CreatorList[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) lists.push(r.value);
  }
  lists.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return { lists, fetchedAt: Date.now() };
}

export const getCreatorLists = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ lists: CreatorList[]; fetchedAt: number }> => {
    return fetchAllCreatorLists();
  },
);

function online(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function loadCreatorLists(): Promise<CreatorListsPayload> {
  const hit = cacheGet<{ lists: CreatorList[]; fetchedAt: number }>(LISTS_KEY);
  const fresh = hit && Date.now() - hit.savedAt < LISTS_TTL_MS;
  if (fresh) {
    const cacheAgeMs = Date.now() - hit.savedAt;
    return {
      ...hit.value,
      cacheAgeMs,
      freshness: freshnessFromAge(cacheAgeMs, online()),
    };
  }
  try {
    const value = await getCreatorLists();
    cacheSet(LISTS_KEY, value);
    return { ...value, cacheAgeMs: null, freshness: "live" };
  } catch (err) {
    if (hit) {
      const cacheAgeMs = Date.now() - hit.savedAt;
      return {
        ...hit.value,
        cacheAgeMs,
        freshness: freshnessFromAge(cacheAgeMs, online()),
      };
    }
    throw err;
  }
}

export async function loadCommunityVotes(): Promise<CommunityVotesPayload> {
  const hit = cacheGet<Omit<CommunityVotesPayload, "freshness" | "cacheAgeMs">>(VOTES_KEY);
  const fresh = hit && Date.now() - hit.savedAt < VOTES_TTL_MS;
  if (fresh) {
    const cacheAgeMs = Date.now() - hit.savedAt;
    return {
      ...hit.value,
      cacheAgeMs,
      freshness: freshnessFromAge(cacheAgeMs, online()),
    };
  }

  try {
    const catalog = await loadCatalog().catch(() => null);
    const res = await cubeLoad({
      measures: ["survey.picks_measure", "survey.timestamp_measure"],
      dimensions: ["survey.brawler_dimension"],
      filters: [
        {
          member: "survey.season_dimension",
          operator: "equals",
          values: seasonValuesForWindow("current"),
        },
      ],
      order: { "survey.picks_measure": "desc" },
      limit: 120,
      timezone: "UTC",
    });
    const rows: CommunityVoteRow[] = res.data
      .map((row) => {
        const cubeName = str(row, "survey.brawler_dimension");
        if (!cubeName) return null;
        return {
          cubeName,
          votes: num(row, "survey.picks_measure"),
          timestamp: str(row, "survey.timestamp_measure") || null,
          catalog: findBrawler(catalog, cubeName),
        };
      })
      .filter((r): r is CommunityVoteRow => r != null && r.votes > 0);

    const timestamps = rows.map((r) => r.timestamp).filter(Boolean) as string[];
    const value: Omit<CommunityVotesPayload, "freshness" | "cacheAgeMs"> = {
      rows,
      sampleSize: rows.reduce((s, r) => s + r.votes, 0),
      lastVoteAt: timestamps.sort().at(-1) ?? null,
      source: "Brawl Time Ninja community survey",
      fetchedAt: Date.now(),
    };
    cacheSet(VOTES_KEY, value);
    return { ...value, cacheAgeMs: null, freshness: "live" };
  } catch (err) {
    if (hit) {
      const cacheAgeMs = Date.now() - hit.savedAt;
      return {
        ...hit.value,
        cacheAgeMs,
        freshness: freshnessFromAge(cacheAgeMs, online()),
      };
    }
    throw err;
  }
}

export function kindLabel(kind: CreatorListKind): string {
  switch (kind) {
    case "full":
      return "Full list";
    case "meta":
      return "Meta update";
    case "top":
      return "Top picks";
  }
}
