import { cn } from "@/lib/utils";
import type { Confidence, Tier } from "@/lib/meta/types";

const TIER_CLASS: Record<Tier, string> = {
  S: "bg-gold text-gold-fg",
  A: "bg-fg/90 text-bg",
  B: "bg-surface-3 text-fg",
  C: "bg-surface-2 text-muted",
  D: "bg-bg text-subtle shadow-[inset_0_0_0_1px_var(--color-border)]",
};

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-sm px-1.5 font-display text-lg font-semibold leading-none tracking-wide",
        TIER_CLASS[tier],
        className,
      )}
    >
      {tier}
    </span>
  );
}

export function ConfidenceDot({
  value,
  showLabel = false,
}: {
  value: Confidence;
  showLabel?: boolean;
}) {
  const label = value === "HIGH" ? "High sample" : value === "MEDIUM" ? "Medium sample" : "Low sample";
  const text = showLabel || value !== "HIGH" ? value : null;
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-wider",
        value === "HIGH" && "text-win",
        value === "MEDIUM" && "text-gold",
        value === "LOW" && "text-danger",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          value === "HIGH" && "bg-win",
          value === "MEDIUM" && "bg-gold",
          value === "LOW" && "bg-danger",
        )}
      />
      {text}
    </span>
  );
}
