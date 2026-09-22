import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { loadMeta } from "@/lib/meta/queries";
import { TIER_ORDER } from "@/lib/meta/scoring";
import { formatPicks } from "@/lib/meta/format";
import { displayBrawlerName } from "@/lib/meta/names";
import { useFilters } from "@/store/filters";
import { useOnline } from "@/hooks/use-online";
import { ActiveFilterSummary, FiltersBar } from "./filters-bar";
import { BrawlerRow } from "./brawler-row";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";
import { FreshnessChip } from "./freshness";
import { Portrait } from "./portrait";
import { TierBadge } from "./tier-badge";
import { CreatorStrip } from "./creator-strip";
import { CompetitiveStrip } from "./competitive-strip";
import { cn } from "@/lib/utils";
import type { RankedBrawler, Tier } from "@/lib/meta/types";

export function MetaScreen() {
  const queue = useFilters((s) => s.queue);
  const filters = useFilters((s) => s[s.queue]);
  const [tierFocus, setTierFocus] = useState<Tier | "ALL">("ALL");
  const online = useOnline();

  const query = useQuery({
    queryKey: ["meta", queue, filters],
    queryFn: () => loadMeta(queue, filters),
  });

  const rows = query.data?.rows ?? [];
  const visible = useMemo(
    () => (tierFocus === "ALL" ? rows : rows.filter((r) => r.tier === tierFocus)),
    [rows, tierFocus],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.tier] = (c[r.tier] ?? 0) + 1;
    return c;
  }, [rows]);

  const mostUsed = useMemo(
    () => [...rows].sort((a, b) => b.useRate - a.useRate).slice(0, 8),
    [rows],
  );

  return (
    <div className="flex flex-col gap-2 px-3">
      <FiltersBar modes={query.data?.modes ?? []} maps={query.data?.maps ?? []} />
      <div className="flex items-center justify-between gap-2">
        <ActiveFilterSummary filters={filters} />
        {query.data ? <FreshnessChip dataset={query.data.dataset} /> : null}
      </div>
      {!online ? <OfflineBanner stale={query.data?.dataset.freshness === "stale"} /> : null}

      {query.isLoading ? <SkeletonRows /> : null}
      {query.isError && !query.data ? (
        <ErrorState
          title="Can't load the meta"
          body={
            query.error instanceof Error
              ? query.error.message
              : "The stats source is temporarily unavailable."
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && rows.length === 0 ? (
        <EmptyState
          title="No battles in this slice"
          body="Nothing matched these filters. Widen trophies, season, or mode."
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            <TierChip
              label="All"
              count={rows.length}
              active={tierFocus === "ALL"}
              onClick={() => setTierFocus("ALL")}
            />
            {TIER_ORDER.map((t) => (
              <TierChip
                key={t}
                label={t}
                count={counts[t] ?? 0}
                active={tierFocus === t}
                onClick={() => setTierFocus(t)}
              />
            ))}
          </div>

          {mostUsed.length > 0 && tierFocus === "ALL" ? (
            <section>
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wider text-subtle">Most used</h2>
                <span className="text-[10px] text-subtle">Not in the score</span>
              </div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {mostUsed.map((row) => (
                  <MostUsedChip key={`use-${row.cubeName}`} row={row} />
                ))}
              </div>
            </section>
          ) : null}

          {tierFocus === "ALL" && queue === "ranked" ? <CompetitiveStrip /> : null}
          {tierFocus === "ALL" ? <CreatorStrip /> : null}

          <section>
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="font-display text-lg tracking-wide">
                {queue === "ranked" ? "Ranked" : "Ladder"}
              </h2>
              <span className="font-mono text-[11px] text-subtle tabular">
                {formatPicks(query.data?.dataset.sampleSize ?? 0)} battles
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {visible.map((row, i) => (
                <BrawlerRow key={row.cubeName} row={row} rank={i + 1} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MostUsedChip({ row }: { row: RankedBrawler }) {
  const id = String(row.catalog?.id ?? row.cubeName);
  const name = row.catalog?.name ?? displayBrawlerName(row.cubeName);
  return (
    <Link
      to="/brawlers/$brawlerId"
      params={{ brawlerId: id }}
      search={{ name: row.cubeName }}
      className="flex w-14 shrink-0 flex-col items-center gap-0.5"
    >
      <Portrait catalog={row.catalog} cubeName={row.cubeName} size={36} decorative />
      <span className="w-full truncate text-center text-[10px] leading-tight">{name}</span>
      <TierBadge tier={row.tier} className="h-4 min-w-4 text-xs" />
    </Link>
  );
}

function TierChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs",
        active ? "bg-fg text-bg" : "bg-surface text-muted",
      )}
    >
      {label}
      <span className="font-mono text-[10px] tabular">{count}</span>
    </button>
  );
}
