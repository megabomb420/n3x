import { Link, useRouterState } from "@tanstack/react-router";
import { ChartColumn, Map, Settings, Swords, Users, Youtube } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useT, type StringKey } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { ClubLogo } from "./club-logo";

/**
 * The app frame: fixed header, a scrolling main column and the tabs.
 *
 * The tabs follow what a hosted build can actually source — Club, Stats, Meta,
 * Ladder, Maps and the device's own settings. The old Meta tab needed Brawl
 * Time Ninja's Cube aggregates, which no hosted build can reach; see HANDOFF.md.
 */
const TABS: Array<{ to: string; icon: typeof Users; label: StringKey; active: (path: string) => boolean }> = [
  { to: "/", icon: Users, label: "nav.club", active: (path) => path === "/" || path.startsWith("/m/") },
  { to: "/stats", icon: ChartColumn, label: "nav.stats", active: (path) => path.startsWith("/stats") },
  { to: "/meta", icon: Youtube, label: "nav.meta", active: (path) => path.startsWith("/meta") },
  { to: "/ladder", icon: Swords, label: "nav.ladder", active: (path) => path.startsWith("/ladder") },
  { to: "/maps", icon: Map, label: "nav.maps", active: (path) => path.startsWith("/maps") },
  { to: "/settings", icon: Settings, label: "nav.settings", active: (path) => path.startsWith("/settings") },
];

export function AppShell({
  title,
  children,
  headerRight,
}: {
  title?: string;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: "none",
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

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
              {title ?? t("nav.club")}
            </h1>
          </div>
          {headerRight}
        </div>
      </header>

      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
        {children}
      </main>

      <nav className="shrink-0 border-t border-border bg-bg safe-bottom" aria-label="Primary">
        <div className="grid grid-cols-6">
          {TABS.map((tab) => {
            const active = tab.active(pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex h-11 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-fg" : "text-subtle",
                )}
              >
                <Icon className="size-4" strokeWidth={active ? 2.2 : 1.7} />
                <span className="max-w-full truncate px-0.5">{t(tab.label)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
