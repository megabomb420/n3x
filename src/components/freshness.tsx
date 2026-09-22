import { useState } from "react";
import { Clock } from "lucide-react";
import type { DatasetMeta } from "@/lib/meta/types";
import { formatPicks, formatRelative } from "@/lib/meta/format";
import { rangeFilterLabel } from "@/lib/meta/cube";
import { seasonLabel } from "@/lib/meta/seasons";
import { titleCaseMode } from "@/lib/meta/names";
import { cn } from "@/lib/utils";

export function FreshnessChip({ dataset }: { dataset: DatasetMeta }) {
  const [open, setOpen] = useState(false);
  const when = dataset.sourceTimestamp ?? dataset.lastRefreshTime ?? dataset.fetchedAt;
  const label =
    dataset.freshness === "stale"
      ? `Stale · ${formatRelative(when)}`
      : dataset.freshness === "offline"
        ? `Offline · ${formatRelative(when)}`
        : `Updated ${formatRelative(when)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium",
          "shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 ease-out",
          "active:scale-[0.96]",
          dataset.freshness === "stale" || dataset.freshness === "offline"
            ? "bg-surface-2 text-gold"
            : "bg-surface text-muted",
        )}
      >
        <Clock className="size-3.5" />
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="freshness-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="freshness-title" className="font-display text-2xl tracking-wide">
              Data snapshot
            </h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Row label="Status" value={dataset.freshness} />
              <Row label="Source" value={dataset.source} />
              <Row label="Last battle" value={formatRelative(dataset.sourceTimestamp)} />
              <Row label="Fetched" value={formatRelative(dataset.fetchedAt)} />
              <Row
                label="Cube refresh"
                value={dataset.lastRefreshTime ? formatRelative(dataset.lastRefreshTime) : "—"}
              />
              <Row label="Sample" value={`${formatPicks(dataset.sampleSize)} battles`} />
              <Row label="Queue" value={dataset.filters.queue === "ranked" ? "Ranked" : "Ladder"} />
              <Row label="Season" value={seasonLabel(dataset.filters.season)} />
              <Row
                label={dataset.filters.queue === "ranked" ? "ELO" : "Trophies"}
                value={rangeFilterLabel(dataset.filters.queue, {
                  trophy: dataset.filters.trophy,
                  league: dataset.filters.league,
                  mode: dataset.filters.mode,
                  map: dataset.filters.map,
                  season: dataset.filters.season,
                })}
              />
              <Row
                label="Mode"
                value={dataset.filters.mode ? titleCaseMode(dataset.filters.mode) : "All modes"}
              />
              <Row label="Map" value={dataset.filters.map ?? "All maps"} />
              <Row label="Dataset" value={dataset.datasetType} />
            </dl>
            <p className="mt-4 text-xs text-muted">
              Stats come from Brawl Time Ninja battle records. This app is unofficial and not
              endorsed by Supercell, Brawl Time Ninja, or BrawlAPI.
            </p>
            <button
              type="button"
              className="mt-4 min-h-11 w-full rounded-xl bg-fg font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.96]"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-subtle">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </>
  );
}
