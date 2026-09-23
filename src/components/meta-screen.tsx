import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { findBrawler, loadCatalog } from "@/lib/meta/brawlapi";
import { pickLeadVideo, loadCreatorFeeds, type CreatorFeed } from "@/lib/meta/creators";
import { displayBrawlerName } from "@/lib/meta/names";
import { formatRelative } from "@/lib/meta/format";
import { groupTiers, loadTierList, type TierRow, type TierScope } from "@/lib/meta/tier-list";
import { readPref, writePref } from "@/lib/prefs";
import type { Catalog } from "@/lib/meta/types";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { Portrait } from "./portrait";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

const SCOPES: Array<{ id: TierScope; label: string }> = [
  { id: "overall", label: "Overall" },
  { id: "ranked", label: "Ranked" },
];

const SCOPE_KEY = "n3x.meta.scope";

const TIER_COLOR: Record<string, string> = {
  "S+": "#2ee8ff",
  S: "#8ef6ff",
  "A+": "#6ecf97",
  A: "#6ecf97",
  "B+": "#5bc0de",
  B: "#5bc0de",
  "C+": "#c4a574",
  C: "#c4a574",
  D: "#e07a6a",
  F: "#e07a6a",
};

/**
 * A tier-list board, plus links out to the creators. The placements are a
 * published win/use-rate list — a video title is never turned into a tier.
 */
export function MetaScreen() {
  const online = useOnline();
  const [scope, setScope] = useState<TierScope | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const saved = readPref(SCOPE_KEY);
    const next: TierScope = saved === "ranked" ? "ranked" : "overall";
    writePref(SCOPE_KEY, next);
    setScope(next);
  }, []);

  const tier = useQuery({
    queryKey: ["tier-list", scope],
    queryFn: () => loadTierList(scope ?? "overall"),
    enabled: scope !== null,
    refetchInterval: 900_000,
  });
  const creators = useQuery({
    queryKey: ["creators"],
    queryFn: loadCreatorFeeds,
    refetchInterval: 1_800_000,
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog }).data ?? null;
  const groups = useMemo(() => groupTiers(tier.data?.rows ?? []), [tier.data]);
  const picked = tier.data?.rows.find((row) => row.name === selected) ?? null;

  function chooseScope(next: TierScope) {
    setScope(next);
    setSelected(null);
    writePref(SCOPE_KEY, next);
  }

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(tier.data)} /> : null}

      <div className="flex gap-1 rounded-full bg-surface p-1" role="tablist" aria-label="Tier list scope">
        {SCOPES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={scope === option.id}
            onClick={() => chooseScope(option.id)}
            className={cn(
              "min-h-9 flex-1 rounded-full px-3 text-xs font-medium",
              scope === option.id ? "bg-surface-3 text-fg" : "text-subtle",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {scope && tier.isLoading ? <SkeletonRows count={6} /> : null}
      {tier.isError && !tier.data ? (
        <ErrorState
          title="Tier list unavailable"
          body={tier.error instanceof Error ? tier.error.message : "Could not read the published tier list."}
          onRetry={() => void tier.refetch()}
        />
      ) : null}

      {tier.data && groups.length === 0 ? (
        <EmptyState title="No tiers in this list" body="The source answered, but it had no brawler rows to show." />
      ) : null}

      {tier.data && groups.length > 0 ? (
        <section className="overflow-hidden rounded-2xl bg-surface" aria-label="Tier list">
          <header className="flex items-baseline justify-between gap-2 px-3 pt-3">
            <h2 className="font-display text-lg tracking-wide">{scope === "ranked" ? "Ranked" : "Overall"} tier list</h2>
            <span className="text-[11px] text-subtle">{tier.data.rows.length} brawlers</span>
          </header>
          <ul className="mt-2 flex flex-col">
            {groups.map((group) => (
              <li key={group.tier} className="flex border-t border-border">
                <div
                  className="flex w-12 shrink-0 flex-col items-center justify-center py-2 font-display text-2xl leading-none tracking-wide"
                  style={{ color: TIER_COLOR[group.tier] ?? "#e8fbff" }}
                >
                  {group.tier}
                  <span className="mt-0.5 text-[10px] text-subtle">{group.rows.length}</span>
                </div>
                <div className="flex flex-1 flex-wrap gap-1 px-2 py-2">
                  {group.rows.map((row) => (
                    <TierPortrait
                      key={row.name}
                      row={row}
                      catalog={catalog}
                      pressed={selected === row.name}
                      onPick={() => setSelected((current) => (current === row.name ? null : row.name))}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {picked ? <TierDetail row={picked} catalog={catalog} /> : null}
          <p className="px-3 py-2 text-[11px] leading-relaxed text-subtle">
            {tier.data.stale ? "Showing the last reading — the source did not answer this time. " : ""}
            Re-read from{" "}
            <a className="text-muted underline" href={tier.data.sourceUrl} target="_blank" rel="noreferrer">
              {tier.data.source}
            </a>{" "}
            about every 15 minutes, so a balance change shows up without an app update. Tiers are percentiles of win
            rate and use rate, not a creator's opinion. Updated {formatRelative(tier.data.updatedAt)}.
          </p>
        </section>
      ) : null}

      <CreatorLinks channels={creators.data?.channels ?? []} loading={creators.isLoading} />
    </div>
  );
}

function TierPortrait({
  row,
  catalog,
  pressed,
  onPick,
}: {
  row: TierRow;
  catalog: Catalog | null;
  pressed: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={pressed}
      aria-label={displayBrawlerName(row.name)}
      className={cn("rounded-md", pressed && "ring-2 ring-gold")}
    >
      <Portrait catalog={findBrawler(catalog, row.name)} cubeName={row.name} size={36} decorative />
    </button>
  );
}

function TierDetail({ row, catalog }: { row: TierRow; catalog: Catalog | null }) {
  return (
    <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-surface-2 px-2 py-2">
      <Portrait catalog={findBrawler(catalog, row.name)} cubeName={row.name} size={36} decorative />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">{displayBrawlerName(row.name)}</p>
        <p className="truncate text-[11px] text-subtle">
          {row.tier}
          {row.role ? ` · ${row.role}` : ""}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm tabular text-gold">{row.winRate.toFixed(1)}%</p>
        <p className="text-[10px] text-subtle">{row.useRate == null ? "—" : `${row.useRate.toFixed(2)}% use`}</p>
      </div>
    </div>
  );
}

function CreatorLinks({ channels, loading }: { channels: CreatorFeed[]; loading: boolean }) {
  return (
    <section>
      <h2 className="font-display text-lg tracking-wide">Creators</h2>
      <p className="mt-0.5 text-[11px] text-subtle">Their channels, and the latest tier-list upload when they have one.</p>
      {loading && channels.length === 0 ? <SkeletonRows count={4} /> : null}
      <ul className="mt-2 flex flex-col gap-1.5">
        {channels.map((channel) => {
          const lead = pickLeadVideo(channel.entries, "tierLists");
          return (
            <li key={channel.id} className="rounded-xl bg-surface px-3 py-2">
              <a
                href={channel.channelUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-6 items-center justify-between gap-2 text-sm text-fg"
              >
                <span className="truncate">
                  {channel.name}
                  <span className="ml-1.5 text-xs text-subtle">{channel.handle}</span>
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-subtle" />
              </a>
              {lead ? (
                <a
                  href={lead.watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block truncate text-[11px] text-muted underline"
                >
                  {lead.title}
                </a>
              ) : (
                <p className="mt-0.5 truncate text-[11px] text-subtle">
                  {channel.error ? "Feed unavailable — channel link still works" : "No tier-list upload in the current feed"}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
