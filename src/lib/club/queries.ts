import { createServerFn } from "@tanstack/react-start";
import { btnGetHtml, isBtnBlockedError } from "@/lib/http/btn-client";
import { outboundFetch } from "@/lib/http/outbound";
import { cacheGet, cacheSet, freshnessFromAge } from "@/lib/meta/cache";
import {
  CLUB_NAME,
  CLUB_TAG,
  type ClubEvent,
  type ClubEventKind,
  type ClubHomePayload,
  type ClubLive,
  type ClubMember,
  type PlayerBattle,
  type PlayerBrawler,
  type PlayerProfile,
} from "./types";
import {
  bareTag,
  findClubRole,
  parseClubHtml,
  parsePlayerHtml,
  profileIconUrl,
} from "./parse";

const BTN_ORIGIN = "https://brawltime.ninja";
const CLUB_TTL_MS = 45_000;
const PLAYER_TTL_MS = 60_000;

type SnapshotMember = {
  tag: string;
  name: string;
  role: string;
};

function online(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    return value;
  }
  return new Date().toISOString();
}

function dbConfigured(): boolean {
  const raw = typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
  return Boolean(raw && raw.trim());
}

async function fetchHtml(url: string): Promise<string> {
  const res = await outboundFetch(url, {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    timeoutMs: 16_000,
  });
  if (!res.ok) throw new Error(`Source unavailable (${res.status})`);
  return await res.text();
}

