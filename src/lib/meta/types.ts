export type Queue = "ladder" | "ranked";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type Tier = "S" | "A" | "B" | "C" | "D";

export type FreshnessKind = "live" | "cached" | "stale" | "offline";

export type TrophyFilterId = "all" | "0-999" | "1000+" | "1500+" | "2000+";

/** Ranked 2.0 league floor. Cube stores rank index 1–22, not raw ELO. */
export type LeagueFilterId =
  | "all"
  | "gold+"
  | "diamond+"
  | "mythic+"
  | "legendary+"
  | "masters+";

export type SeasonWindow = "current" | "sixWeeks";

export type CubeRow = Record<string, string | number | null | undefined>;

export interface CubeResult {
  data: CubeRow[];
  lastRefreshTime: string | null;
  query: unknown;
}

export interface CubeToken {
  token: string;
  expiresAt: number;
  fetchedAt: number;
}

export interface BrawlerCatalogItem {
  id: number;
  name: string;
  hash: string;
  slug: string;
  cubeName: string;
  rarity: string;
  rarityColor: string | null;
  className: string | null;
  imageUrl: string;
  imageBorderless: string;
  imageEmoji: string | null;
}

export interface MapCatalogItem {
  id: number;
  name: string;
  hash: string;
  imageUrl: string;
  disabled: boolean;
  modeName: string;
  modeId: number;
  modeHash: string;
  modeColor: string | null;
  modeImage: string | null;
}

export interface ModeCatalogItem {
  id: number;
  name: string;
  hash: string;
  scHash: string;
  color: string | null;
  imageUrl: string;
  disabled: boolean;
}

export interface Catalog {
  brawlers: BrawlerCatalogItem[];
  maps: MapCatalogItem[];
  modes: ModeCatalogItem[];
  fetchedAt: number;
  source: "BrawlAPI";
}

export interface DatasetMeta {
  source: string;
  sourceTimestamp: string | null;
  fetchedAt: number;
  lastRefreshTime: string | null;
  sampleSize: number;
  filters: {
    queue: Queue;
    season: SeasonWindow;
    seasonValues: string[];
    trophy: TrophyFilterId;
    league: LeagueFilterId;
    mode: string | null;
    map: string | null;
  };
  datasetType: string;
  freshness: FreshnessKind;
  cacheAgeMs: number | null;
}

export interface BrawlerStat {
  cubeName: string;
  winRate: number;
  winRateAdj: number;
  useRate: number;
  pickRate: number;
  picks: number;
  timestamp: string | null;
  confidence: Confidence;
  tier: Tier;
  metaScore: number;
  trend: number | null;
}

export interface RankedBrawler extends BrawlerStat {
  catalog: BrawlerCatalogItem | null;
  ladderTier: Tier | null;
  rankedTier: Tier | null;
}

export interface MetaPayload {
  rows: RankedBrawler[];
  dataset: DatasetMeta;
  modes: string[];
  maps: { mode: string; map: string; picks: number }[];
}

export interface ActiveMap {
  mode: string;
  map: string;
  picks: number;
  timestamp: string | null;
  eventId: string | null;
  active: boolean;
  catalog: MapCatalogItem | null;
  top: RankedBrawler[];
}

export interface MapMetaPayload {
  maps: ActiveMap[];
  dataset: DatasetMeta;
}

export interface FilterState {
  trophy: TrophyFilterId;
  league: LeagueFilterId;
  mode: string | null;
  map: string | null;
  season: SeasonWindow;
}

export interface AppFilters {
  queue: Queue;
  ladder: FilterState;
  ranked: FilterState;
}
