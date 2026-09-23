import { WifiOff, TriangleAlert, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";

export function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
          <div className="skeleton size-10 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton h-3 w-28 rounded" />
            <div className="skeleton h-2.5 w-44 rounded" />
          </div>
          <div className="skeleton h-7 w-7 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-5 py-10 text-center">
      <Inbox className="size-8 text-subtle" strokeWidth={1.5} />
      <h2 className="font-display text-2xl tracking-wide">{title}</h2>
      <p className="max-w-xs text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-5 py-10 text-center">
      <TriangleAlert className="size-8 text-danger" strokeWidth={1.5} />
      <h2 className="font-display text-2xl tracking-wide">{title}</h2>
      <p className="max-w-xs text-sm text-muted">{body}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-11 rounded-xl bg-fg px-4 font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          {t("common.tryAgain")}
        </button>
      ) : null}
    </div>
  );
}

export function OfflineBanner({ stale }: { stale?: boolean }) {
  const t = useT();
  return (
    <div className="mb-1 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
      <WifiOff className="size-3.5 shrink-0" />
      {stale ? t("common.offlineStale") : t("common.offline")}
    </div>
  );
}
