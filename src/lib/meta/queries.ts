import { cacheGet, cacheSet, freshnessFromAge } from "./cache";
import { findBrawler, findMap, loadCatalog } from "./brawlapi";
import {
  CUBE_SOURCE,
  cubeLoad,
  num,
  queryMapCube,
  str,
  trophyRangeCubeFilter,
} from "./cube";
import { scorePopulation } from "./scoring";
import { seasonValuesForWindow } from "./seasons";
import type {
  ActiveMap,
  Catalog,
  DatasetMeta,
  FilterState,
  MapMetaPayload,
  MetaPayload,
  Queue,
  RankedBrawler,
} from "./types";

const ACTIVE_MS = 90 * 60 * 1000;

function cacheKey(prefix: string, queue: Queue, filters: FilterState, extra = ""): string {
  const range = queue === "ranked" ? `lg:${filters.league ?? "all"}` : `tr:${filters.trophy}`;
  return [
    prefix,
    queue,
    filters.season,
    range,
    filters.mode ?? "-",
    filters.map ?? "-",
    extra,
  ].join("|");
}

function online(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function shareRates<T extends { useRateRaw: number; picks: number }>(
  rows: T[],
): (T & { useRate: number; pickRate: number })[] {
  const useSum = rows.reduce((s, r) => s + r.useRateRaw, 0) || 1;
  const pickSum = rows.reduce((s, r) => s + r.picks, 0) || 1;
  return rows.map((r) => ({
    ...r,
    useRate: r.useRateRaw / useSum,
    pickRate: r.picks / pickSum,
  }));
}

function toStatRows(
  data: Array<Record<string, string | number | null | undefined>>,
  catalog: Catalog | null,
): RankedBrawler[] {
  const parsed = data
    .map((row) => {
      const cubeName = str(row, "map.brawler_dimension");
      if (!cubeName) return null;
      return {
        cubeName,
        winRate: num(row, "map.winRate_measure"),
        winRateAdj: num(row, "map.winRateAdj_measure"),
        useRateRaw: num(row, "map.useRate_measure"),
        picks: num(row, "map.picks_measure"),
        timestamp: str(row, "map.timestamp_measure") || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null && r.picks > 0);

  const rated = shareRates(parsed);
  const scored = scorePopulation(rated);

  return scored
    .map((row) => {
      const catalogItem = findBrawler(catalog, row.cubeName);
      return {
        cubeName: row.cubeName,
        winRate: row.winRate,
        winRateAdj: row.winRateAdj,
        useRate: row.useRate,
        pickRate: row.pickRate,
        picks: row.picks,
        timestamp: row.timestamp,
        confidence: row.confidence,
        tier: row.tier,
        metaScore: row.metaScore,
        trend: null as number | null,
        catalog: catalogItem,
        ladderTier: null,
        rankedTier: null,
      };
    })
    .sort((a, b) => b.metaScore - a.metaScore);
}

function datasetFrom(
  sampleSize: number,
  sourceTimestamp: string | null,
  lastRefreshTime: string | null,
  fetchedAt: number,
  queue: Queue,
  filters: FilterState,
  datasetType: string,
  cacheAgeMs: number | null,
): DatasetMeta {
  return {
    source: CUBE_SOURCE,
    sourceTimestamp,
    fetchedAt,
    lastRefreshTime,
    sampleSize,
    filters: {
      queue,
      season: filters.season,
      seasonValues: seasonValuesForWindow(filters.season),
      trophy: filters.trophy,
      league: filters.league ?? "all",
      mode: filters.mode,
      map: filters.map,
    },
    datasetType,
    freshness: freshnessFromAge(cacheAgeMs, online()),
    cacheAgeMs,
  };
}

async function withCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<{ value: T; cacheAgeMs: number | null }> {
  const hit = cacheGet<T>(key);
  const fresh = hit && Date.now() - hit.savedAt < ttlMs;
  if (fresh) return { value: hit.value, cacheAgeMs: Date.now() - hit.savedAt };
  try {
    const value = await loader();
    cacheSet(key, value);
    return { value, cacheAgeMs: null };
  } catch (err) {
    if (hit) return { value: hit.value, cacheAgeMs: Date.now() - hit.savedAt };
    throw err;
  }
}

interface RawMeta {
  rows: RankedBrawler[];
  modes: string[];
  maps: { mode: string; map: string; picks: number }[];
  sampleSize: number;
  sourceTimestamp: string | null;
  lastRefreshTime: string | null;
  fetchedAt: number;
}

function queryRange(queue: Queue, filters: FilterState) {
  return {
    trophy: filters.trophy,
    league: filters.league ?? "all",
  };
}

export async function loadMeta(queue: Queue, filters: FilterState): Promise<MetaPayload> {
  const catalog = await loadCatalog().catch(() => null);
  const key = cacheKey("meta", queue, filters);
  const { value, cacheAgeMs } = await withCache<RawMeta>(key, 2 * 60_000, async () => {
    const range = queryRange(queue, filters);
    const [brawlerRes, modeRes, mapRes] = await Promise.all([
      queryMapCube({
        queue,
        season: filters.season,
        ...range,
        mode: filters.mode,
        map: filters.map,
        dimensions: ["map.brawler_dimension"],
        limit: 200,
        orderMeasure: "map.winRateAdj_measure",
      }),
      queryMapCube({
        queue,
        season: filters.season,
        ...range,
        mode: null,
        map: null,
        dimensions: ["map.mode_dimension"],
        measures: ["map.picks_measure"],
        limit: 40,
      }),
      queryMapCube({
        queue,
        season: filters.season,
        ...range,
        mode: filters.mode,
        map: null,
        dimensions: ["map.mode_dimension", "map.map_dimension"],
        measures: ["map.picks_measure"],
        limit: 80,
      }),
    ]);

    const rows = toStatRows(brawlerRes.data, catalog);
    const sampleSize = rows.reduce((s, r) => s + r.picks, 0);
    const timestamps = rows.map((r) => r.timestamp).filter(Boolean) as string[];
    const sourceTimestamp = timestamps.sort().at(-1) ?? null;

    return {
      rows,
      modes: modeRes.data
        .map((r) => str(r, "map.mode_dimension"))
        .filter(Boolean)
        .sort(),
      maps: mapRes.data
        .map((r) => ({
          mode: str(r, "map.mode_dimension"),
          map: str(r, "map.map_dimension"),
          picks: num(r, "map.picks_measure"),
        }))
        .filter((m) => m.mode && m.map)
        .sort((a, b) => b.picks - a.picks),
      sampleSize,
      sourceTimestamp,
      lastRefreshTime: brawlerRes.lastRefreshTime,
      fetchedAt: Date.now(),
    };
  });

  return {
    rows: value.rows,
    modes: value.modes,
    maps: value.maps,
    dataset: datasetFrom(
      value.sampleSize,
      value.sourceTimestamp,
      value.lastRefreshTime,
      value.fetchedAt,
      queue,
      filters,
      "brawler-meta",
      cacheAgeMs,
    ),
  };
}

export async function loadMapBoard(queue: Queue, filters: FilterState): Promise<MapMetaPayload> {
  const catalog = await loadCatalog().catch(() => null);
  const key = cacheKey("maps", queue, filters);
  const { value, cacheAgeMs } = await withCache<{
    maps: ActiveMap[];
    sampleSize: number;
    sourceTimestamp: string | null;
    lastRefreshTime: string | null;
    fetchedAt: number;
  }>(key, 2 * 60_000, async () => {
    const range = queryRange(queue, filters);
    const listRes = await queryMapCube({
      queue,
      season: filters.season,
      ...range,
      mode: filters.mode,
      map: null,
      dimensions: ["map.mode_dimension", "map.map_dimension"],
      measures: ["map.picks_measure", "map.timestamp_measure", "map.eventId_measure"],
      limit: 80,
      orderMeasure: "map.timestamp_measure",
    });

    const listed = listRes.data
      .map((r) => {
        const mode = str(r, "map.mode_dimension");
        const map = str(r, "map.map_dimension");
        const timestamp = str(r, "map.timestamp_measure") || null;
        const ts = timestamp ? Date.parse(timestamp) : 0;
        return {
          mode,
          map,
          picks: num(r, "map.picks_measure"),
          timestamp,
          eventId: str(r, "map.eventId_measure") || null,
          active: ts > 0 && Date.now() - ts < ACTIVE_MS,
          catalog: findMap(catalog, map),
          top: [] as RankedBrawler[],
        };
      })
      .filter((m) => m.mode && m.map);

    const focus = listed.filter((m) => m.active).slice(0, 24);
    const fallback = listed.slice(0, 16);
    const targets = (focus.length >= 4 ? focus : fallback).slice(0, 20);
    const mapNames = [...new Set(targets.map((m) => m.map))];

    const rangeFilter = trophyRangeCubeFilter(queue, filters.trophy, filters.league);
    let brawlerRes = { data: [] as typeof listRes.data, lastRefreshTime: listRes.lastRefreshTime };
    if (mapNames.length > 0) {
      brawlerRes = await cubeLoad({
        measures: [
          "map.winRateAdj_measure",
          "map.winRate_measure",
          "map.useRate_measure",
          "map.picks_measure",
          "map.timestamp_measure",
        ],
        dimensions: ["map.mode_dimension", "map.map_dimension", "map.brawler_dimension"],
        filters: [
          {
            member: "map.season_dimension",
            operator: "equals",
            values: seasonValuesForWindow(filters.season),
          },
          {
            member: "map.powerplay_dimension",
            operator: "equals",
            values: [queue === "ranked" ? "1" : "0"],
          },
          { member: "map.map_dimension", operator: "equals", values: mapNames },
          ...(filters.mode
            ? [{ member: "map.mode_dimension", operator: "equals", values: [filters.mode] }]
            : []),
          ...(rangeFilter ? [rangeFilter] : []),
        ],
        limit: 2500,
        timezone: "UTC",
        order: { "map.picks_measure": "desc" },
      });
    }

    const grouped = new Map<string, typeof brawlerRes.data>();
    for (const row of brawlerRes.data) {
      const key2 = `${str(row, "map.mode_dimension")}::${str(row, "map.map_dimension")}`;
      const arr = grouped.get(key2) ?? [];
      arr.push(row);
      grouped.set(key2, arr);
    }

    const maps: ActiveMap[] = listed.map((m) => {
      const rows = grouped.get(`${m.mode}::${m.map}`) ?? [];
      const top = toStatRows(rows, catalog).slice(0, 5);
      return { ...m, top };
    });

    maps.sort((a, b) => Number(b.active) - Number(a.active) || b.picks - a.picks);

    const timestamps = maps.map((m) => m.timestamp).filter(Boolean) as string[];
    return {
      maps,
      sampleSize: maps.reduce((s, m) => s + m.picks, 0),
      sourceTimestamp: timestamps.sort().at(-1) ?? null,
      lastRefreshTime: listRes.lastRefreshTime,
      fetchedAt: Date.now(),
    };
  });

  return {
    maps: value.maps,
    dataset: datasetFrom(
      value.sampleSize,
      value.sourceTimestamp,
      value.lastRefreshTime,
      value.fetchedAt,
      queue,
      filters,
      "map-meta",
      cacheAgeMs,
    ),
  };
}

export async function loadBrawlerBreakdown(
  queue: Queue,
  filters: FilterState,
  cubeName: string,
): Promise<{
  overall: RankedBrawler | null;
  modes: RankedBrawler[];
  maps: (RankedBrawler & { mode: string; map: string })[];
  dataset: DatasetMeta;
}> {
  const catalog = await loadCatalog().catch(() => null);
  const key = cacheKey("brawler", queue, filters, cubeName);
  const { value, cacheAgeMs } = await withCache<{
    overallRows: RankedBrawler[];
    modeRows: RankedBrawler[];
    mapRows: (RankedBrawler & { mode: string; map: string })[];
    sampleSize: number;
    sourceTimestamp: string | null;
    lastRefreshTime: string | null;
    fetchedAt: number;
  }>(key, 2 * 60_000, async () => {
    const range = queryRange(queue, filters);
    const [overall, modes, maps] = await Promise.all([
      queryMapCube({
        queue,
        season: filters.season,
        ...range,
        mode: null,
        map: null,
        brawler: cubeName,
        dimensions: ["map.brawler_dimension"],
        limit: 5,
      }),
      queryMapCube({
        queue,
        season: filters.season,
        ...range,
        mode: null,
        map: null,
        brawler: cubeName,
        dimensions: ["map.brawler_dimension", "map.mode_dimension"],
        limit: 40,
      }),
      queryMapCube({
        queue,
        season: filters.season,
        ...range,
        mode: null,
        map: null,
        brawler: cubeName,
        dimensions: ["map.brawler_dimension", "map.mode_dimension", "map.map_dimension"],
        limit: 80,
      }),
    ]);

    const overallRows = toStatRows(overall.data, catalog);
    const modeGrouped = new Map<string, typeof modes.data>();
    for (const row of modes.data) {
      const mode = str(row, "map.mode_dimension");
      const arr = modeGrouped.get(mode) ?? [];
      arr.push(row);
      modeGrouped.set(mode, arr);
    }
    const modeRows = [...modeGrouped.entries()]
      .map(([mode, rows]) => {
        const scored = toStatRows(rows, catalog)[0];
        return scored ? { ...scored, cubeName: mode } : null;
      })
      .filter((r): r is RankedBrawler => r != null)
      .sort((a, b) => b.winRateAdj - a.winRateAdj);

    const mapRows = maps.data
      .map((row) => {
        const scored = toStatRows([row], catalog)[0];
        if (!scored) return null;
        return {
          ...scored,
          mode: str(row, "map.mode_dimension"),
          map: str(row, "map.map_dimension"),
        };
      })
      .filter((r): r is RankedBrawler & { mode: string; map: string } => r != null)
      .sort((a, b) => b.picks - a.picks);

    return {
      overallRows,
      modeRows,
      mapRows,
      sampleSize: overallRows.reduce((s, r) => s + r.picks, 0),
      sourceTimestamp: overallRows[0]?.timestamp ?? null,
      lastRefreshTime: overall.lastRefreshTime,
      fetchedAt: Date.now(),
    };
  });

  return {
    overall: value.overallRows[0] ?? null,
    modes: value.modeRows,
    maps: value.mapRows,
    dataset: datasetFrom(
      value.sampleSize,
      value.sourceTimestamp,
      value.lastRefreshTime,
      value.fetchedAt,
      queue,
      filters,
      "brawler-detail",
      cacheAgeMs,
    ),
  };
}

export { loadCatalog };
