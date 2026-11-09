import React from 'react';
import { render, screen } from '@testing-library/react';
import { getDoc } from 'firebase/firestore';
import Performance from './Performance';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));
jest.mock('../firebase', () => ({ db: {} }));

const mockedGetDoc = getDoc as jest.Mock;

beforeEach(() => {
  mockedGetDoc.mockReset();
  // No live doc yet — falls back to the bundled season JSON, which is what
  // the util tests already cover in detail.
  mockedGetDoc.mockResolvedValue({ exists: () => false });
});

it('renders stat tiles and the by-season/by-spread tables from the bundled data', async () => {
  render(<Performance />);

  expect(await screen.findByText('Performance')).toBeInTheDocument();
  expect(screen.getByText('Straight-up accuracy')).toBeInTheDocument();
  expect(screen.getByText('By Season')).toBeInTheDocument();
  expect(screen.getByText('By Point Spread')).toBeInTheDocument();
});