async function fetchHtmlSmart(path: string): Promise<string> {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const absolute = `${BTN_ORIGIN}${clean}`;
  const clientFirst = import.meta.env.PROD && typeof window !== "undefined";
  const viaClient = async () => btnGetHtml(clean);
  const viaServer = async () => fetchHtml(absolute);
  if (clientFirst) {
    try {
      return await viaClient();
    } catch (err) {
      if (!isBtnBlockedError(err)) {
        try {
          return await viaServer();
        } catch {
          throw err;
        }
      }
    }
    return viaServer();
  }
  try {
    return await viaServer();
  } catch (err) {
    if (typeof window !== "undefined") {
      try {
        return await viaClient();
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

const globalClub = globalThis as typeof globalThis & {
  __n3xClubMemo__?: { at: number; club: ClubLive };
};

async function fetchLiveClub(): Promise<ClubLive> {
  const memo = globalClub.__n3xClubMemo__;
  if (memo && Date.now() - memo.at < CLUB_TTL_MS) return memo.club;
  const html = await fetchHtmlSmart(`/club/${CLUB_TAG}`);
  const club = parseClubHtml(html, Date.now());
  globalClub.__n3xClubMemo__ = { at: Date.now(), club };
  return club;
}

function snapshotOf(members: ClubMember[]): SnapshotMember[] {
  return members.map((m) => ({ tag: m.tag, name: m.name, role: String(m.role) }));
}

function diffRoster(prev: SnapshotMember[], next: SnapshotMember[]): Omit<ClubEvent, "id" | "occurredAt">[] {
  const before = new Map(prev.map((m) => [m.tag, m]));
  const after = new Map(next.map((m) => [m.tag, m]));
  const out: Omit<ClubEvent, "id" | "occurredAt">[] = [];
  for (const [tag, member] of after) {
    if (!before.has(tag)) {
      out.push({
        kind: "join",
        playerTag: tag,
        playerName: member.name,
        roleFrom: null,
        roleTo: member.role,
      });
    }
  }
  for (const [tag, member] of before) {
    if (!after.has(tag)) {
      out.push({
        kind: "leave",
        playerTag: tag,
        playerName: member.name,
        roleFrom: member.role,
        roleTo: null,
      });
    }
  }
  for (const [tag, member] of after) {
    const old = before.get(tag);
    if (old && old.role !== member.role) {
      out.push({
        kind: "role",
        playerTag: tag,
        playerName: member.name,
        roleFrom: old.role,
        roleTo: member.role,
      });
    }
  }
  return out;
}

function parseSnapshotJson(raw: string): SnapshotMember[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const rec = asRecord(row);
        if (!rec) return null;
        const tag = bareTag(str(rec.tag));
        const name = str(rec.name);
        if (!tag || !name) return null;
        return { tag, name, role: str(rec.role, "member") };
      })
      .filter((m): m is SnapshotMember => m != null);
  } catch {
    return [];
  }
}

function asClubLive(raw: unknown): ClubLive {
  const rec = asRecord(raw);
  if (!rec) throw new Error("Invalid club snapshot");
  const membersRaw = Array.isArray(rec.members) ? rec.members : [];
  const members: ClubMember[] = membersRaw
    .map((row) => {
      const m = asRecord(row);
      if (!m) return null;
      const tag = bareTag(str(m.tag));
      const name = str(m.name);
      if (!tag || name.length < 1 || tag.length > 16) return null;
      return {
        tag,
        name: name.slice(0, 32),
        nameColor: str(m.nameColor) || null,
        role: str(m.role, "member"),
        trophies: num(m.trophies),
        iconId: Number.isFinite(num(m.iconId, NaN)) ? num(m.iconId) : null,
        iconUrl: str(m.iconUrl) || null,
      };
    })
    .filter((m): m is ClubMember => m != null)
    .slice(0, 30);
  if (members.length < 1) throw new Error("Invalid club snapshot");
  return {
    tag: bareTag(str(rec.tag)) || CLUB_TAG,
    name: str(rec.name, CLUB_NAME).slice(0, 32),
    description: str(rec.description).slice(0, 200),
    type: str(rec.type, "inviteOnly"),
    badgeId: Number.isFinite(num(rec.badgeId, NaN)) ? num(rec.badgeId) : null,
    requiredTrophies: num(rec.requiredTrophies),
    trophies: num(rec.trophies),
    memberCount: members.length,
    members,
    fetchedAt: num(rec.fetchedAt, Date.now()),
  };
}

async function persistAndDiff(live: ClubLive): Promise<{ events: ClubEvent[]; baseline: boolean; tracking: boolean }> {
  // Built preview without Neon: skip PGLite. It tries to open a bundled
  // data file that isn't there and takes the process down. Dev PGLite is fine.
  if (import.meta.env.PROD && !dbConfigured()) {
    return { events: [], baseline: false, tracking: false };
  }
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const existing = await sql<{
      members_json: string;
      trophies: number;
      member_count: number;
      fetched_at: string | Date;
    }>`select members_json, trophies, member_count, fetched_at from club_snapshot where id = 1`;

    const nextSnap = snapshotOf(live.members);
    const nextJson = JSON.stringify(nextSnap);

    if (existing.length === 0) {
      try {
        await sql`
          insert into club_snapshot (id, fetched_at, trophies, member_count, members_json)
          values (1, now(), ${live.trophies}, ${live.memberCount}, ${nextJson})
        `;
        return { events: [], baseline: true, tracking: true };
      } catch (err) {
        console.error("[n3x] club baseline insert raced", err);
      }
    }

    let prevRow = existing[0];
    if (!prevRow) {
      const retry = await sql<{
        members_json: string;
        trophies: number;
        member_count: number;
        fetched_at: string | Date;
      }>`select members_json, trophies, member_count, fetched_at from club_snapshot where id = 1`;
      prevRow = retry[0];
      if (!prevRow) return { events: [], baseline: false, tracking: false };
    }

    const prevSnap = parseSnapshotJson(prevRow.members_json);
    const changes = diffRoster(prevSnap, nextSnap);
    if (changes.length > 0) {
      for (const change of changes) {
        await sql`
          insert into club_events (kind, player_tag, player_name, role_from, role_to)
          values (
            ${change.kind},
            ${change.playerTag},
            ${change.playerName},
            ${change.roleFrom},
            ${change.roleTo}
          )
        `;
      }
    }
    if (changes.length > 0 || prevRow.trophies !== live.trophies) {
      await sql`
        update club_snapshot
        set fetched_at = now(),
            trophies = ${live.trophies},
            member_count = ${live.memberCount},
            members_json = ${nextJson}
        where id = 1
      `;
    }

    const rows = await sql<{
      id: number;
      kind: string;
      player_tag: string;
      player_name: string;
      role_from: string | null;
      role_to: string | null;
      occurred_at: string | Date;
    }>`select id, kind, player_tag, player_name, role_from, role_to, occurred_at
       from club_events
       order by occurred_at desc, id desc
       limit 40`;

    const events: ClubEvent[] = rows.map((row) => ({
      id: Number(row.id),
      kind: (row.kind === "join" || row.kind === "leave" || row.kind === "role"
        ? row.kind
        : "join") as ClubEventKind,
      playerTag: bareTag(row.player_tag),
      playerName: row.player_name,
      roleFrom: row.role_from,
      roleTo: row.role_to,
      occurredAt: toIso(row.occurred_at),
    }));
    return { events, baseline: false, tracking: true };
  } catch (err) {
    console.error("[n3x] club snapshot failed", err);
    return { events: [], baseline: false, tracking: false };
  }
}

export const getClubHome = createServerFn({ method: "POST" }).handler(
  async (): Promise<ClubHomePayload> => {
    const html = await fetchHtml(`${BTN_ORIGIN}/club/${CLUB_TAG}`);
    const club = parseClubHtml(html, Date.now());
    globalClub.__n3xClubMemo__ = { at: Date.now(), club };
    const persisted = await persistAndDiff(club);
    return {
      club,
      events: persisted.events,
      tracking: persisted.tracking,
      baseline: persisted.baseline,
      source: "Brawl Time Ninja public club page",
      fetchedAt: club.fetchedAt,
    };
  },
);

