import React, { useMemo } from 'react';
import '../Performance.css';
import { SEASONS, seasonData } from '../data/nflSeasons';
import { computeNflPerformance, computeNflPerformanceBySeason } from '../utils/performance';
import type { PerformanceStats } from '../utils/performance';

function formatPercent(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function formatPoints(value: number | null): string {
  return value == null ? '—' : value.toFixed(2);
}

function StatTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-caption">{caption}</div>
    </div>
  );
}

function Performance() {
  const overall = useMemo<PerformanceStats>(
    () => computeNflPerformance(SEASONS.flatMap((season) => seasonData[season])),
    [],
  );

  const bySeason = useMemo(
    () => computeNflPerformanceBySeason(seasonData, SEASONS),
    [],
  );

  return (
    <div className="performance-page">
      <h1>Performance</h1>
      <p className="performance-subtitle">
        How the NFL Elo model's picks have held up against what actually happened, across every
        graded game in eggmodels' recorded history.
      </p>

      {overall.gamesGraded === 0 ? (
        <p>No completed games to grade yet.</p>
      ) : (
        <>
          <div className="stat-tile-row">
            <StatTile
              label="Straight-up accuracy"
              value={formatPercent(overall.accuracy)}
              caption={`${overall.picksCorrect} of ${overall.gamesGraded} games`}
            />
            <StatTile
              label="Brier score"
              value={formatPoints(overall.brierScore)}
              caption="lower is better (0 = perfect)"
            />
            <StatTile
              label="Spread error (MAE)"
              value={overall.spreadMae == null ? '—' : `${overall.spreadMae.toFixed(1)} pts`}
              caption={`${overall.spreadGraded} games with a posted spread`}
            />
          </div>

          <h3 className="section-title">By Season</h3>
          <div className="performance-table-container">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Games Graded</th>
                  <th>Accuracy</th>
                  <th>Brier Score</th>
                  <th>Spread MAE</th>
                </tr>
              </thead>
              <tbody>
                {bySeason
                  .filter((row) => row.stats.gamesGraded > 0)
                  .map(({ season, stats }) => (
                    <tr key={season}>
                      <td>{season}</td>
                      <td>{stats.gamesGraded}</td>
                      <td>{formatPercent(stats.accuracy)}</td>
                      <td>{formatPoints(stats.brierScore)}</td>
                      <td>{stats.spreadMae == null ? '—' : `${stats.spreadMae.toFixed(1)} pts`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="performance-note">
        Tennis and MLB aren't included yet — eggmodels only keeps the latest tennis odds snapshot
        (not a history of resolved matches), so there's nothing to grade them against yet.
      </p>
    </div>
  );
}

export default Performance;
