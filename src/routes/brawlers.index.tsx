import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Portrait } from "@/components/portrait";
import { TierBadge } from "@/components/tier-badge";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/state-views";
import { loadCatalog } from "@/lib/meta/brawlapi";
import { loadMeta } from "@/lib/meta/queries";
import { useFilters } from "@/store/filters";

export const Route = createFileRoute("/brawlers/")({ component: BrawlersPage });

function BrawlersPage() {
  const [q, setQ] = useState("");
  const ladderFilters = useFilters((s) => s.ladder);
  const rankedFilters = useFilters((s) => s.ranked);
  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const ladderQuery = useQuery({
    queryKey: ["meta", "ladder", ladderFilters],
    queryFn: () => loadMeta("ladder", ladderFilters),
  });
  const rankedQuery = useQuery({
    queryKey: ["meta", "ranked", rankedFilters],
    queryFn: () => loadMeta("ranked", rankedFilters),
  });

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const ladderMap = new Map(ladderQuery.data?.rows.map((r) => [r.cubeName, r]) ?? []);
    const rankedMap = new Map(rankedQuery.data?.rows.map((r) => [r.cubeName, r]) ?? []);
    return (catalogQuery.data?.brawlers ?? [])
      .filter(
        (b) =>
          !needle ||
          b.name.toLowerCase().includes(needle) ||
          b.cubeName.toLowerCase().includes(needle),
      )
      .map((b) => ({
        catalog: b,
        ladder: ladderMap.get(b.cubeName) ?? null,
        ranked: rankedMap.get(b.cubeName) ?? null,
      }))
      .sort((a, b) => a.catalog.name.localeCompare(b.catalog.name));
  }, [q, catalogQuery.data, ladderQuery.data, rankedQuery.data]);

  return (
    <AppShell title="Brawlers" showSearch>
      <div className="px-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter the roster"
          className="mb-3 min-h-11 w-full rounded-xl bg-surface px-3 text-base text-fg shadow-[var(--shadow-border)] outline-none placeholder:text-subtle"
        />
        {catalogQuery.isLoading ? <SkeletonRows /> : null}
        {catalogQuery.isError && !catalogQuery.data ? (
          <ErrorState
            title="Roster unavailable"
            body="Could not load brawler metadata from BrawlAPI."
            onRetry={() => void catalogQuery.refetch()}
          />
        ) : null}
        {catalogQuery.data && list.length === 0 ? (
          <EmptyState title="No matches" body="Try a different name." />
        ) : null}
        <div className="flex flex-col gap-1.5">
          {list.map((item) => (
            <Link
              key={item.catalog.id}
              to="/brawlers/$brawlerId"
              params={{ brawlerId: String(item.catalog.id) }}
              search={{ name: item.catalog.cubeName }}
              className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-2"
            >
              <Portrait catalog={item.catalog} cubeName={item.catalog.cubeName} size={40} decorative />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.catalog.name}</div>
                <div className="text-[11px] text-muted">{item.catalog.rarity}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-subtle">Lad</div>
                  {item.ladder ? (
                    <TierBadge tier={item.ladder.tier} className="h-6 min-w-6 text-base" />
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-subtle">Rnk</div>
                  {item.ranked ? (
                    <TierBadge tier={item.ranked.tier} className="h-6 min-w-6 text-base" />
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
