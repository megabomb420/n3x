import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { STRINGS } from "@/lib/i18n/dictionary";
import { readPref } from "@/lib/prefs";
import { isStaleChunkError, reloadOnce } from "@/lib/recovery";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

/**
 * The router's last resort. A missing chunk — the app running an older build
 * than the host serves — fixes itself with a reload, so that case says so and
 * reloads instead of showing a dead end; anything else gets a manual way out,
 * because the alternative is force-quitting the installed app.
 *
 * The i18n provider is not guaranteed to be mounted here, so the two strings it
 * needs are read from the dictionary with the saved language.
 */
export function AppErrorComponent({ error }: ErrorComponentProps) {
  const stale = isStaleChunkError(error);
  const [reloading, setReloading] = useState(stale);
  const words = STRINGS[readPref("n3x.lang") === "pl" ? "pl" : "en"];

  useEffect(() => {
    if (stale) setReloading(reloadOnce());
  }, [stale]);

  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">
        {reloading ? words["error.oldBuild"] : words["error.title"]}
      </h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
        {reloading ? words["error.oldBuildBody"] : errorMessage(error)}
      </p>
      {reloading ? null : (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {words["common.reload"]}
        </button>
      )}
    </main>
  );
}
