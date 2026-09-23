import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Map } from "lucide-react";
import { formatWindow, loadRotation, type RotationEvent } from "@/lib/maps/rotation";
import { findMap, loadCatalog } from "@/lib/meta/brawlapi";
import { formatRelative } from "@/lib/meta/format";
import { titleCaseMode } from "@/lib/meta/names";
import { useT } from "@/lib/i18n/provider";
import { useOnline } from "@/hooks/use-online";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

/** The live event rotation from the `n3x-api` Worker (`GET /maps`). */
export function RotationScreen() {
  const t = useT();
  const online = useOnline();
  const query = useQuery({
    queryKey: ["rotation"],
    queryFn: loadRotation,
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;

  const data = query.data;
  const active = data?.active ?? [];
  const upcoming = data?.upcoming ?? [];

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(data)} /> : null}

      {query.isLoading ? <SkeletonRows count={6} /> : null}
      {query.isError && !data ? (
        <ErrorState
          title={t("state.maps.title")}
          body={query.error instanceof Error ? query.error.message : t("state.maps.body")}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {data && active.length === 0 && upcoming.length === 0 ? (
        <EmptyState title={t("maps.noEvents.title")} body={t("maps.noEvents.body")} />
      ) : null}
      {active.length > 0 ? <RotationSection title={t("maps.active")} events={active} catalog={catalog} live /> : null}
      {upcoming.length > 0 ? <RotationSection title={t("maps.upcoming")} events={upcoming} catalog={catalog} /> : null}

      {data ? (
        <p className="flex items-center gap-1 text-[11px] text-subtle">
          <Clock className="size-3" />
          {t("maps.note", { when: formatRelative(data.updatedAt) })}
        </p>
      ) : null}
    </div>
  );
}
function RotationSection({
  title,
  events,
  catalog,
  live = false,
}: {
  title: string;
  events: RotationEvent[];
  catalog: Awaited<ReturnType<typeof loadCatalog>> | null;
  live?: boolean;
}) {
  const t = useT();
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg tracking-wide">{title}</h2>
        <span className="text-xs text-subtle">{events.length}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {events.map((event, i) => {
          const art = findMap(catalog, event.map, event.mode);
          const card = (
            <div className="relative aspect-[2/1] bg-surface-2">
              <MapArt map={art?.imageUrl ?? null} mode={art?.modeImage ?? null} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-10">
                <p className="truncate font-medium text-white">{event.map || t("maps.mapUnknown")}</p>
                <p className="truncate text-xs text-white/75">
                  {event.mode ? titleCaseMode(event.mode) : t("maps.modeUnknown")}
                  <span aria-hidden> · </span>
                  <span className="tabular">{formatWindow(event.startTime, event.endTime, t)}</span>
                </p>
              </div>
              {live ? (
                <span className="absolute right-2 top-2 rounded-full bg-win px-2 py-0.5 text-[10px] font-medium text-bg">
                  LIVE
                </span>
              ) : null}
            </div>
          );
          return (
            <li
              key={`${i}-${event.slot}-${event.mode}-${event.map}`}
              className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]"
            >
              {/* An event with no map name has nothing to open, so only a named one is a link. */}
              {event.map.length > 0 ? (
                <Link to="/maps/$map/" params={{ map: event.map }} className="block">
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Map art with a fallback chain: the Brawlify CDN has no file for a few maps,
 * and the mode's own art beats an empty card. The last resort is the map icon.
 */
function MapArt({ map, mode }: { map: string | null; mode: string | null }) {
  const [step, setStep] = useState(0);
  const candidates = [map, mode].filter((url): url is string => Boolean(url));
  const src = candidates[step];

  if (!src) {
    return (
      <div className="flex h-full items-center justify-center text-subtle">
        <Map className="size-6" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="bleed h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setStep((current) => current + 1)}
    />
  );
}
