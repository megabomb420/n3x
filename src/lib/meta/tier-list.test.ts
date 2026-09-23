import assert from "node:assert/strict";
import test from "node:test";
import { groupTiers, type TierRow } from "./tier-board.ts";

function row(name: string, tier: string): TierRow {
  return { name, tier, role: null, winRate: 50, useRate: 1 };
}

test("tiers render S+ through D, and an unknown band sorts after the known ones", () => {
  const grouped = groupTiers([
    row("Colt", "D"),
    row("Nita", "A"),
    row("Shelly", "S+"),
    row("Bull", "S+"),
    row("Brock", "Z"),
    row("Spike", "S"),
  ]);
  assert.deepEqual(
    grouped.map((group) => group.tier),
    ["S+", "S", "A", "D", "Z"],
  );
  assert.deepEqual(
    grouped[0]?.rows.map((entry) => entry.name),
    ["Shelly", "Bull"],
    "order inside a tier is the source order, not alphabetical",
  );
});
