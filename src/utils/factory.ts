import type { FactoryRun } from '../types/factory';

export interface FactoryProductivityStats {
  totalRuns: number;
  prsOpened: number;
  prsMerged: number;
  avgKickoffToPrMinutes: number | null;
  avgPrToMergeMinutes: number | null;
  avgHumanInteractions: number | null;
  shareNeedingHumanReview: number | null;
}

export interface FactorySpendingStats {
  totalComputeCostUsd: number;
  runsWithCostData: number;
  budgetCapUsd: number;
}

export interface FactoryScorerRate {
  scorer: keyof NonNullable<FactoryRun['scores']>;
  label: string;
  passRate: number | null;
  graded: number;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeProductivityStats(runs: FactoryRun[]): FactoryProductivityStats {
  const prsOpenedRuns = runs.filter((r) => r.prNumber != null);
  const prsMergedRuns = runs.filter((r) => r.merged === true);
  const reviewKnownRuns = runs.filter((r) => r.neededHumanReview != null);

  return {
    totalRuns: runs.length,
    prsOpened: prsOpenedRuns.length,
    prsMerged: prsMergedRuns.length,
    avgKickoffToPrMinutes: average(
      runs.map((r) => r.cycleTimeKickoffToPrMinutes).filter((v): v is number => v != null),
    ),
    avgPrToMergeMinutes: average(
      runs.map((r) => r.cycleTimePrToMergeMinutes).filter((v): v is number => v != null),
    ),
    avgHumanInteractions: average(
      runs.map((r) => r.humanInteractions).filter((v): v is number => v != null),
    ),
    shareNeedingHumanReview:
      reviewKnownRuns.length === 0
        ? null
        : reviewKnownRuns.filter((r) => r.neededHumanReview).length / reviewKnownRuns.length,
  };
}

// $10/mo cap from software-factory/self-hosted/gcp/README.md's BUDGET_AMOUNT.
export const FACTORY_MONTHLY_BUDGET_USD = 10;

export function computeSpendingStats(runs: FactoryRun[]): FactorySpendingStats {
  const withCost = runs.filter((r) => r.computeCostUsd != null);
  return {
    totalComputeCostUsd: withCost.reduce((sum, r) => sum + (r.computeCostUsd ?? 0), 0),
    runsWithCostData: withCost.length,
    budgetCapUsd: FACTORY_MONTHLY_BUDGET_USD,
  };
}

const SCORER_LABELS: Record<keyof NonNullable<FactoryRun['scores']>, string> = {
  stayedInScope: 'Stayed in scope',
  noRedundantTests: 'No redundant tests',
  followedConventions: 'Followed repo conventions',
  ciPassedFirstTry: 'CI passed first try',
};

export function computeScorerRates(runs: FactoryRun[]): FactoryScorerRate[] {
  const scorers = Object.keys(SCORER_LABELS) as Array<keyof typeof SCORER_LABELS>;
  return scorers.map((scorer) => {
    const graded = runs.filter((r) => r.scores?.[scorer] != null);
    const passed = graded.filter((r) => r.scores?.[scorer] === true);
    return {
      scorer,
      label: SCORER_LABELS[scorer],
      graded: graded.length,
      passRate: graded.length === 0 ? null : passed.length / graded.length,
    };
  });
}

export function failingRuns(runs: FactoryRun[]): FactoryRun[] {
  return runs.filter(
    (r) =>
      r.scores &&
      Object.values(r.scores).some((v) => v === false),
  );
}
