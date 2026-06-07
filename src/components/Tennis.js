import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

const Tennis = ({ activeTab }) => {
  const [matches, setMatches] = useState([]);
  const [latestDateStr, setLatestDateStr] = useState(null);

  useEffect(() => {
    const fetchLatestMatches = async () => {
      try {
        const docRef = doc(db, "tennis_odds", "current");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          const dayStr = timestamp.toLocaleDateString("en-CA");
          setLatestDateStr(dayStr);
          setMatches(data.matches || []);
        } else {
          console.warn("No tennis odds data found in Firestore");
          setMatches([]);
        }
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
          Disclaimer: Win probabilities are based on Elo ratings and may not reflect actual market odds.
        </h4>
      </div>

      <div className="games-container">
        {matches.length === 0 ? (
          <p>No tennis matches available</p>
        ) : (
          matches.map((match, index) => (
            <div key={index} className="game-box">
              <table className="game-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Win Probability</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="team-name">
                      {capitalizeFullName(match["Player 1"])}
                    </td>
                    <td className="probability">
                      {(Number(match["Player 1 Win Probability"]) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="team-name">
                      {capitalizeFullName(match["Player 2"])}
                    </td>
                    <td className="probability">
                      {(Number(match["Player 2 Win Probability"]) * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Tennis;
