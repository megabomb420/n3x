/**
 * One map's picture, full screen, with the publisher's own numbers under it.
 *
 * The picture is the map file in full — the boards are 690x1050, so it is shown
 * whole (`contain`) rather than cropped to a card. Every number below it is the
 * publisher's global reading, not this club's: the official API publishes none.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/provider";
import { loadMapStats } from "@/lib/maps/map-stats";
import { formatWindow, type RotationEvent } from "@/lib/maps/rotation";
import { findBrawler, loadCatalog } from "@/lib/meta/brawlapi";
import { formatPicks } from "@/lib/meta/format";
import { displayBrawlerName, looseName, titleCaseMode } from "@/lib/meta/names";
import type { MapCatalogItem } from "@/lib/meta/types";
import { MapArt } from "./map-art";
import { Portrait } from "./portrait";

/** How many of the publisher's best picks the strip shows. */
const TOP_PICKS = 3;

export function MapPicture({
  map,
  art,
  event,
  live,
  onClose,
}: {
  map: string;
  art: MapCatalogItem | null;
  /** The rotation event this map is on, when it is on one. */
  event: RotationEvent | null;
  /** Whether that event is the live one rather than the next one. */
  live: boolean;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Rendered on the server too, and a portal needs a document.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={map}
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/85 backdrop-blur-sm"
    >
      {/* The sheet is content-sized and centred, so the backdrop is a real tap
          target above and below it — `min-h-full` would let it swallow that. */}
      <div className="safe-top flex min-h-full items-center justify-center px-4 py-3">
        <div
          className="flex w-full max-w-lg flex-col gap-3"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label={t("map.picture.close")}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-fg shadow-[var(--shadow-border)]"
            >
              <X className="size-5" />
            </button>
          </div>

          <figure className="flex flex-col items-center gap-2">
            <div className="relative">
              <MapArt
                mapArt={art?.imageUrl ?? null}
                modeArt={art?.modeImage ?? null}
                alt={map}
                fit="contain"
                className="bleed max-h-[58vh] w-auto max-w-full rounded-2xl shadow-[var(--shadow-border)]"
              />
              {live ? (
                <span className="absolute right-2 top-2 rounded-full bg-win px-2 py-0.5 text-[10px] font-medium text-bg">
                  {t("maps.active")}
                </span>
              ) : null}
            </div>
            <figcaption className="text-center">
              <p className="font-display text-2xl leading-none tracking-wide text-white">{map}</p>
              <p className="mt-1 text-xs text-white/75">
                {event
                  ? `${event.mode ? titleCaseMode(event.mode) : t("maps.modeUnknown")} · ${formatWindow(event.startTime, event.endTime, t)}`
                  : t("map.notLive")}
              </p>
            </figcaption>
          </figure>

          <MapPicks map={map} mode={art?.modeName ?? null} />

          <Link
            to="/maps/$map/"
            params={{ map }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-surface px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)]"
          >
            {t("map.details")}
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The publisher's own best picks for this map — global, with its sample size. */
function MapPicks({ map, mode }: { map: string; mode: string | null }) {
  const t = useT();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;
  const stats = useQuery({
    queryKey: ["map-stats", map, mode],
    queryFn: () => loadMapStats(map, mode),
  });
  const data = stats.data;
  const picks = (
    data?.buckets.find((bucket) => bucket.kind === "picks")?.items ??
    data?.rows ??
    []
  ).slice(0, TOP_PICKS);

  return (
    <section className="rounded-2xl bg-surface px-3 py-2.5 shadow-[var(--shadow-border)]">
      <p className="text-[10px] uppercase tracking-wider text-subtle">{t("map.brawlers")}</p>
      {stats.isError ? (
        <p className="mt-1.5 text-xs text-muted">{t("state.map.body")}</p>
      ) : !data ? (
        <div className="skeleton mt-2 h-11 rounded-xl" aria-hidden />
      ) : picks.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted">{t("state.map.body")}</p>
      ) : (
        <>
          <ul className="mt-2 flex gap-2">
            {picks.map((pick) => {
              const row =
                data.rows.find((entry) => looseName(entry.name) === looseName(pick.name)) ?? null;
              return (
                <li
                  key={pick.name}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-2 py-1.5"
                >
                  <Portrait
                    catalog={findBrawler(catalog, pick.name.toUpperCase())}
                    cubeName={pick.name.toUpperCase()}
                    size={32}
                    decorative
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-fg">
                      {displayBrawlerName(pick.name.toUpperCase())}
                      {row?.tier ? (
                        <span className="ml-1 text-[10px] text-subtle">{row.tier}</span>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-subtle">
                      {Math.round(pick.winRate)}% ·{" "}
                      {pick.useRate == null ? "—" : `${pick.useRate}%`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[10px] text-subtle">
            {t("map.sample", { n: formatPicks(data.sampleBattles), source: data.source })}
            {` · ${t(data.metric === "top4" ? "map.ranksByTop4" : "map.ranksByWinRate")}`}
            {data.stale ? ` · ${t("meta.noteStale")}` : ""}
          </p>
        </>
      )}
    </section>
  );
}
