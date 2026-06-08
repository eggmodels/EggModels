// @ts-nocheck
import React, { useEffect, useState } from 'react';
import mlbScheduleData from '../python/mlb_2024/csv/mlb-elo-2024.json';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../css/ScheduleMLB.css';

const ScheduleMLB = ({ activeTab }) => {
    const [scheduleData, setScheduleData] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [calendarVisible, setCalendarVisible] = useState(false);

    useEffect(() => {
        const dataWithParsedDates = mlbScheduleData.map(game => ({
            ...game,
            parsedDate: new Date(game.date)
        }));
        setScheduleData(dataWithParsedDates);
    }, [activeTab]);

    const handleCalendarVisibility = () => {
        setCalendarVisible(!calendarVisible);
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('default', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    };

    const calculateWinProbability = (prob) => {
        if (prob == null) {
            return null;
        }
        return `${(prob * 100).toFixed(2)}%`;
    };

    return (
        <div className="mlb-schedule">
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
                                            <img className='team-logo' src={require(`../logosmlb/${game.team2}.png`)} alt={`${game.team2} Logo`} />
                                            {game.team2}
                                        </td>
                                        <td>{calculateWinProbability(game.elo_prob2)}</td>
                                        <td></td>
                                        <td className='score'>{game.score2 ?? ''}</td>
                                    </tr>
                                    <tr>
                                        <td className='team-name'>
                                            <img className='team-logo' src={require(`../logosmlb/${game.team1}.png`)} alt={`${game.team1} Logo`} />
                                            {game.team1}
                                        </td>
                                        <td>{calculateWinProbability(game.elo_prob1)}</td>
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
