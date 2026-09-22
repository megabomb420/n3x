import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { FiltersBar, ActiveFilterSummary } from "@/components/filters-bar";
import { FreshnessChip } from "@/components/freshness";
import { MapArt } from "@/components/portrait";
import { CompactPreview } from "@/components/brawler-row";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "@/components/state-views";
import { loadMapBoard } from "@/lib/meta/queries";
import { titleCaseMode } from "@/lib/meta/names";
import { formatPicks, formatRelative } from "@/lib/meta/format";
import { useFilters } from "@/store/filters";
import { useOnline } from "@/hooks/use-online";

export const Route = createFileRoute("/maps/")({ component: MapsPage });

function MapsPage() {
  const queue = useFilters((s) => s.queue);
  const filters = useFilters((s) => s[s.queue]);
  const online = useOnline();
  const query = useQuery({
    queryKey: ["maps", queue, filters],
    queryFn: () => loadMapBoard(queue, filters),
  });
  const maps = query.data?.maps ?? [];
  const active = maps.filter((m) => m.active);
  const rest = maps.filter((m) => !m.active);
  const modes = useMemo(
    () => [...new Set(maps.map((m) => m.mode).filter(Boolean))].sort(),
    [maps],
  );

  return (
    <AppShell title="Maps" showQueue showSearch>
      <div className="flex flex-col gap-2 px-3">
        <FiltersBar
          modes={modes}
          maps={maps.map((m) => ({ mode: m.mode, map: m.map, picks: m.picks }))}
        />
        <div className="flex items-center justify-between gap-2">
          <ActiveFilterSummary filters={filters} />
          {query.data ? <FreshnessChip dataset={query.data.dataset} /> : null}
        </div>
        {!online ? <OfflineBanner stale={query.data?.dataset.freshness === "stale"} /> : null}
        {query.isLoading ? <SkeletonRows count={6} /> : null}
        {query.isError && !query.data ? (
          <ErrorState
            title="Maps unavailable"
            body={query.error instanceof Error ? query.error.message : "Could not load map stats."}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {query.data && maps.length === 0 ? (
          <EmptyState title="No maps in this slice" body="Widen filters to see maps with recorded battles." />
        ) : null}

        {active.length > 0 ? (
          <section>
            <h2 className="mb-1.5 font-display text-lg tracking-wide">Active now</h2>
            <div className="flex flex-col gap-2">
              {active.map((m) => (
                <MapCard key={`${m.mode}-${m.map}`} {...m} />
              ))}
            </div>
          </section>
        ) : null}

        {rest.length > 0 ? (
          <section>
            <h2 className="mb-1.5 font-display text-lg tracking-wide">This season</h2>
            <div className="flex flex-col gap-2">
              {rest.map((m) => (
                <MapCard key={`${m.mode}-${m.map}`} {...m} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function MapCard(m: {
  mode: string;
  map: string;
  picks: number;
  timestamp: string | null;
  active: boolean;
  catalog: { imageUrl: string } | null;
  top: import("@/lib/meta/types").RankedBrawler[];
}) {
  return (
    <Link
      to="/maps/$mode/$map"
      params={{ mode: m.mode, map: m.map }}
      className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]"
    >
      <div className="flex gap-2.5 p-1.5">
        <MapArt
          src={m.catalog?.imageUrl ?? null}
          alt={m.map}
          className="h-20 w-14 shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="truncate text-sm font-medium">{m.map}</h3>
              <p className="text-[11px] text-muted">{titleCaseMode(m.mode)}</p>
            </div>
            {m.active ? (
              <span className="rounded-full bg-win/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-win">
                Live
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-subtle tabular">
            {formatPicks(m.picks)} battles
            {m.timestamp ? ` · ${formatRelative(m.timestamp)}` : ""}
          </p>
          {m.top[0] ? (
            <div className="mt-1.5">
              <CompactPreview row={m.top[0]} />
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
