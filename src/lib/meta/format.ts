export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatPicks(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function formatTrophies(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-GB");
}

export function formatRelative(isoOrMs: string | number | null, now = Date.now()): string {
  if (isoOrMs == null) return "Unknown";
  const then = typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(then)) return "Unknown";
  const delta = Math.max(0, now - then);
  const sec = Math.round(delta / 1000);
  if (sec < 45) return "just now";
  if (sec < 90) return "1 min ago";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return hr === 1 ? "1 hr ago" : `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? "1 day ago" : `${day} days ago`;
}

export function formatTrend(delta: number | null): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  const pts = delta * 100;
  if (Math.abs(pts) < 0.15) return "stable";
  const sign = pts > 0 ? "+" : "";
  return `${sign}${pts.toFixed(1)} pts`;
}

export function formatPublished(iso: string | null): string {
  if (!iso) return "Unknown date";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "Unknown date";
  return new Date(then).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value.replace(/&([a-z]+);/g, (m, name) => named[name] ?? m).replace(/&#39;/g, "'");
}
