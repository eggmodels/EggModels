// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// A match is only renderable if both player names are non-empty strings;
// a single malformed record from the pipeline must not take down the whole page.
const sanitizeMatches = (matches) => {
  if (!Array.isArray(matches)) return [];
  return matches.filter(
    (match) =>
      match &&
      typeof match["Player 1"] === "string" &&
      match["Player 1"].trim() !== "" &&
      typeof match["Player 2"] === "string" &&
      match["Player 2"].trim() !== ""
  );
};

const Tennis = () => {
  const [matches, setMatches] = useState([]);
  const [latestDateStr, setLatestDateStr] = useState(null);

  useEffect(() => {
    const fetchFromFirestore = async () => {
      const docRef = doc(db, "tennis_odds", "current");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        setLatestDateStr(isNaN(timestamp.getTime()) ? null : timestamp.toLocaleDateString("en-CA"));
        setMatches(sanitizeMatches(data.matches));
      }
    };

    const fetchLocalData = async () => {
      const res = await fetch('/tennis_data.json');
      if (res.ok) {
        const data = await res.json();
        const ts = data.timestamp ? new Date(data.timestamp) : new Date();
        setLatestDateStr(isNaN(ts.getTime()) ? null : ts.toLocaleDateString("en-CA"));
        setMatches(sanitizeMatches(data.matches));
      }
    };

    const fetchLatestMatches = async () => {
      try {
        // In development, prefer local data file if available
        if (process.env.NODE_ENV === 'development') {
          try {
            await fetchLocalData();
            return;
          } catch (e) {
            // Fall through to Firestore
          }
        }
        await fetchFromFirestore();
      } catch (err) {
        console.error("Error fetching tennis data:", err);
        // Try local fallback
        try { await fetchLocalData(); } catch (e) { /* no fallback */ }
      }
    };

    fetchLatestMatches();
  }, []);

  const capitalizeFullName = (name) => {
    if (typeof name !== "string" || name.trim() === "") return "Unknown";
    return name
      .split(" ")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  };

  const formatProbability = (value) => {
    const num = Number(value);
    return isNaN(num) ? "—" : `${(num * 100).toFixed(1)}%`;
  };

  const renderFlag = (countryCode) => {
    if (!countryCode) return null;
    return (
      <img
        src={`https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`}
        alt={countryCode}
        style={{ width: 24, height: 18, objectFit: 'cover', borderRadius: 2 }}
      />
    );
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
                      {renderFlag(match["Player 1 Country"])}
                      {capitalizeFullName(match["Player 1"])}
                    </td>
                    <td className="probability">
                      {formatProbability(match["Player 1 Win Probability"])}
                    </td>
                  </tr>
                  <tr>
                    <td className="team-name">
                      {renderFlag(match["Player 2 Country"])}
                      {capitalizeFullName(match["Player 2"])}
                    </td>
                    <td className="probability">
                      {formatProbability(match["Player 2 Win Probability"])}
                    </td>
                  </tr>
                  {match["tournament"] && (
                    <tr>
                      <td colSpan="2" style={{ textAlign: "center", fontSize: "0.85em", color: "#888", paddingTop: 4 }}>
                        {match["tournament"]}
                        {match["surface"] && ` · ${match["surface"]}`}
                      </td>
                    </tr>
                  )}
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
