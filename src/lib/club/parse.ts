import { CLUB_TAG, ROLE_ORDER, type ClubLive, type ClubMember, type ClubRole } from "./types";

export function bareTag(tag: string | null | undefined): string {
  return (tag ?? "").replace(/^#/, "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export function profileIconUrl(id: number | null | undefined): string | null {
  if (id == null || !Number.isFinite(id)) return null;
  return `https://cdn.brawlify.com/profile-icons/regular/${id}.png`;
}

export function nameColorToCss(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (s.startsWith("#") && (s.length === 7 || s.length === 9)) return s.slice(0, 7);
  const m = /^0x([0-9a-f]{8})$/i.exec(s);
  if (m) return `#${m[1].slice(2)}`;
  return undefined;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Member";
  if (role === "president") return "President";
  if (role === "vicePresident") return "Vice President";
  if (role === "senior") return "Senior";
  if (role === "member") return "Member";
  return role;
}

export function sortMembers(members: ClubMember[]): ClubMember[] {
  return [...members].sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 9;
    const rb = ROLE_ORDER[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    return b.trophies - a.trophies;
  });
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

function extractVike(html: string): Record<string, unknown> {
  const match = html.match(
    /<script id="vike_pageContext" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error("Club source page had no data payload");
  const parsed: unknown = JSON.parse(match[1]);
  const ctx = asRecord(parsed);
  if (!ctx) throw new Error("Club source payload was malformed");
  return ctx;
}

function toMember(raw: unknown): ClubMember | null {
  const row = asRecord(raw);
  if (!row) return null;
  const tag = bareTag(str(row.tag));
  const name = str(row.name);
  if (!tag || !name) return null;
  const icon = asRecord(row.icon);
  const iconId = icon ? num(icon.id, NaN) : NaN;
  const roleRaw = str(row.role, "member");
  const role: ClubRole | string =
    roleRaw === "president" ||
    roleRaw === "vicePresident" ||
    roleRaw === "senior" ||
    roleRaw === "member"
      ? roleRaw
      : roleRaw || "member";
  return {
    tag,
    name,
    nameColor: str(row.nameColor) || null,
    role,
    trophies: num(row.trophies),
    iconId: Number.isFinite(iconId) ? iconId : null,
    iconUrl: Number.isFinite(iconId) ? profileIconUrl(iconId) : null,
  };
}

export function parseClubHtml(html: string, fetchedAt = Date.now()): ClubLive {
  const ctx = extractVike(html);
  const refs = asRecord(ctx.refs);
  const club = asRecord(refs?.club);
  if (!club) throw new Error("Live club roster was missing");
  const tag = bareTag(str(club.tag)) || CLUB_TAG;
  const members = Array.isArray(club.members)
    ? sortMembers(club.members.map(toMember).filter((m): m is ClubMember => m != null))
    : [];
  return {
    tag,
    name: str(club.name, "'N3X"),
    description: str(club.description),
    type: str(club.type, "inviteOnly"),
    badgeId: Number.isFinite(num(club.badgeId, NaN)) ? num(club.badgeId) : null,
    requiredTrophies: num(club.requiredTrophies),
    trophies: num(club.trophies),
    memberCount: members.length,
    members,
    fetchedAt,
  };
}

export function parsePiniaJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return asRecord(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return asRecord(raw);
}

export function parsePlayerHtml(html: string): Record<string, unknown> {
  const ctx = extractVike(html);
  const pinia = parsePiniaJson(ctx.piniaState);
  const json = asRecord(pinia?.json) ?? pinia;
  const brawlstars = asRecord(json?.brawlstars);
  const player = asRecord(brawlstars?.player);
  if (!player) throw new Error("Player profile was missing");
  return player;
}

export function findClubRole(members: ClubMember[], tag: string): string | null {
  const bare = bareTag(tag);
  return members.find((m) => m.tag === bare)?.role ?? null;
}
