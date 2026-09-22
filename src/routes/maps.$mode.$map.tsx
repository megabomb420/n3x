import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FreshnessChip } from "@/components/freshness";
import { BrawlerRow } from "@/components/brawler-row";
import { MapArt } from "@/components/portrait";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/state-views";
import { TIER_ORDER } from "@/lib/meta/scoring";
import { loadCatalog, findMap } from "@/lib/meta/brawlapi";
import { loadMeta } from "@/lib/meta/queries";
import { titleCaseMode } from "@/lib/meta/names";
import { formatPicks } from "@/lib/meta/format";
import { useFilters } from "@/store/filters";
import { ActiveFilterSummary } from "@/components/filters-bar";

export const Route = createFileRoute("/maps/$mode/$map")({
  component: MapDetailPage,
});

function MapDetailPage() {
  const { mode, map } = Route.useParams();
  const queue = useFilters((s) => s.queue);
  const filters = useFilters((s) => s[s.queue]);

  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const catalogItem = catalogQuery.data ? findMap(catalogQuery.data, map) : null;

  const query = useQuery({
    queryKey: ["map-detail", queue, filters, mode, map],
    queryFn: () => loadMeta(queue, { ...filters, mode, map }),
  });

  const rows = query.data?.rows ?? [];

  return (
    <AppShell title={map} showQueue showSearch>
      <div className="flex flex-col gap-2 px-3">
        <Link to="/maps" className="inline-flex h-9 items-center gap-1 text-sm text-muted">
          <ChevronLeft className="size-4" /> Maps
        </Link>
        <div className="overflow-hidden rounded-xl bg-surface">
          <MapArt src={catalogItem?.imageUrl ?? null} alt={map} className="h-28 w-full" />
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-subtle">{titleCaseMode(mode)}</p>
            <h2 className="font-display text-2xl leading-none tracking-wide">{map}</h2>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <ActiveFilterSummary filters={{ ...filters, mode, map }} />
          {query.data ? <FreshnessChip dataset={query.data.dataset} /> : null}
        </div>
        {query.isLoading ? <SkeletonRows /> : null}
        {query.isError && !query.data ? (
          <ErrorState
            title="No map stats"
            body={query.error instanceof Error ? query.error.message : "Could not load this map."}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {query.data && rows.length === 0 ? (
          <EmptyState
            title="Tiny or empty sample"
            body="No recorded battles for this map under the current filters."
          />
        ) : null}
        {rows.length > 0 ? (
          <>
            <p className="font-mono text-[11px] text-subtle tabular">
              {formatPicks(query.data?.dataset.sampleSize ?? 0)} battles on this map
            </p>
            {TIER_ORDER.map((tier) => {
              const group = rows.filter((r) => r.tier === tier);
              if (group.length === 0) return null;
              return (
                <section key={tier}>
                  <h3 className="mb-1 font-display text-lg tracking-wide">{tier} tier</h3>
                  <div className="flex flex-col gap-1">
                    {group.map((row, i) => (
                      <BrawlerRow key={row.cubeName} row={row} rank={i + 1} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
