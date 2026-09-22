/**
 * Brawl Stars trophy seasons are 14-day windows ending on Monday 00:00 UTC.
 * Brawl Time Ninja's `season` dimension is the END date (YYYY-MM-DD).
 * Epoch: the season that ended 2026-09-14 (started 2026-08-31).
 */
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const EPOCH_END = Date.UTC(2026, 8, 14); // 2026-09-14

function isoDateUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function currentSeasonEnd(now = Date.now()): string {
  const n = Math.floor((now - EPOCH_END) / TWO_WEEKS_MS);
  return isoDateUTC(EPOCH_END + (n + 1) * TWO_WEEKS_MS);
}

export function previousSeasonEnd(now = Date.now()): string {
  const current = Date.parse(`${currentSeasonEnd(now)}T00:00:00Z`);
  return isoDateUTC(current - TWO_WEEKS_MS);
}

export function sixWeekSeasonEnds(now = Date.now()): string[] {
  const current = Date.parse(`${currentSeasonEnd(now)}T00:00:00Z`);
  return [
    isoDateUTC(current),
    isoDateUTC(current - TWO_WEEKS_MS),
    isoDateUTC(current - 2 * TWO_WEEKS_MS),
  ];
}

export function seasonValuesForWindow(window: "current" | "sixWeeks"): string[] {
  return window === "current" ? [currentSeasonEnd()] : sixWeekSeasonEnds();
}

export function seasonLabel(window: "current" | "sixWeeks"): string {
  if (window === "current") {
    const end = currentSeasonEnd();
    const start = isoDateUTC(Date.parse(`${end}T00:00:00Z`) - TWO_WEEKS_MS);
    return `This season (${start} → ${end})`;
  }
  return "Last 6 weeks";
}
