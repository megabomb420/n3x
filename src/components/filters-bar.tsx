import { SlidersHorizontal, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LEAGUE_OPTIONS, rangeFilterLabel, trophyFilterLabel } from "@/lib/meta/cube";
import { titleCaseMode } from "@/lib/meta/names";
import { seasonLabel } from "@/lib/meta/seasons";
import type { FilterState, TrophyFilterId } from "@/lib/meta/types";
import { cn } from "@/lib/utils";
import { useFilters } from "@/store/filters";

const TROPHIES: TrophyFilterId[] = ["all", "0-999", "1000+", "1500+", "2000+"];

export function FiltersBar({
  modes,
  maps,
}: {
  modes: string[];
  maps: { mode: string; map: string; picks: number }[];
}) {
  const queue = useFilters((s) => s.queue);
  const filters = useFilters((s) => s[s.queue]);
  const setTrophy = useFilters((s) => s.setTrophy);
  const setLeague = useFilters((s) => s.setLeague);
  const setMode = useFilters((s) => s.setMode);
  const setMap = useFilters((s) => s.setMap);
  const setSeason = useFilters((s) => s.setSeason);
  const resetCurrent = useFilters((s) => s.resetCurrent);
  const [open, setOpen] = useState(false);

  const mapOptions = maps.filter((m) => !filters.mode || m.mode === filters.mode).slice(0, 40);
  const rangeActive = queue === "ranked" ? filters.league !== "all" : filters.trophy !== "all";

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          <Chip active={rangeActive} onClick={() => setOpen(true)}>
            {rangeFilterLabel(queue, filters)}
          </Chip>
          <Chip active={Boolean(filters.mode)} onClick={() => setOpen(true)}>
            {filters.mode ? titleCaseMode(filters.mode) : "All modes"}
          </Chip>
          {filters.map ? (
            <Chip active onClick={() => setMap(null)}>
              {filters.map}
              <X className="size-3" />
            </Chip>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="All filters"
          onClick={() => setOpen(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-fg"
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-bg/70 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="filters-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="filters-title" className="font-display text-2xl tracking-wide">
                {queue === "ranked" ? "Ranked filters" : "Ladder filters"}
              </h2>
              <button type="button" className="text-sm text-muted" onClick={() => resetCurrent()}>
                Reset
              </button>
            </div>

            <Section title="Season">
              <Choice
                selected={filters.season === "current"}
                onClick={() => setSeason("current")}
                label={seasonLabel("current")}
              />
              <Choice
                selected={filters.season === "sixWeeks"}
                onClick={() => setSeason("sixWeeks")}
                label={seasonLabel("sixWeeks")}
              />
            </Section>

            {queue === "ranked" ? (
              <Section
                title="ELO / league"
                hint="Ranked battles store league, not brawler trophies. Gold+ is Gold I and up."
              >
                {LEAGUE_OPTIONS.map((opt) => (
                  <Choice
                    key={opt.id}
                    selected={(filters.league ?? "all") === opt.id}
                    onClick={() => setLeague(opt.id)}
                    label={opt.id === "all" ? opt.label : `${opt.label} · ${opt.elo}`}
                  />
                ))}
              </Section>
            ) : (
              <Section
                title="Trophy range"
                hint="100-trophy buckets from Brawl Time Ninja, grouped for the list."
              >
                {TROPHIES.map((id) => (
                  <Choice
                    key={id}
                    selected={filters.trophy === id}
                    onClick={() => setTrophy(id)}
                    label={trophyFilterLabel(id)}
                  />
                ))}
              </Section>
            )}

            <Section title="Mode">
              <Choice selected={!filters.mode} onClick={() => setMode(null)} label="All modes" />
              {modes.map((mode) => (
                <Choice
                  key={mode}
                  selected={filters.mode === mode}
                  onClick={() => setMode(mode)}
                  label={titleCaseMode(mode)}
                />
              ))}
            </Section>

            {mapOptions.length > 0 ? (
              <Section title="Map">
                <Choice selected={!filters.map} onClick={() => setMap(null)} label="All maps" />
                {mapOptions.map((m) => (
                  <Choice
                    key={`${m.mode}-${m.map}`}
                    selected={filters.map === m.map && filters.mode === m.mode}
                    onClick={() => {
                      setMode(m.mode);
                      setMap(m.map);
                    }}
                    label={m.map}
                  />
                ))}
              </Section>
            ) : null}

            <button
              type="button"
              className="mt-4 min-h-11 w-full rounded-xl bg-fg font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.96]"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs",
        active ? "bg-fg text-bg" : "bg-surface text-muted",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-subtle">{title}</h3>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Choice({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full px-3 text-sm",
        selected ? "bg-fg text-bg" : "bg-surface-2 text-muted",
      )}
    >
      {label}
    </button>
  );
}

export function ActiveFilterSummary({ filters }: { filters: FilterState }) {
  const queue = useFilters((s) => s.queue);
  return (
    <p className="min-w-0 truncate px-1 text-[11px] text-subtle">
      {filters.season === "current" ? "This season" : "6 weeks"}
      {" · "}
      {rangeFilterLabel(queue, filters)}
      {filters.mode ? ` · ${titleCaseMode(filters.mode)}` : ""}
      {filters.map ? ` · ${filters.map}` : ""}
    </p>
  );
}
