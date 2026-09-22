import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { loadCatalog } from "@/lib/meta/brawlapi";
import { displayBrawlerName } from "@/lib/meta/names";
import { loadMeta } from "@/lib/meta/queries";
import { useFilters } from "@/store/filters";
import { Portrait } from "./portrait";
import { TierBadge } from "./tier-badge";

export function SearchButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search brawlers"
      className="flex size-9 items-center justify-center rounded-lg bg-surface text-fg"
    >
      <Search className="size-4" />
    </button>
  );
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const ladderFilters = useFilters((s) => s.ladder);
  const rankedFilters = useFilters((s) => s.ranked);

  const catalogQuery = useQuery({
    queryKey: ["catalog"],
    queryFn: loadCatalog,
    enabled: open,
  });
  const ladderQuery = useQuery({
    queryKey: ["meta", "ladder", ladderFilters],
    queryFn: () => loadMeta("ladder", ladderFilters),
    enabled: open,
  });
  const rankedQuery = useQuery({
    queryKey: ["meta", "ranked", rankedFilters],
    queryFn: () => loadMeta("ranked", rankedFilters),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !catalogQuery.data) return [];
    const ladderMap = new Map(ladderQuery.data?.rows.map((r) => [r.cubeName, r]) ?? []);
    const rankedMap = new Map(rankedQuery.data?.rows.map((r) => [r.cubeName, r]) ?? []);
    return catalogQuery.data.brawlers
      .filter(
        (b) =>
          b.name.toLowerCase().includes(needle) ||
          b.cubeName.toLowerCase().includes(needle) ||
          b.hash.toLowerCase().includes(needle),
      )
      .slice(0, 12)
      .map((b) => ({
        catalog: b,
        ladder: ladderMap.get(b.cubeName) ?? null,
        ranked: rankedMap.get(b.cubeName) ?? null,
      }));
  }, [q, catalogQuery.data, ladderQuery.data, rankedQuery.data]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-label="Search brawlers"
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl bg-surface px-3">
          <Search className="size-4 text-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search brawlers"
            className="h-11 w-full bg-transparent text-base text-fg outline-none placeholder:text-subtle"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-xl bg-surface"
          aria-label="Close search"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-8">
        {q.trim() && results.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted">No brawlers match “{q.trim()}”.</p>
        ) : null}
        <ul className="flex flex-col gap-1.5">
          {results.map((r) => (
            <li key={r.catalog.id}>
              <button
                type="button"
                className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-surface px-3 py-2 text-left"
                onClick={() => {
                  onClose();
                  void navigate({
                    to: "/brawlers/$brawlerId",
                    params: { brawlerId: String(r.catalog.id) },
                    search: { name: r.catalog.cubeName },
                  });
                }}
              >
                <Portrait catalog={r.catalog} cubeName={r.catalog.cubeName} size={40} decorative />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {r.catalog.name || displayBrawlerName(r.catalog.cubeName)}
                  </div>
                  <div className="text-[11px] text-muted">{r.catalog.rarity}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-subtle">L</span>
                  {r.ladder ? (
                    <TierBadge tier={r.ladder.tier} className="h-6 min-w-6 text-base" />
                  ) : (
                    <span className="text-xs text-subtle">—</span>
                  )}
                  <span className="ml-1 text-[10px] uppercase tracking-wider text-subtle">R</span>
                  {r.ranked ? (
                    <TierBadge tier={r.ranked.tier} className="h-6 min-w-6 text-base" />
                  ) : (
                    <span className="text-xs text-subtle">—</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
