import React from 'react';
import { SEASONS } from '../data/nflSeasons';
import type { Season } from '../types/nfl';

interface Props {
  season: Season;
  onSeasonChange: (season: Season) => void;
}

function SeasonSelector({ season, onSeasonChange }: Props) {
  return (
    <select
      value={season}
      onChange={(e) => onSeasonChange(Number(e.target.value) as Season)}
      className="season-select"
      aria-label="Select NFL season"
    >
      {[...SEASONS].reverse().map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export default SeasonSelector;