export const commitClubSnapshot = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const rec = asRecord(input);
    const clubRaw = rec && "club" in rec ? rec.club : input;
    return { club: asClubLive(clubRaw) };
  })
  .handler(async ({ data }) => persistAndDiff(data.club));

function slimBrawlers(raw: unknown): PlayerBrawler[] {
  const rec = asRecord(raw);
  if (!rec) return [];
  const out: PlayerBrawler[] = [];
  for (const [slug, value] of Object.entries(rec)) {
    const b = asRecord(value);
    if (!b) continue;
    const hyper = Array.isArray(b.hyperCharges) && b.hyperCharges.length > 0;
    out.push({
      id: num(b.id),
      slug,
      name: str(b.name, slug),
      power: num(b.power),
      rank: num(b.rank),
      trophies: num(b.trophies),
      highestTrophies: num(b.highestTrophies),
      hyper,
    });
  }
  out.sort((a, b) => b.trophies - a.trophies);
  return out;
}

function battleBrawler(
  raw: Record<string, unknown>,
  playerTag: string,
): { brawler: string | null; brawlerTrophies: number | null } {
  const want = bareTag(playerTag);
  const teams = raw.teams;
  if (Array.isArray(teams)) {
    for (const team of teams) {
      if (!Array.isArray(team)) continue;
      for (const p of team) {
        const rec = asRecord(p);
        if (!rec) continue;
        if (bareTag(str(rec.tag)) === want) {
          return {
            brawler: str(rec.brawler) || null,
            brawlerTrophies: Number.isFinite(num(rec.brawlerTrophies, NaN))
              ? num(rec.brawlerTrophies)
              : null,
          };
        }
      }
    }
  }
  const players = raw.players;
  if (Array.isArray(players)) {
    for (const p of players) {
      const rec = asRecord(p);
      if (!rec) continue;
      if (bareTag(str(rec.tag)) === want) {
        return {
          brawler: str(rec.brawler) || null,
          brawlerTrophies: Number.isFinite(num(rec.brawlerTrophies, NaN))
            ? num(rec.brawlerTrophies)
            : null,
        };
      }
    }
  }
  return { brawler: null, brawlerTrophies: null };
}

function slimBattles(raw: unknown, playerTag: string): PlayerBattle[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 25).map((row) => {
    const rec = asRecord(row) ?? {};
    const event = asRecord(rec.event);
    const used = battleBrawler(rec, playerTag);
    const trophy = num(rec.trophyChange, NaN);
    return {
      timestamp: str(rec.timestamp) || toIso(rec.timestamp),
      ranked: rec.ranked === true,
      result: str(rec.result) || null,
      victory: typeof rec.victory === "boolean" ? rec.victory : null,
      trophyChange: Number.isFinite(trophy) ? trophy : null,
      mode: event ? str(event.mode) || null : null,
      map: event ? str(event.map) || null : null,
      brawler: used.brawler,
      brawlerTrophies: used.brawlerTrophies,
    };
  });
}

function slimPlayer(raw: Record<string, unknown>, clubRole: string | null): PlayerProfile {
  const tag = bareTag(str(raw.tag));
  const icon = asRecord(raw.icon);
  const iconId = icon ? num(icon.id, NaN) : NaN;
  const club = asRecord(raw.club);
  const clubTag = club ? bareTag(str(club.tag)) : "";
  return {
    tag,
    name: str(raw.name, "Player"),
    nameColor: str(raw.nameColor) || null,
    iconId: Number.isFinite(iconId) ? iconId : null,
    iconUrl: Number.isFinite(iconId) ? profileIconUrl(iconId) : null,
    trophies: num(raw.trophies),
    highestTrophies: num(raw.highestTrophies),
    expLevel: num(raw.expLevel),
    rankedElo: Number.isFinite(num(raw.rankedElo, NaN)) ? num(raw.rankedElo) : null,
    rankedRankName: str(raw.rankedRankName) || null,
    highestAllTimeRankedElo: Number.isFinite(num(raw.highestAllTimeRankedElo, NaN))
      ? num(raw.highestAllTimeRankedElo)
      : null,
    highestAllTimeRankedRankName: str(raw.highestAllTimeRankedRankName) || null,
    victories3v3: num(raw["3vs3Victories"]),
    soloVictories: num(raw.soloVictories),
    duoVictories: num(raw.duoVictories),
    fameTierName: str(raw.fameTierName) || null,
    clubTag: clubTag || null,
    clubName: club ? str(club.name) || null : null,
    inClub: clubTag === CLUB_TAG,
    clubRole,
    brawlers: slimBrawlers(raw.brawlers),
    battles: slimBattles(raw.battles, tag),
    fetchedAt: Date.now(),
    source: "Brawl Time Ninja public profile",
  };
}

