export function getNflTeamLogo(team: string): string | null {
  try {
    return require(`../logosnfl/${team}.png`);
  } catch {
    return null;
  }
}
