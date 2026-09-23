/**
 * One official leaderboard, from the `n3x-api` Worker
 * (`GET /ladder?type=…&country=…`).
 *
 * The Ladder tab reads it, and so does the club's own card — it wants the club's
 * place in the Polish club table — so the payload shape and the one loader live
 * here instead of inside either screen.
 */
import { apiGet } from "@/lib/api/client";

export type LadderType = "players" | "clubs";

export interface LadderRow {
  rank: number;
  tag: string;
  name: string;
  trophies: number;
  clubName: string | null;
  memberCount: number | null;
}

export interface LadderPayload {
  type: LadderType;
  country?: string;
  updatedAt: number;
  rows: LadderRow[];
}

/** One region's leaderboard, in the API's own order — never re-sorted here. */
export function loadLadder(type: LadderType, country: string): Promise<LadderPayload> {
  return apiGet<LadderPayload>(`/ladder?type=${type}&country=${encodeURIComponent(country)}`);
}
