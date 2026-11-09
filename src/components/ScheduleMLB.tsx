// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../css/ScheduleMLB.css';
import { formatWinProbability } from '../utils/format';
import { useMlbSchedule } from '../hooks/useMlbSchedule';
import { getMlbTeamLogo } from '../utils/teamLogo';
import TeamLogo from './shared/TeamLogo';
import StaleDataBanner from './shared/StaleDataBanner';

// The bundled fallback dataset is a fixed historical season (2024), so
// defaulting the picker to "today" would show an empty page whenever live
// data isn't available. Default to the earliest date in whatever data is
// actually loaded instead.
const getDefaultDate = (games) => {
    if (games.length === 0) return new Date();
    return games.reduce(
        (min, g) => (new Date(g.date) < min ? new Date(g.date) : min),
        new Date(games[0].date)
    );
};

const ScheduleMLB = ({ activeTab }: { activeTab?: unknown } = {}) => {
    const { games: mlbScheduleData, loading, stale } = useMlbSchedule();
    const [scheduleData, setScheduleData] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => getDefaultDate(mlbScheduleData));
    const [calendarVisible, setCalendarVisible] = useState(false);
    const defaultDateForCurrentData = useMemo(() => getDefaultDate(mlbScheduleData), [mlbScheduleData]);

    useEffect(() => {
        const dataWithParsedDates = mlbScheduleData.map(game => ({
            ...game,
            parsedDate: new Date(game.date)
        }));
        setScheduleData(dataWithParsedDates);
        setSelectedDate(defaultDateForCurrentData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, mlbScheduleData]);

    const handleCalendarVisibility = () => {
        setCalendarVisible(!calendarVisible);
    };

    return (
        <div className="mlb-schedule">
            {stale && !loading && (
                <StaleDataBanner message="Live 2026 data isn't available yet — showing the 2024 season." />
            )}
            <div className="week-selector">
                <button onClick={handleCalendarVisibility}>
                    Calendar
                </button>
                {calendarVisible && (
                    <DatePicker
                        selected={selectedDate}
                        onChange={(date) => {
                            setSelectedDate(date);
                            setCalendarVisible(false);
                        }}
                        inline
                    />
                )}
            </div>

            <div className="games-container">
                {scheduleData
                    .filter((game) => game.parsedDate.toDateString() === selectedDate.toDateString())
                    .map((game, index) => (
                        <div key={index} className="game-box">
                            <table className="game-table">
                                <thead>
                                    <tr>
                                        <th>Teams</th>
                                        <th>Win %</th>
                                        <th>Spread</th>
                                        <th>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className='team-name'>
                                            <TeamLogo team={game.team2} getLogo={getMlbTeamLogo} />
                                            {game.team2}
                                        </td>
                                        <td>{formatWinProbability(game.elo_prob2)}</td>
                                        <td></td>
                                        <td className='score'>{game.score2 ?? ''}</td>
                                    </tr>
                                    <tr>
                                        <td className='team-name'>
                                            <TeamLogo team={game.team1} getLogo={getMlbTeamLogo} />
                                            {game.team1}
                                        </td>
                                        <td>{formatWinProbability(game.elo_prob1)}</td>
                                        <td></td>
                                        <td className='score'>{game.score1 ?? ''}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ))
                }
            </div>
        </div>
    );
}

export default ScheduleMLB;
