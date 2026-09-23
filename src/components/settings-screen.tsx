import { Download, RefreshCw, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  APP_VERSION,
  checkForUpdate,
  describeVersion,
  refreshServiceWorker,
  type UpdateCheck,
} from "@/lib/app-version";
import {
  APP_ID,
  applyImport,
  buildExport,
  clearOwned,
  ImportError,
  parseExport,
  serializeExport,
  storageSummary,
} from "@/lib/backup";
import { LANGS, useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Where this device's copy of the app is configured: language, version, and the
 * data it keeps. Storage is read after mount so the prerendered shell and the
 * phone agree on the first paint.
 */
export function SettingsScreen() {
  const { lang, setLang, t } = useI18n();
  const [check, setCheck] = useState<UpdateCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [summary, setSummary] = useState({ count: 0, bytes: 0, label: "—" });
  const fileInput = useRef<HTMLInputElement>(null);

  function refreshSummary() {
    const local = storage();
    setSummary(local ? storageSummary(local) : { count: 0, bytes: 0, label: "—" });
  }

  async function runCheck() {
    setBusy(true);
    await refreshServiceWorker();
    setCheck(await checkForUpdate(import.meta.env.BASE_URL));
    setBusy(false);
  }

  useEffect(() => {
    refreshSummary();
    void runCheck();
  }, []);

  function exportAll() {
    const local = storage();
    if (!local) return;
    const file = buildExport(local);
    const blob = new Blob([serializeExport(file)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${APP_ID}-export-${APP_VERSION}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNote(t("settings.exportDone", { count: Object.keys(file.entries).length }));
  }

  async function importFile(file: File) {
    const local = storage();
    if (!local) return;
    try {
      const imported = parseExport(await file.text());
      applyImport(local, imported);
      window.location.reload();
    } catch (err) {
      setNote(
        t("settings.importFailed", {
          app: APP_ID,
          reason: err instanceof ImportError ? err.message : String((err as Error)?.message ?? err),
        }),
      );
    }
  }

  function resetApp() {
    const local = storage();
    if (!local) return;
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    clearOwned(local);
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-3 px-3">
      <section className="rounded-2xl bg-surface p-4">
        <h2 className="font-display text-lg tracking-wide">{t("settings.language")}</h2>
        <div className="mt-2 flex gap-1 rounded-full bg-surface-2 p-1">
          {LANGS.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => setLang(option.code)}
              aria-pressed={lang === option.code}
              className={cn(
                "min-h-9 flex-1 rounded-full px-3 text-sm font-medium",
                lang === option.code ? "bg-surface-3 text-fg" : "text-subtle",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-subtle">{t("settings.languageHint")}</p>
      </section>

      <section className="rounded-2xl bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg tracking-wide">{t("settings.version")}</h2>
          <span className="font-mono text-xs text-muted">{APP_VERSION}</span>
        </div>
        <p className="mt-1 text-[11px] text-subtle">{t("settings.built", { when: describeVersion(APP_VERSION) })}</p>
        <p
          className={cn(
            "mt-2 text-xs",
            check?.state === "outdated" ? "text-gold" : check?.state === "unknown" ? "text-low" : "text-muted",
          )}
        >
          {busy || !check
            ? t("settings.checking")
            : check.state === "outdated"
              ? t("settings.outdated")
              : check.state === "current"
                ? t("settings.upToDate")
                : t("settings.checkFailed")}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={busy}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 text-sm text-fg disabled:opacity-60"
          >
            <RefreshCw className={cn("size-4", busy && "animate-spin")} />
            {t("settings.check")}
          </button>
          {check?.state === "outdated" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 flex-1 rounded-xl bg-fg px-3 font-medium text-bg"
            >
              {t("settings.reload")}
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg tracking-wide">{t("settings.data")}</h2>
          <span className="text-xs text-subtle">
            {summary.count === 0
              ? t("settings.storageEmpty")
              : t("settings.storage", { count: summary.count, size: summary.label })}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-subtle">{t("settings.dataHint")}</p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={exportAll}
            disabled={summary.count === 0}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 text-sm text-fg disabled:opacity-60"
          >
            <Download className="size-4" />
            {t("settings.export")}
          </button>
          <p className="-mt-1 text-[11px] text-subtle">{t("settings.exportHint")}</p>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 text-sm text-fg"
          >
            <Upload className="size-4" />
            {t("settings.import")}
          </button>
          <p className="-mt-1 text-[11px] text-subtle">{t("settings.importHint")}</p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importFile(file);
            }}
          />
          <button
            type="button"
            onClick={resetApp}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm",
              confirmReset ? "bg-danger text-bg" : "bg-surface-2 text-danger",
            )}
          >
            <TriangleAlert className="size-4" />
            {confirmReset ? t("settings.resetConfirm") : t("settings.reset")}
          </button>
          <p className="-mt-1 text-[11px] text-subtle">{t("settings.resetHint")}</p>
        </div>
        {note ? <p className="mt-3 text-[11px] leading-relaxed text-muted">{note}</p> : null}
      </section>
    </div>
  );
}
