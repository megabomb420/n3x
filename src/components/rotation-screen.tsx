import { useQuery } from "@tanstack/react-query";
import { Clock, Map } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { formatRelative } from "@/lib/meta/format";
import { titleCaseMode } from "@/lib/meta/names";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

interface RotationEvent {
  slot: string;
  mode: string;
  map: string;
  startTime: string | null;
  endTime: string | null;
}

interface RotationPayload {
  updatedAt: number;
  active: RotationEvent[];
  upcoming: RotationEvent[];
  source: string;
}

/** The live event rotation from the `n3x-api` Worker (`GET /maps`). */
export function RotationScreen() {
  const online = useOnline();
  const query = useQuery({
    queryKey: ["rotation"],
    queryFn: () => apiGet<RotationPayload>("/maps"),
    refetchInterval: 600_000,
  });

  const data = query.data;
  const active = data?.active ?? [];
  const upcoming = data?.upcoming ?? [];

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(data)} /> : null}

      {query.isLoading ? <SkeletonRows count={6} /> : null}
      {query.isError && !data ? (
        <ErrorState
          title="Rotation unavailable"
          body={
            query.error instanceof Error ? query.error.message : "Could not load the map rotation."
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {data && active.length === 0 && upcoming.length === 0 ? (
        <EmptyState
          title="No events right now"
          body="The rotation answered, but it lists no live or upcoming events. Check back after the next rotation."
        />
      ) : null}

      {active.length > 0 ? (
        <RotationSection title="Live now" events={active} live />
      ) : null}
      {upcoming.length > 0 ? <RotationSection title="Upcoming" events={upcoming} /> : null}

      {data ? (
        <p className="flex items-center gap-1 text-[11px] text-subtle">
          <Clock className="size-3" />
          Updated {formatRelative(data.updatedAt)}
          {data.source ? ` · ${data.source}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function RotationSection({
  title,
  events,
  live = false,
}: {
  title: string;
  events: RotationEvent[];
  live?: boolean;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg tracking-wide">{title}</h2>
        <span className="text-xs text-subtle">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {events.map((event, i) => (
          <li
            key={`${i}-${event.slot}-${event.mode}-${event.map}`}
            className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-2"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2",
                live ? "text-win" : "text-subtle",
              )}
            >
              <Map className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{event.map || "Map not published"}</p>
              <p className="truncate text-xs text-subtle">
                {event.mode ? titleCaseMode(event.mode) : "Mode not published"}
                <span aria-hidden> · </span>
                <span className="tabular">{formatWindow(event.startTime, event.endTime)}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The API stamps event times as `20260922T080000.000Z`, which `Date.parse`
 * rejects; put the separators back before parsing.
 */
function toMs(value: string | null): number | null {
  if (!value) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value);
  const ms = compact
    ? Date.parse(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`)
    : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * The row's time window, built only from what the payload carries — an absent
 * or unparseable side is shown raw rather than replaced by an invented one.
 */
function formatWindow(startTime: string | null, endTime: string | null): string {
  if (startTime == null && endTime == null) return "Time not published";

  const start = toMs(startTime);
  const end = toMs(endTime);

  // Both sides published: the full window, clock times only when it fits one day.
  if (startTime != null && endTime != null) {
    if (start == null || end == null) return `${startTime} – ${endTime}`;
    if (new Date(start).toDateString() === new Date(end).toDateString()) {
      return `${clock(start)} – ${clock(end)}`;
    }
    const startDay = new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const endDay = new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${startDay} ${clock(start)} – ${endDay} ${clock(end)}`;
  }

  // Only one side published: name it, relative once it has already happened.
  if (startTime == null) {
    if (end == null) return `Ends ${endTime}`;
    return `Ends ${end <= Date.now() ? formatRelative(end) : clock(end)}`;
  }
  if (start == null) return `Starts ${startTime}`;
  return `Starts ${start <= Date.now() ? formatRelative(start) : clock(start)}`;
}
