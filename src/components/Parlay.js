import React, { useState, useEffect } from 'react';
import '../Parlay.css';
import nflScheduleData from '../python/nfl_2025/nflModel2025.json';

// Moved outside to avoid useEffect dependency warning
const calculateParlayOdds = (selectedWinners, week, schedule) => {
    let odds = 1;

    for (let index = 0; index < selectedWinners.length; index++) {
        const selection = selectedWinners[index];
        if (selection) {
            const { team } = selection;
            const game = schedule.find(
                (game) => game.Week === week && (team === game.Away || team === game.Home)
            );
            if (game) {
                odds *= team === game.Away ? game.probA : game.probH;
            }
        }
    }

    if (odds <= 0.5) {
        odds = (100 / odds) - 100;
    } else if (odds === 1) {
        return null;
    } else {
        odds = -(odds * 100) / (1 - odds);
    }

    const sign = odds >= 0 ? '+' : '-';
    return sign === '-' ? Math.round(odds) : `${sign}${Math.round(odds)}`;
};

const Parlay = ({ activeTab }) => {
    const [selectedWinners, setSelectedWinners] = useState([]);
    const [week] = useState(15); // Hardcoded target week

    const handleWinnerSelection = (gameId, team, index) => {
        setSelectedWinners((prevSelectedWinners) => {
            const updatedWinners = [...prevSelectedWinners];
            updatedWinners[index] = updatedWinners[index]?.team === team ? null : { gameId, team };
            return updatedWinners;
        });
    };

    useEffect(() => {
        const odds = calculateParlayOdds(selectedWinners, week, nflScheduleData);
        console.log(odds);
    }, [selectedWinners, week]);

    return (
        <div className='parley'>
            <h1>Week {week}</h1>
            <h3>Selected Winners:</h3>
            <ul className='selected-winners'>
                {selectedWinners
                    .filter(selection => selection)
                    .map((selection, index) => (
                        <li key={index}>
                            {selection.team}
                        </li>
                    ))}
            </ul>
            <h3>Fair Odds: {calculateParlayOdds(selectedWinners, week, nflScheduleData)}</h3>
            <div className='parley-container'>
                <table className="games-table">
                    <tbody>
                        {nflScheduleData
                            .filter((game) => game.Week === week)
                            .map((game, index) => (
                                <tr key={index}>
                                    <td className="left-column">
                                        <input
                                            type="checkbox"
                                            value={game.Away}
                                            onChange={() => handleWinnerSelection(game.id, game.Away, index)}
                                            checked={
                                                selectedWinners[index] &&
                                                selectedWinners[index].gameId === game.id &&
                                                selectedWinners[index].team === game.Away
                                            }
                                        />
                                        <img
                                            className="team-logo"
                                            src={require(`../logosnfl/${game.Away}.png`)}
                                            alt={`${game.Away} Logo`}
                                        />
                                        {game.Away}
                                    </td>
                                    <td className="separator">@</td>
                                    <td className="right-column">
                                        <img
                                            className="team-logo"
                                            src={require(`../logosnfl/${game.Home}.png`)}
                                            alt={`${game.Home} Logo`}
                                        />
                                        {game.Home}
                                        <input
                                            type="checkbox"
                                            value={game.Home}
                                            onChange={() => handleWinnerSelection(game.id, game.Home, index)}
                                            checked={
                                                selectedWinners[index] &&
                                                selectedWinners[index].gameId === game.id &&
                                                selectedWinners[index].team === game.Home
                                            }
                                        />
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Parlay;