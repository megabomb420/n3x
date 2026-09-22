import { Link, useRouterState } from "@tanstack/react-router";
import { ChartColumn, Map, Swords, Users } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ClubLogo } from "./club-logo";

/**
 * The app frame: fixed header, a scrolling main column and three tabs.
 *
 * The tabs follow what a hosted build can actually source — Club (official club
 * and player endpoints), Ladder (official leaderboards) and Maps (the live
 * event rotation). The old Meta tab needed Brawl Time Ninja's Cube aggregates,
 * which no hosted build can reach; see HANDOFF.md.
 */
export function AppShell({
  title,
  children,
  headerRight,
}: {
  title?: string;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const clubActive = pathname === "/" || pathname.startsWith("/m/");
  const metaActive = pathname.startsWith("/meta");
  const ladderActive = pathname.startsWith("/ladder") || pathname.startsWith("/about");
  const mapsActive = pathname.startsWith("/maps");

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col overflow-hidden bg-bg text-fg">
      <header className="shrink-0 bg-bg safe-top">
        <div className="flex items-center gap-2 px-3 py-1">
          <Link to="/" aria-label="'N3X club home" className="shrink-0">
            <ClubLogo size={36} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[10px] uppercase leading-none tracking-[0.22em] text-gold">
              'N3X
            </p>
            <h1 className="truncate font-display text-[1.65rem] leading-none tracking-wide">
              {title ?? "Club"}
            </h1>
          </div>
          {headerRight}
        </div>
      </header>

      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
        {children}
      </main>

      <nav className="shrink-0 border-t border-border bg-bg safe-bottom" aria-label="Primary">
        <div className="grid grid-cols-4">
          <Link
            to="/"
            className={cn(
              "flex h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              clubActive ? "text-fg" : "text-subtle",
            )}
          >
            <Users className="size-4" strokeWidth={clubActive ? 2.2 : 1.7} />
            Club
          </Link>
          <Link
            to="/meta"
            className={cn(
              "flex h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              metaActive ? "text-fg" : "text-subtle",
            )}
          >
            <ChartColumn className="size-4" strokeWidth={metaActive ? 2.2 : 1.7} />
            Meta
          </Link>
          <Link
            to="/ladder"
            className={cn(
              "flex h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              ladderActive ? "text-fg" : "text-subtle",
            )}
          >
            <Swords className="size-4" strokeWidth={ladderActive ? 2.2 : 1.7} />
            Ladder
          </Link>
          <Link
            to="/maps"
            className={cn(
              "flex h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              mapsActive ? "text-fg" : "text-subtle",
            )}
          >
            <Map className="size-4" strokeWidth={mapsActive ? 2.2 : 1.7} />
            Maps
          </Link>
        </div>
      </nav>
    </div>
  );
}
