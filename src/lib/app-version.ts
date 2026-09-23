/**
 * Which build this copy of the app is.
 *
 * The version is compiled in at build time and the same string is written to
 * `version.json` next to the app. The Settings screen fetches that file with
 * caching off: if the host serves a different one, this copy is behind — which
 * is exactly what happens when the service worker or a host cache keeps an old
 * shell alive after a deploy.
 */
export const APP_VERSION: string = import.meta.env?.VITE_APP_VERSION ?? "dev";

/** `20260923T1015Z` → something a person reads. */
export function describeVersion(version: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})Z$/.exec(version);
  if (!match) return version;
  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

export type UpdateState = "checking" | "current" | "outdated" | "unknown";

export interface UpdateCheck {
  state: UpdateState;
  deployed: string | null;
}

/** Ask the host what it is serving, with every cache told to stand aside. */
export async function checkForUpdate(baseUrl: string): Promise<UpdateCheck> {
  try {
    const res = await fetch(`${baseUrl}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { state: "unknown", deployed: null };
    const payload = (await res.json()) as { version?: unknown };
    const deployed = typeof payload.version === "string" ? payload.version : null;
    if (!deployed) return { state: "unknown", deployed: null };
    if (deployed === APP_VERSION) return { state: "current", deployed };
    // A "dev" build has no build stamp to compare against; the host always wins.
    return { state: "outdated", deployed };
  } catch {
    return { state: "unknown", deployed: null };
  }
}

/** Ask the service worker to look for a new shell, then take it. */
export async function refreshServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  } catch {
    /* no worker, no update — a plain reload still fetches fresh HTML */
  }
}
