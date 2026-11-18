export function getNflTeamLogo(team: string): string | null {
  try {
    return require(`../logosnfl/${team}.png`);
  } catch {
    return null;
  }
}

export function getMlbTeamLogo(team: string): string | null {
  try {
    return require(`../logosmlb/${team}.png`);
  } catch {
    return null;
  }
}