export const getClubPlayer = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const tag =
      typeof input === "object" && input !== null && "tag" in input
        ? String((input as { tag: unknown }).tag)
        : "";
    const clean = bareTag(tag);
    if (!/^[0-9A-Z]{3,16}$/.test(clean)) throw new Error("Invalid player tag");
    return { tag: clean };
  })
  .handler(async ({ data }): Promise<PlayerProfile> => {
    const html = await fetchHtml(`${BTN_ORIGIN}/profile/${data.tag}`);
    const raw = parsePlayerHtml(html);
    let clubRole: string | null = null;
    try {
      const club = await fetchLiveClub();
      clubRole = findClubRole(club.members, data.tag);
    } catch {
      clubRole = null;
    }
    return slimPlayer(raw, clubRole);
  });

export interface ClubHomeView extends ClubHomePayload {
  freshness: import("@/lib/meta/types").FreshnessKind;
  cacheAgeMs: number | null;
}

async function assembleHome(club: ClubLive): Promise<ClubHomePayload> {
  let persisted = { events: [] as ClubEvent[], tracking: false, baseline: false };
  try {
    persisted = await commitClubSnapshot({ data: { club } });
  } catch {
    persisted = { events: [], tracking: false, baseline: false };
  }
  return {
    club,
    events: persisted.events,
    tracking: persisted.tracking,
    baseline: persisted.baseline,
    source: "Brawl Time Ninja public club page",
    fetchedAt: club.fetchedAt,
  };
}

export async function loadClubHome(): Promise<ClubHomeView> {
  const hit = cacheGet<ClubHomePayload>("club-home");
  const fresh = hit && Date.now() - hit.savedAt < CLUB_TTL_MS;
  if (fresh) {
    const cacheAgeMs = Date.now() - hit.savedAt;
    return {
      ...hit.value,
      cacheAgeMs,
      freshness: freshnessFromAge(cacheAgeMs, online()),
    };
  }

  const clientFirst = import.meta.env.PROD && typeof window !== "undefined";

  const fromServer = async (): Promise<ClubHomePayload> => getClubHome();
  const fromClient = async (): Promise<ClubHomePayload> => {
    const html = await btnGetHtml(`/club/${CLUB_TAG}`);
    const club = parseClubHtml(html, Date.now());
    return assembleHome(club);
  };

  const steps = clientFirst ? [fromClient, fromServer] : [fromServer, fromClient];
  let last: unknown;
  for (const step of steps) {
    try {
      const value = await step();
      cacheSet("club-home", value);
      return { ...value, cacheAgeMs: null, freshness: "live" };
    } catch (err) {
      last = err;
    }
  }

  if (hit) {
    const cacheAgeMs = Date.now() - hit.savedAt;
    return {
      ...hit.value,
      cacheAgeMs,
      freshness: freshnessFromAge(cacheAgeMs, online()),
    };
  }
  if (last instanceof Error) throw last;
  throw new Error("Source unavailable (403)");
}

export async function loadClubPlayer(tag: string): Promise<PlayerProfile> {
  const clean = bareTag(tag);
  const key = `club-player:${clean}`;
  const hit = cacheGet<PlayerProfile>(key);
  const fresh = hit && Date.now() - hit.savedAt < PLAYER_TTL_MS;
  if (fresh) return hit.value;

  const clientFirst = import.meta.env.PROD && typeof window !== "undefined";
  const fromServer = async () => getClubPlayer({ data: { tag: clean } });
  const fromClient = async (): Promise<PlayerProfile> => {
    const html = await btnGetHtml(`/profile/${clean}`);
    const raw = parsePlayerHtml(html);
    let clubRole: string | null = null;
    try {
      const home = cacheGet<ClubHomePayload>("club-home");
      if (home?.value.club) clubRole = findClubRole(home.value.club.members, clean);
    } catch {
      clubRole = null;
    }
    return slimPlayer(raw, clubRole);
  };

  const steps = clientFirst ? [fromClient, fromServer] : [fromServer, fromClient];
  let last: unknown;
  for (const step of steps) {
    try {
      const value = await step();
      cacheSet(key, value);
      return value;
    } catch (err) {
      last = err;
    }
  }
  if (hit) return hit.value;
  if (last instanceof Error) throw last;
  throw new Error("Source unavailable (403)");
}

export { CLUB_NAME, CLUB_TAG };
