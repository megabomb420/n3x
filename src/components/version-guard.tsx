import { useEffect } from "react";
import { checkForUpdate, refreshServiceWorker } from "@/lib/app-version";
import { reloadOnce } from "@/lib/recovery";

/**
 * Keeps the installed app on the build the host is actually serving.
 *
 * A tab tap can only fail on a stale chunk if the app has been open across a
 * deploy, so the cheap fix is to make that state impossible: whenever the app
 * comes back to the foreground — and every ten minutes while it is there — ask
 * the host what it is serving, and step onto the new build before the user taps
 * something.
 *
 * Renders nothing.
 */
export function VersionGuard() {
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      if (!mounted || document.visibilityState !== "visible") return;
      const { state } = await checkForUpdate(import.meta.env.BASE_URL);
      if (!mounted || state !== "outdated") return;
      await refreshServiceWorker();
      reloadOnce();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };

    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => void check(), 10 * 60_000);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
