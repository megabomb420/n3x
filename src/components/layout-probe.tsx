import { useEffect, useState } from "react";

/**
 * `?diag=1` overlay.
 *
 * One iOS screen reports four different heights — the visual viewport, the
 * layout viewport, `100lvh` and the physical screen — and the installed app is
 * the only place any of them can be read. The panel prints all of them and the
 * two bars test what is actually displayable, which is the question `100lvh`
 * hinges on:
 *
 *   lime   — sits at the bottom edge of `100lvh`
 *   orange — sits at the bottom edge of the physical screen
 *
 * Both bars are `position: fixed`, so only the visual viewport can clip them:
 * a bar you can see is a height the app can be laid out against. The layout
 * viewport is outlined in cyan and the app column in magenta.
 *
 * Inert without the query parameter, and never takes pointer events.
 */
export function LayoutProbe() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [shell, setShell] = useState<{ top: number; height: number } | null>(null);
  const [screenPx, setScreenPx] = useState(0);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("diag")) return;

    const measure = (css: string) => {
      const div = document.createElement("div");
      div.style.cssText = `position:absolute;left:-9999px;width:1px;${css}`;
      document.body.append(div);
      const value = Math.round(div.getBoundingClientRect().height);
      div.remove();
      return value;
    };
    const env = (side: string) => {
      const div = document.createElement("div");
      div.style.cssText = `position:absolute;left:-9999px;padding-${side}:env(safe-area-inset-${side}, 0px)`;
      document.body.append(div);
      const value = getComputedStyle(div).getPropertyValue(`padding-${side}`).trim();
      div.remove();
      return value || "0px";
    };

    const read = () => {
      const root = document.documentElement;
      const standalone = matchMedia(
        "(display-mode: standalone), (display-mode: fullscreen)",
      ).matches;
      const box = (el: Element | null) => {
        if (!el) return "—";
        const r = el.getBoundingClientRect();
        return `${Math.round(r.top)}→${Math.round(r.bottom)}`;
      };
      const column = document.querySelector("nav")?.parentElement ?? null;
      const screenHeight = Math.round(window.screen.height);
      setScreenPx(screenHeight);
      setLines([
        `inner ${window.innerHeight} · vv ${Math.round(window.visualViewport?.height ?? 0)} · vvTop ${Math.round(window.visualViewport?.offsetTop ?? 0)}`,
        `doc ${root.clientHeight} · scroll ${root.scrollHeight} · screen ${screenHeight} · dpr ${window.devicePixelRatio}`,
        `lvh ${measure("height:100lvh")} · svh ${measure("height:100svh")} · dvh ${measure("height:100dvh")}`,
        `env top ${env("top")} · bottom ${env("bottom")} · app-h ${root.style.getPropertyValue("--app-h") || "unset"} · nav-pad ${getComputedStyle(document.querySelector("nav") ?? root).paddingBottom}`,
        `standalone ${standalone}`,
        `column ${box(column)} · nav ${box(document.querySelector("nav"))}`,
      ]);
      const r = column?.getBoundingClientRect();
      setShell(r ? { top: r.top, height: r.height } : null);
    };

    read();
    const timer = window.setInterval(read, 1000);
    window.addEventListener("resize", read);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", read);
    };
  }, []);

  if (!lines) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 border-2 border-cyan-400/70">
      <div
        className="absolute inset-x-0 border-y-2 border-fuchsia-500/80"
        style={{ top: shell?.top ?? 0, height: shell?.height ?? 0 }}
      />
      <div
        className="absolute inset-x-0 h-6 bg-lime-400/80"
        data-probe="lvh"
        style={{ top: "calc(100lvh - 1.5rem)" }}
      />
      <div
        className="absolute inset-x-0 h-6 bg-orange-500/80"
        data-probe="screen"
        style={{ top: Math.max(0, screenPx - 24) }}
      />
      <pre className="absolute bottom-8 left-1 rounded-md bg-black/85 px-2 py-1 font-mono text-[12px] leading-snug text-cyan-200 shadow-lg">
        {lines.join("\n")}
      </pre>
    </div>
  );
}
