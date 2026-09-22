/**
 * Display helpers for club data. These used to live in `parse.ts` next to the
 * Brawl Time Ninja HTML parsers; the parsers are gone (the Worker maps the
 * official API into these shapes now) and the pure helpers stayed.
 */
import { ROLE_ORDER, type ClubMember } from "./types";

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

/** Club order: leadership first, then trophies. */
export function sortMembers(members: ClubMember[]): ClubMember[] {
  return [...members].sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 9;
    const rb = ROLE_ORDER[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    return b.trophies - a.trophies;
  });
}
