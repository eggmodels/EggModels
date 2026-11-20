// Shape of a document in the `factory_runs` Firestore collection, written by
// software-factory/self-hosted/record-run.mjs. Optional fields are filled in
// over the run's lifecycle (started -> scored -> PR opened -> outcome
// synced a few days later), so most fields can be absent until then.
export interface FactoryScores {
  stayedInScope?: boolean;
  noRedundantTests?: boolean;
  followedConventions?: boolean;
  ciPassedFirstTry?: boolean;
}

export type FactoryRunStatus = 'running' | 'completed' | 'failed' | 'skipped_no_changes';

export interface FactoryRun {
  runId: string;
  backlogItem: string;
  branch: string;
  implementer: string;
  status: FactoryRunStatus;
  startedAt?: string;
  prOpenedAt?: string;
  endedAt?: string;
  prNumber?: number;
  prUrl?: string;
  filesTouched?: string[];
  merged?: boolean;
  mergedAt?: string;
  ciPassed?: boolean;
  humanInteractions?: number;
  neededHumanReview?: boolean;
  cycleTimeKickoffToPrMinutes?: number;
  cycleTimePrToMergeMinutes?: number;
  computeCostUsd?: number;
  scores?: FactoryScores;
  scoresRaw?: string;
}
