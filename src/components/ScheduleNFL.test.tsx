import React from 'react';
import { render, screen } from '@testing-library/react';
import ScheduleNFL from './ScheduleNFL';
import { useSeason } from '../hooks/useSeason';
import type { NflGame } from '../types/nfl';

// Mocking the hook (rather than rendering it for real) avoids pulling
// react-router-dom into this test file — importing it directly fails to
// resolve under this project's react-scripts v5 Jest setup (see
// Parlay.test.tsx for the same workaround).
jest.mock('../hooks/useSeason', () => ({ useSeason: jest.fn() }));
const mockedUseSeason = useSeason as jest.Mock;

jest.mock('../utils/teamLogo', () => ({
  getNflTeamLogo: () => null,
}));

const game = (overrides: Partial<NflGame> = {}): NflGame =>
  ({
    Week: 1,
    Day: 'Sunday',
    Date: '2026-09-07',
    Time: '1:00',
    Home: 'KC',
    Away: 'SF',
    ScoreH: null,
    ScoreA: null,
    ElopreH: 1500,
    ElopreA: 1500,
    ElopostH: null,
    ElopostA: null,
    probH: 0.6,
    probA: 0.4,
    eloSpread: -2.5,
    id: '1_SF_KC',
    ...overrides,
  }) as NflGame;

beforeEach(() => {
  mockedUseSeason.mockReset();
  global.fetch = jest.fn().mockRejectedValue(new Error('not needed for this test'));
});

it('renders the schedule immediately instead of a loading state, since the hook never blocks on the live fetch', () => {
  mockedUseSeason.mockReturnValue({
    season: 2026,
    setSeason: jest.fn(),
    games: [game()],
    loading: false,
    stale: false,
  });

  render(<ScheduleNFL />);

  expect(screen.queryByText(/Loading NFL data/i)).not.toBeInTheDocument();
  // "KC"/"SF" also appear in the logo-fallback initials, so there are two of each.
  expect(screen.getAllByText('KC').length).toBeGreaterThan(0);
  expect(screen.getAllByText('SF').length).toBeGreaterThan(0);
});

it('shows the stale-data banner when the live fetch has failed', () => {
  mockedUseSeason.mockReturnValue({
    season: 2026,
    setSeason: jest.fn(),
    games: [game()],
    loading: false,
    stale: true,
  });

  render(<ScheduleNFL />);

  expect(screen.getByText(/Showing last saved data/i)).toBeInTheDocument();
});

it('does not show the stale-data banner when the live data is current', () => {
  mockedUseSeason.mockReturnValue({
    season: 2026,
    setSeason: jest.fn(),
    games: [game()],
    loading: false,
    stale: false,
  });

  render(<ScheduleNFL />);

  expect(screen.queryByText(/Showing last saved data/i)).not.toBeInTheDocument();
});
