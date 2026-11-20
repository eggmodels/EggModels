import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import '../Factory.css';
import { StatTile, StatTileRow } from './shared/StatTile';
import type { FactoryRun } from '../types/factory';
import {
  computeProductivityStats,
  computeSpendingStats,
  computeScorerRates,
  failingRuns,
} from '../utils/factory';

const MAX_RUNS = 200;

type Tab = 'productivity' | 'spending' | 'scorers';

function formatPercent(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(0)}%`;
}

function formatMinutes(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(0)} min`;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function useFactoryRuns(): { runs: FactoryRun[]; loading: boolean; error: string | null } {
  const [runs, setRuns] = useState<FactoryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getDocs(query(collection(db, 'factory_runs'), orderBy('startedAt', 'desc'), limit(MAX_RUNS)))
      .then((snap) => {
        if (cancelled) return;
        setRuns(snap.docs.map((d) => ({ runId: d.id, ...d.data() } as FactoryRun)));
      })
      .catch((err) => {
        console.error('Error fetching factory_runs:', err);
        if (!cancelled) setError('Could not load factory run data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { runs, loading, error };
}

function FactoryDashboard() {
  const { runs, loading, error } = useFactoryRuns();
  const [tab, setTab] = useState<Tab>('productivity');

  const productivity = useMemo(() => computeProductivityStats(runs), [runs]);
  const spending = useMemo(() => computeSpendingStats(runs), [runs]);
  const scorerRates = useMemo(() => computeScorerRates(runs), [runs]);
  const failures = useMemo(() => failingRuns(runs), [runs]);

  return (
    <div className="factory-page">
      <h1>Software Factory</h1>
      <p className="factory-subtitle">
        How the weekly automated factory run (see{' '}
        <code>software-factory/README.md</code>) is actually doing, across the last{' '}
        {runs.length} recorded run{runs.length === 1 ? '' : 's'}.
      </p>

      <div className="factory-tabs">
        <button
          className={`factory-tab${tab === 'productivity' ? ' active' : ''}`}
          onClick={() => setTab('productivity')}
        >
          Productivity
        </button>
        <button
          className={`factory-tab${tab === 'spending' ? ' active' : ''}`}
          onClick={() => setTab('spending')}
        >
          Spending
        </button>
        <button
          className={`factory-tab${tab === 'scorers' ? ' active' : ''}`}
          onClick={() => setTab('scorers')}
        >
          Scorers
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p>{error}</p>
      ) : runs.length === 0 ? (
        <p>No runs recorded yet.</p>
      ) : (
        <>
          {tab === 'productivity' && (
            <>
              <StatTileRow>
                <StatTile
                  label="PRs opened"
                  value={String(productivity.prsOpened)}
                  caption={`of ${productivity.totalRuns} runs`}
                />
                <StatTile
                  label="PRs merged"
                  value={String(productivity.prsMerged)}
                  caption={
                    productivity.prsOpened === 0
                      ? '—'
                      : `${formatPercent(productivity.prsMerged / productivity.prsOpened)} of opened`
                  }
                />
                <StatTile
                  label="Needed human review"
                  value={formatPercent(productivity.shareNeedingHumanReview)}
                  caption="of runs with a known outcome"
                />
              </StatTileRow>
              <StatTileRow>
                <StatTile
                  label="Kickoff → PR"
                  value={formatMinutes(productivity.avgKickoffToPrMinutes)}
                  caption="average cycle time"
                />
                <StatTile
                  label="PR → merge"
                  value={formatMinutes(productivity.avgPrToMergeMinutes)}
                  caption="average cycle time"
                />
                <StatTile
                  label="Human interactions"
                  value={
                    productivity.avgHumanInteractions == null
                      ? '—'
                      : productivity.avgHumanInteractions.toFixed(1)
                  }
                  caption="average per PR"
                />
              </StatTileRow>
            </>
          )}

          {tab === 'spending' && (
            <>
              <StatTileRow>
                <StatTile
                  label="Compute cost"
                  value={formatUsd(spending.totalComputeCostUsd)}
                  caption={`across ${spending.runsWithCostData} run(s) with cost data`}
                />
                <StatTile
                  label="Monthly budget cap"
                  value={formatUsd(spending.budgetCapUsd)}
                  caption="see gcp/README.md"
                />
              </StatTileRow>
              <p className="factory-note">
                This is compute cost only — the VM's runtime × an hourly rate. Token usage isn't
                shown because headless Claude Code billed against a subscription doesn't report
                per-run cost the way a metered API key would.
              </p>
            </>
          )}

          {tab === 'scorers' && (
            <>
              <div className="factory-table-container">
                <table className="factory-table">
                  <thead>
                    <tr>
                      <th>Scorer</th>
                      <th>Pass rate</th>
                      <th>Graded runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorerRates.map((s) => (
                      <tr key={s.scorer}>
                        <td>{s.label}</td>
                        <td>{formatPercent(s.passRate)}</td>
                        <td>{s.graded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {failures.length > 0 && (
                <>
                  <h3 className="section-title">Runs with a failing score</h3>
                  <div className="factory-table-container">
                    <table className="factory-table">
                      <thead>
                        <tr>
                          <th>Backlog item</th>
                          <th>PR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {failures.map((r) => (
                          <tr key={r.runId}>
                            <td>{r.backlogItem}</td>
                            <td>
                              {r.prUrl ? (
                                <a href={r.prUrl} target="_blank" rel="noreferrer">
                                  #{r.prNumber}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default FactoryDashboard;
