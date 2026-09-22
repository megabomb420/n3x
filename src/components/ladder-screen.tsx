import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useState } from "react";
import { apiGet } from "@/lib/api/client";
import { formatRelative, formatTrophies } from "@/lib/meta/format";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

type LadderType = "players" | "clubs";

interface LadderRow {
  rank: number;
  tag: string;
  name: string;
  trophies: number;
  clubName: string | null;
  memberCount: number | null;
}

interface LadderPayload {
  type: LadderType;
  updatedAt: number;
  rows: LadderRow[];
}

const TYPES: Array<{ value: LadderType; label: string }> = [
  { value: "players", label: "Players" },
  { value: "clubs", label: "Clubs" },
];

/** Official leaderboards from the `n3x-api` Worker (`GET /ladder?type=…`). */
export function LadderScreen() {
  const online = useOnline();
  const [type, setType] = useState<LadderType>("players");
  const query = useQuery({
    queryKey: ["ladder", type],
    queryFn: () => apiGet<LadderPayload>(`/ladder?type=${type}`),
    refetchInterval: 300_000,
  });

  // Rendered in the order the Worker returned them — the ranked table is the
  // API's, so the rows are never re-sorted here.
  const rows = query.data?.rows ?? [];
  const data = query.data;

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(data)} /> : null}

      <div
        role="tablist"
        aria-label="Leaderboard"
        className="grid grid-cols-2 gap-0.5 rounded-lg bg-surface-2 p-0.5"
      >
        {TYPES.map((option) => {
          const active = option.value === type;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setType(option.value)}
              className={cn(
                "h-9 rounded-md font-display text-lg tracking-wide transition-colors duration-150",
                active ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {query.isLoading ? <SkeletonRows count={10} /> : null}
      {query.isError && !data ? (
        <ErrorState
          title="Leaderboard unavailable"
          body={
            query.error instanceof Error
              ? query.error.message
              : "Could not load the leaderboard."
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {data ? (
        <>
          {rows.length === 0 ? (
            <EmptyState
              title="No ranked rows"
              body="The leaderboard answered, but it has no rows in it right now."
            />
          ) : (
            <section>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg tracking-wide">
                  {type === "players" ? "Top players" : "Top clubs"}
                </h2>
                <span className="text-xs text-subtle">{rows.length} listed</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {rows.map((row) => (
                  <LadderRowItem key={`${row.rank}-${row.tag}`} row={row} type={type} />
                ))}
              </ul>
            </section>
          )}

          <p className="flex items-center gap-1 text-[11px] text-subtle">
            <Clock className="size-3" />
            Updated {formatRelative(data.updatedAt)}
          </p>
        </>
      ) : null}
    </div>
  );
}

function LadderRowItem({ row, type }: { row: LadderRow; type: LadderType }) {
  const secondary =
    type === "clubs"
      ? row.memberCount != null
        ? `${row.memberCount} members`
        : "Member count not published"
      : (row.clubName ?? "No club");

  return (
    <li className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-2">
      <span className="w-5 shrink-0 text-center font-mono text-xs tabular text-subtle">
        {row.rank || "–"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.name || `#${row.tag}`}</p>
        <p className="truncate text-xs text-subtle">{secondary}</p>
      </div>
      <p className="shrink-0 font-mono text-sm tabular text-gold">{formatTrophies(row.trophies)}</p>
    </li>
  );
}
