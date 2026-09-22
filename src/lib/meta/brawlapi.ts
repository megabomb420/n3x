import type { BrawlerCatalogItem, Catalog, MapCatalogItem, ModeCatalogItem } from "./types";
import { brawltimeSlug, normalizeName } from "./names";
import { cacheGet, cacheSet } from "./cache";

const BASE = "https://api.brawlapi.com";
const CATALOG_TTL_MS = 12 * 60 * 60 * 1000;

interface RawBrawler {
  id: number;
  name: string;
  hash: string;
  imageUrl: string;
  imageUrl2: string;
  imageUrl3?: string;
  class?: { name?: string };
  rarity?: { name?: string; color?: string };
  released?: boolean;
}

interface RawMap {
  id: number;
  name: string;
  hash: string;
  imageUrl: string;
  disabled: boolean;
  gameMode?: {
    id: number;
    name: string;
    hash: string;
    color?: string;
    imageUrl?: string;
  };
}

interface RawMode {
  id: number;
  name: string;
  hash: string;
  scHash?: string;
  color?: string;
  imageUrl: string;
  disabled: boolean;
}

function looksLikeClass(name: string | undefined): string | null {
  if (!name) return null;
  if (name.length > 24) return null;
  if (/\s{2,}/.test(name)) return null;
  return name;
}

function toBrawler(raw: RawBrawler): BrawlerCatalogItem {
  const cubeName = raw.name.toUpperCase();
  return {
    id: raw.id,
    name: raw.name,
    hash: raw.hash,
    slug: brawltimeSlug(cubeName),
    cubeName,
    rarity: raw.rarity?.name ?? "Unknown",
    rarityColor: raw.rarity?.color ?? null,
    className: looksLikeClass(raw.class?.name),
    imageUrl: raw.imageUrl,
    imageBorderless: raw.imageUrl2 || raw.imageUrl,
    imageEmoji: raw.imageUrl3 ?? null,
  };
}

function toMap(raw: RawMap): MapCatalogItem {
  return {
    id: raw.id,
    name: raw.name,
    hash: raw.hash,
    imageUrl: raw.imageUrl,
    disabled: raw.disabled,
    modeName: raw.gameMode?.name ?? "",
    modeId: raw.gameMode?.id ?? 0,
    modeHash: raw.gameMode?.hash ?? "",
    modeColor: raw.gameMode?.color ?? null,
    modeImage: raw.gameMode?.imageUrl ?? null,
  };
}

function toMode(raw: RawMode): ModeCatalogItem {
  return {
    id: raw.id,
    name: raw.name,
    hash: raw.hash,
    scHash: raw.scHash ?? raw.hash,
    color: raw.color ?? null,
    imageUrl: raw.imageUrl,
    disabled: raw.disabled,
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16_000);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`BrawlAPI ${path} failed (${res.status})`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadCatalog(): Promise<Catalog> {
  const cached = cacheGet<Catalog>("catalog");
  if (cached && Date.now() - cached.savedAt < CATALOG_TTL_MS) {
    return cached.value;
  }

  try {
    const [brawlersRes, mapsRes, modesRes] = await Promise.all([
      fetchJson<{ list: RawBrawler[] }>("/v1/brawlers"),
      fetchJson<{ list: RawMap[] }>("/v1/maps"),
      fetchJson<{ list: RawMode[] }>("/v1/gamemodes"),
    ]);

    const catalog: Catalog = {
      brawlers: (brawlersRes.list ?? []).filter((b) => b.released !== false).map(toBrawler),
      maps: (mapsRes.list ?? []).map(toMap),
      modes: (modesRes.list ?? []).map(toMode),
      fetchedAt: Date.now(),
      source: "BrawlAPI",
    };
    cacheSet("catalog", catalog);
    return catalog;
  } catch (err) {
    if (cached) return cached.value;
    throw err;
  }
}

export function findBrawler(
  catalog: Catalog | null,
  cubeName: string,
): BrawlerCatalogItem | null {
  if (!catalog) return null;
  const key = normalizeName(cubeName);
  return (
    catalog.brawlers.find((b) => normalizeName(b.cubeName) === key) ??
    catalog.brawlers.find((b) => normalizeName(b.name) === key) ??
    catalog.brawlers.find((b) => normalizeName(b.hash) === key) ??
    null
  );
}

export function findMap(catalog: Catalog | null, mapName: string): MapCatalogItem | null {
  if (!catalog) return null;
  const key = normalizeName(mapName);
  return catalog.maps.find((m) => normalizeName(m.name) === key) ?? null;
}

export function portraitUrl(item: BrawlerCatalogItem | null, cubeName: string): string {
  if (item?.imageBorderless) return item.imageBorderless;
  return `https://media.brawltime.ninja/brawlers/${brawltimeSlug(cubeName)}/avatar.png?size=160`;
}
