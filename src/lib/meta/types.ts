/** How fresh the value a screen is showing is. */
export type FreshnessKind = "live" | "cached" | "stale" | "offline";

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

/** BrawlAPI's static catalog: brawler art/names, map art, game modes. */
export interface Catalog {
  brawlers: BrawlerCatalogItem[];
  maps: MapCatalogItem[];
  modes: ModeCatalogItem[];
  fetchedAt: number;
  source: "BrawlAPI";
}
