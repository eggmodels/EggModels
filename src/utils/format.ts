export function formatWinProbability(prob: number | null): string | null {
  if (prob == null) return null;
  return `${(prob * 100).toFixed(2)}%`;
}

export function formatSpread(spread: number | null): string | null {
  if (spread == null) return null;
  const rounded = Math.round(Math.abs(spread) * 2) / 2;
  const sign = spread >= 0 ? '+' : '-';
  return `${sign}${rounded}`;
}
