import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppFilters, FilterState, LeagueFilterId, Queue, TrophyFilterId } from "@/lib/meta/types";

const defaultLadder: FilterState = {
  trophy: "1000+",
  league: "all",
  mode: null,
  map: null,
  season: "current",
};

const defaultRanked: FilterState = {
  trophy: "all",
  league: "all",
  mode: null,
  map: null,
  season: "current",
};

interface FilterStore extends AppFilters {
  setQueue: (queue: Queue) => void;
  setTrophy: (trophy: TrophyFilterId) => void;
  setLeague: (league: LeagueFilterId) => void;
  setMode: (mode: string | null) => void;
  setMap: (map: string | null) => void;
  setSeason: (season: FilterState["season"]) => void;
  resetCurrent: () => void;
}

function patchCurrent(
  s: AppFilters,
  patch: Partial<FilterState>,
): Pick<AppFilters, "ladder" | "ranked"> {
  if (s.queue === "ladder") return { ladder: { ...s.ladder, ...patch }, ranked: s.ranked };
  return { ladder: s.ladder, ranked: { ...s.ranked, ...patch } };
}

function hydrateQueue(base: FilterState, raw: unknown): FilterState {
  const p = raw && typeof raw === "object" ? (raw as Partial<FilterState>) : {};
  return { ...base, ...p, league: p.league ?? base.league, trophy: p.trophy ?? base.trophy };
}

export const useFilters = create<FilterStore>()(
  persist(
    (set) => ({
      queue: "ladder",
      ladder: defaultLadder,
      ranked: defaultRanked,
      setQueue: (queue) => set({ queue }),
      setTrophy: (trophy) => set((s) => patchCurrent(s, { trophy })),
      setLeague: (league) => set((s) => patchCurrent(s, { league })),
      setMode: (mode) => set((s) => patchCurrent(s, { mode, map: null })),
      setMap: (map) => set((s) => patchCurrent(s, { map })),
      setSeason: (season) => set((s) => patchCurrent(s, { season })),
      resetCurrent: () =>
        set((s) =>
          s.queue === "ladder" ? { ladder: defaultLadder } : { ranked: defaultRanked },
        ),
    }),
    {
      name: "hotlane:filters",
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppFilters>;
        return {
          ...current,
          ...p,
          ladder: hydrateQueue(defaultLadder, p.ladder),
          ranked: hydrateQueue(defaultRanked, {
            ...(typeof p.ranked === "object" && p.ranked ? p.ranked : {}),
            // Old Ranked trophy buckets were brawler trophies — drop them.
            trophy: "all",
          }),
        };
      },
    },
  ),
);
