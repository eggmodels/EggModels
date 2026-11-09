import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../Performance.css';
import { LIVE_SEASON, SEASONS, seasonData } from '../data/nflSeasons';
import { parseLiveSeasonDoc, withTimeout } from '../utils/liveSeason';
import {
  computeNflPerformance,
  computeNflPerformanceBySeason,
  computeNflPerformanceBySpreadBucket,
} from '../utils/performance';
import type { PerformanceStats } from '../utils/performance';
import { StatTile, StatTileRow } from './shared/StatTile';
import type { NflGame } from '../types/nfl';

const LIVE_FETCH_TIMEOUT_MS = 10000;

// The bundled nfl_2026 JSON is a build-time snapshot that's only regenerated
// occasionally, so most of the live season's completed games aren't in it
// yet (see useSeason) — fetch the live Firestore doc so the current season
// grades against every game played so far, not just the handful baked into
// the last snapshot.
function useLiveSeasonGames(): NflGame[] | null {
  const [liveGames, setLiveGames] = useState<NflGame[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    withTimeout(getDoc(doc(db, 'nfl_2026', 'current')), LIVE_FETCH_TIMEOUT_MS)
      .then((docSnap) => {
        if (cancelled) return;
        const matches = parseLiveSeasonDoc(docSnap.exists(), docSnap.exists() ? docSnap.data() : undefined);
        if (matches) setLiveGames(matches);
      })
      .catch((err) => {
        console.error('Error fetching live NFL data for performance grading:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return liveGames;
}

function formatPercent(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function formatPoints(value: number | null): string {
  return value == null ? '—' : value.toFixed(2);
}

function Performance() {
  const liveGames = useLiveSeasonGames();

  // Prefer the live Firestore data for the season still being played — the
  // bundled JSON is a build-time snapshot that lags behind actual results.
  const seasonGames = useMemo(
    () => ({ ...seasonData, [LIVE_SEASON]: liveGames ?? seasonData[LIVE_SEASON] }),
    [liveGames],
  );

  const allGames = useMemo(
    () => SEASONS.flatMap((season) => seasonGames[season]),
    [seasonGames],
  );

  const overall = useMemo<PerformanceStats>(() => computeNflPerformance(allGames), [allGames]);

  const bySeason = useMemo(
    () => computeNflPerformanceBySeason(seasonGames, SEASONS),
    [seasonGames],
  );

  const bySpread = useMemo(() => computeNflPerformanceBySpreadBucket(allGames), [allGames]);

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
          <StatTileRow>
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
          </StatTileRow>

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

          <h3 className="section-title">By Point Spread</h3>
          <div className="performance-table-container">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Favorite By</th>
                  <th>Games Graded</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {bySpread.map(({ bucket, gamesGraded, accuracy }) => (
                  <tr key={bucket.label}>
                    <td>{bucket.label} pts</td>
                    <td>{gamesGraded}</td>
                    <td>{formatPercent(accuracy)}</td>
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
