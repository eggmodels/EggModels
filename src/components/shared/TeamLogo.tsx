import React from 'react';
import '../../App.css';

interface TeamLogoProps {
  team: string;
  getLogo: (team: string) => string | null;
}

// Falls back to the team's initials when no logo image exists for it,
// instead of letting a broken <img> render.
function TeamLogo({ team, getLogo }: TeamLogoProps) {
  const logoSrc = getLogo(team);
  if (logoSrc) {
    return <img className="team-logo" src={logoSrc} alt={`${team} Logo`} />;
  }
  const initials = team.substring(0, 2).toUpperCase();
  return (
    <div
      className="team-logo"
      style={{
        backgroundColor: '#ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 'bold',
      }}
      title={team}
    >
      {initials}
    </div>
  );
}

export default TeamLogo;
