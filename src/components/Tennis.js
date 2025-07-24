import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

const Tennis = ({ activeTab }) => {
  const [eventMatchMap, setEventMatchMap] = useState({});
  const [latestDateStr, setLatestDateStr] = useState(null);

  useEffect(() => {
    const fetchLatestMatches = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "model_outputs"));
        const allMatches = querySnapshot.docs.map(doc => doc.data());

        const dateMatchMap = {};
        allMatches.forEach(match => {
          const dateObj = match.uploaded_at.toDate();
          const dayStr = dateObj.toLocaleDateString("en-CA");
          if (!dateMatchMap[dayStr]) dateMatchMap[dayStr] = [];
          dateMatchMap[dayStr].push(match);
        });

        const allDates = Object.keys(dateMatchMap);
        const latestStr = allDates.sort((a, b) => new Date(b) - new Date(a))[0];
        const latestMatches = dateMatchMap[latestStr] || [];
        setLatestDateStr(latestStr);

        const map = {};
        latestMatches.forEach(match => {
          const eventId = match.event_id;
          if (!map[eventId]) map[eventId] = [];
          if (map[eventId].length < 2) map[eventId].push(match);
        });

        setEventMatchMap(map);
      } catch (err) {
        console.error("❌ Error fetching tennis data:", err);
      }
    };

    fetchLatestMatches();
  }, [activeTab]);

  const capitalizeFullName = (name) => {
    return name
      .split(" ")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  };

  const countryToEmoji = (countryName) => {
    const code = countries.getAlpha2Code(countryName, 'en');
    if (!code) return '';
    return [...code.toUpperCase()].map(c => String.fromCodePoint(127397 + c.charCodeAt())).join('');
  };

  return (
    <div className="nfl-schedule">
      <div className="week-selector">
        <label>Latest Matches{latestDateStr ? ` – ${latestDateStr}` : ' – Loading...'}</label>
      </div>
      <div className="markdown-container">
        <h4>
          Disclaimer: The sum of breakeven probabilities may not always sum to 100% (or breakeven odds sum to 0). 
          This is by design and baked into the parameters of the model as a built-in margin of safety.
        </h4>
      </div>

      <div className="games-container">
        {Object.entries(eventMatchMap).map(([eventId, players], index) => {
          if (players.length < 2) return null;
          const [p1, p2] = players;
          return (
            <div key={eventId} className="game-box">
              <table className="game-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Break Even Odds</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="team-name">
                      {countryToEmoji(p1.player_country)} {capitalizeFullName(p1.Player)}
                    </td>
                    <td className="probability">
                      {Number(p1["Breakeven Odds"]) > 0
                        ? `+${Number(p1["Breakeven Odds"])}`
                        : Number(p1["Breakeven Odds"])}
                    </td>
                  </tr>
                  <tr>
                    <td className="team-name">
                      {countryToEmoji(p2.player_country)} {capitalizeFullName(p2.Player)}
                    </td>
                    <td className="probability">
                      {Number(p2["Breakeven Odds"]) > 0
                        ? `+${Number(p2["Breakeven Odds"])}`
                        : Number(p2["Breakeven Odds"])}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tennis;
