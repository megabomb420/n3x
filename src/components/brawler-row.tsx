import { Link } from "@tanstack/react-router";
import { displayBrawlerName } from "@/lib/meta/names";
import { formatPct, formatPicks } from "@/lib/meta/format";
import type { RankedBrawler } from "@/lib/meta/types";
import { ConfidenceDot, TierBadge } from "./tier-badge";
import { Portrait } from "./portrait";

export function BrawlerRow({
  row,
  rank,
}: {
  row: RankedBrawler;
  rank: number;
}) {
  const id = String(row.catalog?.id ?? row.cubeName);
  const name = row.catalog?.name ?? displayBrawlerName(row.cubeName);
  return (
    <Link
      to="/brawlers/$brawlerId"
      params={{ brawlerId: id }}
      search={{ name: row.cubeName }}
      className="flex min-h-12 items-center gap-2.5 rounded-lg bg-surface px-2.5 py-1.5 transition-[transform] duration-150 ease-out active:scale-[0.99]"
    >
      <span className="w-4 shrink-0 text-right font-mono text-[11px] text-subtle tabular">{rank}</span>
      <Portrait catalog={row.catalog} cubeName={row.cubeName} size={36} decorative />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-medium">{name}</span>
          <ConfidenceDot value={row.confidence} />
        </div>
        <div className="mt-px flex flex-wrap gap-x-2.5 font-mono text-[10px] text-muted tabular">
          <span>Adj {formatPct(row.winRateAdj)}</span>
          <span>WR {formatPct(row.winRate)}</span>
          <span>Use {formatPct(row.useRate, 2)}</span>
          <span>n {formatPicks(row.picks)}</span>
        </div>
      </div>
      <TierBadge tier={row.tier} />
    </Link>
  );
}

export function CompactPreview({ row }: { row: RankedBrawler }) {
  const name = row.catalog?.name ?? displayBrawlerName(row.cubeName);
  return (
    <div className="flex items-center gap-2">
      <Portrait catalog={row.catalog} cubeName={row.cubeName} size={24} decorative />
      <span className="truncate text-sm">{name}</span>
      <span className="ml-auto font-mono text-xs text-muted tabular">
        {formatPct(row.winRateAdj)}
      </span>
      <TierBadge tier={row.tier} className="h-5 min-w-5 text-sm" />
    </div>
  );
}
