/**
 * Recovery from a stale build.
 *
 * Every deploy replaces the hashed route chunks, and the installed app can sit
 * open for days — so tapping a tab can ask the host for a module it no longer
 * serves, and the router shows "Importing a module script failed".
 *
 * A reload fixes that only if the reload itself is not answered from the shell
 * the service worker cached earlier, so the document caches are dropped first.
 */

const RELOAD_KEY = "n3x.reloadedAt";
const RELOAD_FLOOR_MS = 20_000;

/** The document caches the service worker answers a navigation from. */
export function documentCacheKeys(keys: string[]): string[] {
  return keys.filter((key) => key.startsWith("n3x-shell"));
}

/** Does this error mean the running build asked for a chunk that is gone? */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return false;
  return /importing a module script failed|dynamically imported module|mime type of "text\/html"|failed to load module/i.test(
    message,
  );
}

/**
 * Drop what a reload could be answered from, so it reaches the host.
 * Best effort: no Cache API (or private mode) simply means the reload is tried.
 */
async function dropDocumentCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(documentCacheKeys(keys).map((key) => caches.delete(key)));
  } catch {
    // no storage — the reload below is still the fix
  }
}

/**
 * Reload the app, at most once every twenty seconds: the reload is the fix for
 * a stale chunk, but a host that serves a broken build must not trap the user in
 * a reload loop.
 */
export async function reloadOnce(): Promise<boolean> {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_FLOOR_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // private mode / no storage: reload anyway, the guard is best effort
  }
  await dropDocumentCaches();
  window.location.reload();
  return true;
}
