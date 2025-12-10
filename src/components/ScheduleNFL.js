import React, { useEffect, useState } from 'react';
import nflScheduleData from '../python/nfl_2025/nflModel2025.json';
import '../App.css';

const ScheduleNFL = ({ activeTab }) => {
    const [scheduleData, setScheduleData] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState(15);

    useEffect(() => {
        // Use the imported JSON data directly
        setScheduleData(nflScheduleData);
    }, [activeTab]);

    const handleWeekChange = (event) => {
        setSelectedWeek(parseInt(event.target.value));
    };

    const uniqueWeeks = Array.from(new Set(scheduleData.map((game) => game.Week)))
      .filter((week) => week !== 'Week' && parseInt(week) >= 1);

    // Function to calculate and format the win probability
    const calculateWinProbability = (prob) => {
        if (prob == null) {
          return null
        }
        return `${(prob * 100).toFixed(2)}%`;
    };

    const rounding = (spread) => {
      if (spread == null) {
        return null;
      } else {
        // Round the spread
        const roundedSpread = Math.round(Math.abs(spread) * 2) / 2;
    
        // Determine the sign (plus or minus)
        const sign = spread >= 0 ? '+' : '-';
    
        // Combine the sign and the rounded spread
        return `${sign}${roundedSpread}`;
      }
    };    

    return (
        <div className="nfl-schedule">
          <div className="week-selector">
            <label>Week&nbsp;</label> 
            {<select onChange={handleWeekChange} value={selectedWeek}>
              {uniqueWeeks.map((week, index) => (
                <option key={index} value={week}>
                  {week}
                </option>
              ))}
            </select>}
            <label>&nbsp;Projections</label> 
          </div>

          <div className="games-container">
            {scheduleData
              .filter((game) => game.Week === selectedWeek) // Change 2 to selectedWeek variable
              .map((game, index) => (
                <div key={index} className="game-box">
                  <table className="game-table">
                    <tr>
                      <th>Teams</th>
                      <th>Win%</th>
                      <th>Spread</th>
                      <th>Score</th>
                    </tr>
                      
                    <tr>
                      <td className='team-name'>
                        <img className='team-logo' src={require(`../logosnfl/${game.Away}.png`)} alt={`${game.Away} Logo`} />
                        {game.Away} 
                      </td>
                      <td>{calculateWinProbability(game.probA)}</td>
                      <td></td>
                      <td className='score'>{game.ScoreA}</td>
                    </tr>

                    <tr>
                      <td className='team-name'>
                      <img className='team-logo' src={require(`../logosnfl/${game.Home}.png`)} alt={`${game.Home} Logo`} />
                        {game.Home}
                      </td>
                      <td>{calculateWinProbability(game.probH)}</td>
                      <td>{rounding(game.eloSpread)}</td>
                      <td className='score'>{game.ScoreH}</td>
                    </tr>

                  </table>
                  
                </div>
              ))
            }
          </div>
      </div>
    )
}

export default ScheduleNFL;