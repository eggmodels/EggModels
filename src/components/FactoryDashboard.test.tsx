import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { getDocs } from 'firebase/firestore';
import FactoryDashboard from './FactoryDashboard';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
}));
jest.mock('../firebase', () => ({ db: {} }));

const mockedGetDocs = getDocs as jest.Mock;

function makeDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

beforeEach(() => {
  mockedGetDocs.mockReset();
});

it('shows a no-runs message when the collection is empty', async () => {
  mockedGetDocs.mockResolvedValue({ docs: [] });

  render(<FactoryDashboard />);

  expect(await screen.findByText('No runs recorded yet.')).toBeInTheDocument();
});

it('renders productivity stats and switches to the scorers tab', async () => {
  mockedGetDocs.mockResolvedValue({
    docs: [
      makeDoc('run-1', {
        backlogItem: 'Example',
        branch: 'factory/example-1',
        implementer: 'claude-code',
        status: 'completed',
        prNumber: 60,
        prUrl: 'https://github.com/eggmodels/EggModels/pull/60',
        merged: true,
        neededHumanReview: false,
        cycleTimeKickoffToPrMinutes: 12,
        scores: { stayedInScope: true, noRedundantTests: false },
      }),
    ],
  });

  render(<FactoryDashboard />);

  expect(await screen.findByText('PRs opened')).toBeInTheDocument();
  expect(screen.getByText('of 1 runs')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Scorers'));

  expect(await screen.findByText('No redundant tests')).toBeInTheDocument();
  expect(screen.getByText('Example')).toBeInTheDocument();
});
