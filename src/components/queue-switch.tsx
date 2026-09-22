import { cn } from "@/lib/utils";
import type { Queue } from "@/lib/meta/types";
import { useFilters } from "@/store/filters";

export function ConnectedQueueSwitch() {
  const value = useFilters((s) => s.queue);
  const onChange = useFilters((s) => s.setQueue);
  return <QueueSwitch value={value} onChange={onChange} />;
}

export function QueueSwitch({
  value,
  onChange,
}: {
  value: Queue;
  onChange: (q: Queue) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Matchmaking type"
      className="relative grid grid-cols-2 rounded-lg bg-surface-2 p-0.5"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-md transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          value === "ladder" ? "translate-x-0.5 bg-gold" : "translate-x-[calc(100%+1px)] bg-ranked",
        )}
      />
      <button
        type="button"
        role="tab"
        aria-selected={value === "ladder"}
        onClick={() => {
          onChange("ladder");
          haptic();
        }}
        className={cn(
          "relative z-10 h-9 rounded-md font-display text-lg tracking-wide transition-colors duration-150",
          value === "ladder" ? "text-gold-fg" : "text-muted",
        )}
      >
        Ladder
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "ranked"}
        onClick={() => {
          onChange("ranked");
          haptic();
        }}
        className={cn(
          "relative z-10 h-9 rounded-md font-display text-lg tracking-wide transition-colors duration-150",
          value === "ranked" ? "text-ranked-fg" : "text-muted",
        )}
      >
        Ranked
      </button>
    </div>
  );
}

function haptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* ignore */
  }
}
