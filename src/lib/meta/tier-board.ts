/** Pure tier-board grouping. No I/O, so it can be tested without the app alias. */

export const TIER_ORDER = ["S+", "S", "A+", "A", "B+", "B", "C+", "C", "D", "F"] as const;

export interface TierRow {
  name: string;
  tier: string;
  role: string | null;
  winRate: number;
  useRate: number | null;
  /** Games the figure rests on, when the publisher's table carries one. */
  games?: number | null;
}

export function groupTiers(rows: TierRow[]): Array<{ tier: string; rows: TierRow[] }> {
  const order = new Map<string, number>(TIER_ORDER.map((tier, index) => [tier, index]));
  const groups = new Map<string, TierRow[]>();
  for (const row of rows) {
    const list = groups.get(row.tier) ?? [];
    list.push(row);
    groups.set(row.tier, list);
  }
  return [...groups.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99) || a[0].localeCompare(b[0]))
    .map(([tier, grouped]) => ({ tier, rows: grouped }));
}
