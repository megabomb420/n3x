/**
 * Recovery from a stale build.
 *
 * Every deploy replaces the hashed route chunks, and the installed app can sit
 * open for days — so tapping a tab can ask the host for a module it no longer
 * serves, and the router shows "Importing a module script failed".
 */

const RELOAD_KEY = "n3x.reloadedAt";
const RELOAD_FLOOR_MS = 20_000;

/** Does this error mean the running build asked for a chunk that is gone? */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return false;
  return /importing a module script failed|dynamically imported module|mime type of "text\/html"|failed to load module/i.test(
    message,
  );
}

/**
 * Reload the app, at most once every twenty seconds: the reload is the fix for
 * a stale chunk, but a host that serves a broken build must not trap the user in
 * a reload loop.
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_FLOOR_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // private mode / no storage: reload anyway, the guard is best effort
  }
  window.location.reload();
  return true;
}
