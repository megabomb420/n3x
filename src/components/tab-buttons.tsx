import { cn } from "@/lib/utils";

/**
 * The segmented control the Ladder screen established: Teko labels on a
 * `surface-2` track, the active segment lifted onto `surface` with the border
 * shadow. Ladder, Meta and Stats all render their tabs through this, so one
 * control looks the same everywhere instead of three near-misses.
 */
export function TabButtons<T extends string>({
  value,
  onChange,
  options,
  columns,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string; hint?: number }>;
  /** Fixed column count when the options should not share the row evenly. */
  columns?: number;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid gap-0.5 rounded-lg bg-surface-2 p-0.5"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "h-9 truncate rounded-md font-display text-lg tracking-wide transition-colors duration-150",
              active ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted",
            )}
          >
            {option.label}
            {option.hint != null ? (
              <span className="ml-1 font-sans text-[10px] tabular text-subtle">{option.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
