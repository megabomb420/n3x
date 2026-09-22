export const CLUB_TAG = "2JYGUQ2P8";
export const CLUB_NAME = "'N3X";

export type ClubRole = "president" | "vicePresident" | "senior" | "member";
export type ClubEventKind = "join" | "leave" | "role";
export type ClubType = "open" | "inviteOnly" | "closed" | string;

export interface ClubMember {
  tag: string;
  name: string;
  nameColor: string | null;
  role: ClubRole | string;
  trophies: number;
  iconId: number | null;
  iconUrl: string | null;
}

export interface ClubEvent {
  id: number;
  kind: ClubEventKind;
  playerTag: string;
  playerName: string;
  roleFrom: string | null;
  roleTo: string | null;
  occurredAt: string;
}

export interface ClubLive {
  tag: string;
  name: string;
  description: string;
  type: ClubType;
  badgeId: number | null;
  requiredTrophies: number;
  trophies: number;
  memberCount: number;
  members: ClubMember[];
  fetchedAt: number;
}

export interface ClubHomePayload {
  club: ClubLive;
  events: ClubEvent[];
  tracking: boolean;
  baseline: boolean;
  source: string;
  fetchedAt: number;
}

export interface PlayerBrawler {
  id: number;
  slug: string;
  name: string;
  power: number;
  rank: number;
  trophies: number;
  highestTrophies: number;
  hyper: boolean;
}

export interface PlayerBattle {
  timestamp: string;
  /** Official API battle type: `ranked` is the trophy ladder, `soloRanked`/`teamRanked` are Ranked. */
  type: string | null;
  /** False for friendlies, challenges and event modes, which never enter club meta. */
  competitive: boolean;
  ranked: boolean;
  result: string | null;
  victory: boolean | null;
  trophyChange: number | null;
  mode: string | null;
  map: string | null;
  brawler: string | null;
  brawlerTrophies: number | null;
}

export interface PlayerProfile {
  tag: string;
  name: string;
  nameColor: string | null;
  iconId: number | null;
  iconUrl: string | null;
  trophies: number;
  highestTrophies: number;
  expLevel: number;
  rankedElo: number | null;
  rankedRankName: string | null;
  highestAllTimeRankedElo: number | null;
  highestAllTimeRankedRankName: string | null;
  victories3v3: number;
  soloVictories: number;
  duoVictories: number;
  fameTierName: string | null;
  clubTag: string | null;
  clubName: string | null;
  inClub: boolean;
  clubRole: string | null;
  brawlers: PlayerBrawler[];
  battles: PlayerBattle[];
  fetchedAt: number;
  source: string;
}

export const ROLE_ORDER: Record<string, number> = {
  president: 0,
  vicePresident: 1,
  senior: 2,
  member: 3,
};

export const ROLE_LABEL: Record<string, string> = {
  president: "President",
  vicePresident: "Vice President",
  senior: "Senior",
  member: "Member",
};
