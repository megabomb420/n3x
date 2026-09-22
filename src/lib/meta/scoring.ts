/**
 * Meta score, tiers, and sample confidence.
 *
 * Adjusted win rate (winRateAdj) is Brawl Time Ninja's Bayesian average:
 *   prior ≈ least((avg(trophyRange)-5)^2/100 + 0.55, 0.9)
 *   adj   = (1583 + wr * n) / (1583 / prior + n)
 * We treat that as the displayed quality signal and do NOT rank by raw WR.
 *
 * At small n the cube prior (often ~0.9 at high trophies) dominates, so a 55%
 * WR on 200 games can show as 86% adj. Ranking uses an extra shrink toward
 * the filtered population mean so those rows cannot steal the top:
 *
 *   quality     = (n * adj + 800 * meanAdj) / (n + 800)
 *   impact      = adj * log10(picks + 10)
 *   z(x)        = (x - mean) / stdev   within the filtered population
 *   metaScore   = 0.70 * z(quality) + 0.30 * z(impact)
 *
 * Popularity / use rate is intentionally excluded from the score.
 * Displayed adj WR is still the provider's number; only ranking is shrunk.
 *
 * Tiers are population-relative using the score distribution:
 *   S  score ≥ mean + 1.25σ
 *   A  score ≥ mean + 0.40σ
 *   B  score ≥ mean - 0.35σ
 *   C  score ≥ mean - 1.15σ
 *   D  otherwise
 *
 * Confidence (visible, never hidden):
 *   HIGH    picks ≥ 8_000
 *   MEDIUM  picks ≥ 1_200
 *   LOW     otherwise
 *
 * LOW-confidence rows are capped at B. Rows with picks < 80 are capped at C.
 */
import type { Confidence, Tier } from "./types";

export function confidenceForPicks(picks: number): Confidence {
  if (picks >= 8000) return "HIGH";
  if (picks >= 1200) return "MEDIUM";
  return "LOW";
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const v = values.reduce((s, x) => s + (x - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function zscore(value: number, avg: number, sd: number): number {
  if (sd < 1e-9) return 0;
  return (value - avg) / sd;
}

export interface ScoredInput {
  winRateAdj: number;
  picks: number;
}

export interface ScoredOutput {
  metaScore: number;
  tier: Tier;
  confidence: Confidence;
}

const RANK_PSEUDO = 800;

export function scorePopulation<T extends ScoredInput>(
  rows: T[],
): (T & ScoredOutput)[] {
  if (rows.length === 0) return [];

  const adj = rows.map((r) => r.winRateAdj);
  const adjMean = mean(adj);
  const quality = rows.map(
    (r) => (r.winRateAdj * r.picks + RANK_PSEUDO * adjMean) / (r.picks + RANK_PSEUDO),
  );
  const impact = rows.map((r) => r.winRateAdj * Math.log10(r.picks + 10));
  const qMean = mean(quality);
  const qSd = stdev(quality, qMean);
  const impMean = mean(impact);
  const impSd = stdev(impact, impMean);

  const scored = rows.map((row, i) => {
    const metaScore =
      0.7 * zscore(quality[i]!, qMean, qSd) + 0.3 * zscore(impact[i]!, impMean, impSd);
    const confidence = confidenceForPicks(row.picks);
    return { ...row, metaScore, confidence, tier: "B" as Tier };
  });

  const scores = scored.map((r) => r.metaScore);
  const sMean = mean(scores);
  const sSd = stdev(scores, sMean);

  return scored.map((row) => {
    let tier: Tier;
    if (row.metaScore >= sMean + 1.25 * sSd) tier = "S";
    else if (row.metaScore >= sMean + 0.4 * sSd) tier = "A";
    else if (row.metaScore >= sMean - 0.35 * sSd) tier = "B";
    else if (row.metaScore >= sMean - 1.15 * sSd) tier = "C";
    else tier = "D";

    if (row.picks < 80) tier = capAt(tier, "C");
    else if (row.confidence === "LOW") tier = capAt(tier, "B");
    return { ...row, tier };
  });
}

function tierRank(tier: Tier): number {
  return { S: 0, A: 1, B: 2, C: 3, D: 4 }[tier];
}

function capAt(tier: Tier, floor: Tier): Tier {
  return tierRank(tier) < tierRank(floor) ? floor : tier;
}

export const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];
