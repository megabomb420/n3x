/**
 * The live event rotation: its payload, its one loader and its window text.
 *
 * The Maps screen and a single map's own screen both read `GET /maps`, and both
 * have to spell a time window the same way, so the shape and the formatting live
 * here rather than in either screen. The wording comes from the dictionary —
 * `maps.ends` / `maps.starts` / `maps.timeUnknown` — so a Polish interface does
 * not fall back to an English sentence the way the screen-local copy did.
 */
import { apiGet } from "@/lib/api/client";
import { formatRelative } from "@/lib/meta/format";
import type { StringKey } from "@/lib/i18n/provider";

export interface RotationEvent {
  slot: string;
  mode: string;
  map: string;
  startTime: string | null;
  endTime: string | null;
}

export interface RotationPayload {
  updatedAt: number;
  active: RotationEvent[];
  upcoming: RotationEvent[];
  source: string;
}

/** The Worker's `GET /maps` — the whole rotation, live and upcoming. */
export function loadRotation(): Promise<RotationPayload> {
  return apiGet<RotationPayload>("/maps");
}

/** `useT()`, so the shared text follows the interface language. */
type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

/**
 * The API stamps event times as `20260922T080000.000Z`, which `Date.parse`
 * rejects; put the separators back before parsing.
 */
export function toMs(value: string | null): number | null {
  if (!value) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value);
  const ms = compact
    ? Date.parse(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`)
    : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * The row's time window, built only from what the payload carries — an absent
 * or unparseable side is shown raw rather than replaced by an invented one.
 */
export function formatWindow(
  startTime: string | null,
  endTime: string | null,
  t: Translate,
): string {
  if (startTime == null && endTime == null) return t("maps.timeUnknown");

  const start = toMs(startTime);
  const end = toMs(endTime);

  // Both sides published: the full window, clock times only when it fits one day.
  if (startTime != null && endTime != null) {
    if (start == null || end == null) return `${startTime} – ${endTime}`;
    if (new Date(start).toDateString() === new Date(end).toDateString()) {
      return `${clock(start)} – ${clock(end)}`;
    }
    const startDay = new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const endDay = new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${startDay} ${clock(start)} – ${endDay} ${clock(end)}`;
  }

  // Only one side published: name it, relative once it has already happened.
  if (endTime != null) {
    return t("maps.ends", {
      when: end == null ? endTime : end <= Date.now() ? formatRelative(end) : clock(end),
    });
  }
  if (startTime != null) {
    return t("maps.starts", {
      when: start == null ? startTime : start <= Date.now() ? formatRelative(start) : clock(start),
    });
  }
  return t("maps.timeUnknown");
}
