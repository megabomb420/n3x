import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { FreshnessChip } from "@/components/freshness";
import { Portrait } from "@/components/portrait";
import { ConfidenceDot, TierBadge } from "@/components/tier-badge";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/state-views";
import { ActiveFilterSummary } from "@/components/filters-bar";
import { findBrawler, loadCatalog } from "@/lib/meta/brawlapi";
import { loadBrawlerBreakdown, loadMeta } from "@/lib/meta/queries";
import { displayBrawlerName, titleCaseMode } from "@/lib/meta/names";
import { formatPct, formatPicks } from "@/lib/meta/format";
import { useFilters } from "@/store/filters";

const searchSchema = z.object({
  name: z.string().optional(),
});

export const Route = createFileRoute("/brawlers/$brawlerId")({
  validateSearch: searchSchema,
  component: BrawlerDetailPage,
});

function BrawlerDetailPage() {
  const { brawlerId } = Route.useParams();
  const { name: searchName } = Route.useSearch();
  const queue = useFilters((s) => s.queue);
  const filters = useFilters((s) => s[s.queue]);
  const ladderFilters = useFilters((s) => s.ladder);
  const rankedFilters = useFilters((s) => s.ranked);

  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const catalogItem =
    catalogQuery.data?.brawlers.find((b) => String(b.id) === brawlerId) ??
    (searchName && catalogQuery.data ? findBrawler(catalogQuery.data, searchName) : null);
  const cubeName = catalogItem?.cubeName ?? searchName ?? decodeURIComponent(brawlerId);

  const detailQuery = useQuery({
    queryKey: ["brawler", queue, filters, cubeName],
    queryFn: () => loadBrawlerBreakdown(queue, filters, cubeName),
    enabled: Boolean(cubeName),
  });
  const ladderQuery = useQuery({
    queryKey: ["meta", "ladder", ladderFilters],
    queryFn: () => loadMeta("ladder", ladderFilters),
  });
  const rankedQuery = useQuery({
    queryKey: ["meta", "ranked", rankedFilters],
    queryFn: () => loadMeta("ranked", rankedFilters),
  });

  const ladderRow = ladderQuery.data?.rows.find((r) => r.cubeName === cubeName);
  const rankedRow = rankedQuery.data?.rows.find((r) => r.cubeName === cubeName);
  const overall = detailQuery.data?.overall;
  const contextRow = queue === "ranked" ? rankedRow : ladderRow;
  const maps = (detailQuery.data?.maps ?? []).filter((m) => m.picks >= 80);
  const strongMaps = [...maps].sort((a, b) => b.winRateAdj - a.winRateAdj).slice(0, 5);
  const weakMaps = [...maps].sort((a, b) => a.winRateAdj - b.winRateAdj).slice(0, 5);
  const modes = (detailQuery.data?.modes ?? []).filter((m) => m.picks >= 80);
  const name = catalogItem?.name ?? displayBrawlerName(cubeName);

  return (
    <AppShell title={name} showQueue>
      <div className="flex flex-col gap-2 px-3">
        <Link to="/brawlers" className="inline-flex h-9 items-center gap-1 text-sm text-muted">
          <ChevronLeft className="size-4" /> Brawlers
        </Link>

        <div className="flex items-center gap-3 rounded-xl bg-surface p-2.5">
          <Portrait catalog={catalogItem} cubeName={cubeName} size={56} className="rounded-lg" />
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-none tracking-wide">{name}</h2>
            <p className="text-xs text-muted">
              {[catalogItem?.rarity, catalogItem?.className].filter(Boolean).join(" · ") || "Brawler"}
            </p>
            <div className="mt-1.5 flex items-center gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-subtle">Ladder</div>
                {ladderRow ? <TierBadge tier={ladderRow.tier} /> : <span className="text-subtle">—</span>}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-subtle">Ranked</div>
                {rankedRow ? <TierBadge tier={rankedRow.tier} /> : <span className="text-subtle">—</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <ActiveFilterSummary filters={filters} />
          {detailQuery.data ? <FreshnessChip dataset={detailQuery.data.dataset} /> : null}
        </div>

        {detailQuery.isLoading ? <SkeletonRows count={4} /> : null}
        {detailQuery.isError && !detailQuery.data ? (
          <ErrorState
            title="No performance data"
            body={
              detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Could not load this brawler's stats."
            }
            onRetry={() => void detailQuery.refetch()}
          />
        ) : null}

        {overall ? (
          <section className="grid grid-cols-2 gap-1.5">
            <Stat label="Adjusted WR" value={formatPct(overall.winRateAdj)} />
            <Stat label="Win rate" value={formatPct(overall.winRate)} />
            <Stat label="Use rate" value={formatPct(contextRow?.useRate ?? NaN, 2)} />
            <Stat label="Sample" value={formatPicks(overall.picks)} />
            <div className="col-span-2 flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-xs text-muted">Confidence</span>
              <ConfidenceDot value={overall.confidence} showLabel />
            </div>
          </section>
        ) : detailQuery.data ? (
          <EmptyState
            title="No sample in this slice"
            body="This brawler has no recorded battles under the current Ladder/Ranked filters."
          />
        ) : null}

        {modes.length > 0 ? (
          <section>
            <h3 className="mb-1 font-display text-lg tracking-wide">Strongest modes</h3>
            <div className="flex flex-col gap-1">
              {modes.slice(0, 8).map((row) => (
                <div
                  key={row.cubeName}
                  className="flex h-10 items-center justify-between rounded-lg bg-surface px-3"
                >
                  <span className="text-sm">{titleCaseMode(row.cubeName)}</span>
                  <span className="font-mono text-sm tabular">
                    {formatPct(row.winRateAdj)} · n {formatPicks(row.picks)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {strongMaps.length > 0 ? (
          <section>
            <h3 className="mb-1 font-display text-lg tracking-wide">Strongest maps</h3>
            <MapList rows={strongMaps} />
          </section>
        ) : null}
        {weakMaps.length > 0 ? (
          <section>
            <h3 className="mb-1 font-display text-lg tracking-wide">Lowest WR maps</h3>
            <MapList rows={weakMaps} />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-subtle">{label}</div>
      <div className="mt-0.5 font-display text-2xl leading-none tracking-wide tabular">{value}</div>
    </div>
  );
}

function MapList({
  rows,
}: {
  rows: Array<{
    map: string;
    mode: string;
    winRateAdj: number;
    picks: number;
    confidence: "HIGH" | "MEDIUM" | "LOW";
  }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <Link
          key={`${row.mode}-${row.map}`}
          to="/maps/$mode/$map"
          params={{ mode: row.mode, map: row.map }}
          className="flex h-11 items-center justify-between gap-2 rounded-lg bg-surface px-3"
        >
          <div className="min-w-0">
            <div className="truncate text-sm">{row.map}</div>
            <div className="text-[11px] text-muted">{titleCaseMode(row.mode)}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm tabular">{formatPct(row.winRateAdj)}</div>
            <div className="text-[10px] text-subtle">n {formatPicks(row.picks)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
