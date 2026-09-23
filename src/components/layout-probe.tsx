import { useEffect, useState } from "react";

/**
 * `?diag=1` overlay.
 *
 * One iOS screen reports four different heights — visual viewport, layout
 * viewport, `100lvh` and the physical screen — and the installed app is the
 * only place any of them can be read. The overlay prints them and outlines the
 * layout viewport (cyan) and the app column (magenta), so one screenshot says
 * whether the shell actually reaches the bottom of the screen.
 *
 * Inert without the query parameter, and never takes pointer events.
 */
export function LayoutProbe() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [shellBox, setShellBox] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("diag")) return;

    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:-9999px;height:100lvh;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    document.body.append(probe);

    const read = () => {
      const cs = getComputedStyle(probe);
      const root = document.documentElement;
      const standalone = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
      const shell = document.querySelector("body > div");
      const nav = document.querySelector("nav");
      const box = (el: Element | null) => {
        if (!el) return "—";
        const r = el.getBoundingClientRect();
        return `${Math.round(r.top)}→${Math.round(r.bottom)}`;
      };
      setLines([
        `inner ${window.innerHeight} · vv ${Math.round(window.visualViewport?.height ?? 0)} · vvTop ${Math.round(window.visualViewport?.offsetTop ?? 0)}`,
        `doc ${root.clientHeight} · scroll ${root.scrollHeight} · screen ${Math.round(window.screen.height / window.devicePixelRatio)}`,
        `lvh ${cs.height} · env t ${cs.paddingTop} b ${cs.paddingBottom} · app-h ${cs.getPropertyValue("--app-h").trim() || "—"}`,
        `standalone ${standalone} · dpr ${window.devicePixelRatio}`,
        `shell ${box(shell)} · nav ${box(nav)}`,
      ]);
      const r = shell?.getBoundingClientRect();
      setShellBox(r ? { top: r.top, height: r.height } : null);
    };

    read();
    const timer = window.setInterval(read, 1000);
    window.addEventListener("resize", read);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", read);
      probe.remove();
    };
  }, []);

  if (!lines) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 border-2 border-cyan-400/70">
      <div
        className="absolute inset-x-0 border-y-2 border-fuchsia-500/80"
        style={{ top: shellBox?.top ?? 0, height: shellBox?.height ?? 0 }}
      />
      <pre className="absolute left-1 top-1 rounded-md bg-black/85 px-2 py-1 font-mono text-[10px] leading-tight text-cyan-200 shadow-lg">
        {lines.join("\n")}
      </pre>
    </div>
  );
}
