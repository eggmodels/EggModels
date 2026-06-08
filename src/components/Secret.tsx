// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import '../App.css';

const Secret = () => {
  const [groupedData, setGroupedData] = useState([]);
  const [recentClosedBets, setRecentClosedBets] = useState([]);
  const [currentOpenBets, setCurrentOpenBets] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Starting...');
  const [profitLast24, setProfitLast24] = useState(0);
  const [error, setError] = useState(null);

  const fetchLineIdNameMapFromFirestore = async () => {
    const snapshot = await getDocs(collection(db, "model_outputs"));
    const allDocs = snapshot.docs.map(doc => doc.data());

    const map = {};
    allDocs.forEach(doc => {
      const lineId = doc["Player line_id"];
      const playerName = doc["match_name"];

      if (lineId && playerName) {
        map[lineId.trim()] = [playerName, doc['Player']];
      }
    });

    return map;
  };

  useEffect(() => {
    const runProcess = async () => {
      try {
        setStatusMessage("Fetching wagers...");
        const res = await fetch('https://us-central1-egg-models.cloudfunctions.net/getBets');
        if (!res.ok) throw new Error("Server returned error");
        const data = await res.json();
        const wagers = data.data?.wagers || [];

        setStatusMessage("Fetching names from Firestore...");
        const lineIdMap = await fetchLineIdNameMapFromFirestore();

        const enrichedWagers = wagers.map(w => {
          const namePlayer = lineIdMap[w.line_id] || [null, null];
          return {
            ...w,
            name: namePlayer[0],
            player: namePlayer[1],
          };
        });

        // Status of Open Bets
        const preMatch = enrichedWagers.filter(w =>
          w.winning_status === "tbd" &&
          w.status !== "canceled" &&
          w.status !== "wiped"
        );

        const groupMap = {};
        preMatch.forEach(w => {
          if (!groupMap[w.matching_status]) {
            groupMap[w.matching_status] = {
              matched_dlls: 0,
              allocated_dlls: 0,
              count: 0
            };
          }
          groupMap[w.matching_status].matched_dlls += w.matched_stake || 0;
          groupMap[w.matching_status].allocated_dlls += w.original_stake || 0;
          groupMap[w.matching_status].count += 1;
        });

        const grouped = Object.keys(groupMap).map(status => ({
          matching_status: status,
          ...groupMap[status]
        }));

        const fullyMatched = grouped.find(g => g.matching_status === "fully_matched");
        const partiallyMatched = grouped.find(g => g.matching_status === "partially_matched");
        const unmatched = grouped.find(g => g.matching_status === "unmatched");

        const newData = [];

        if (fullyMatched) {
          newData.push({
            matching_status: "fully_matched",
            dlls: fullyMatched.matched_dlls,
            count: fullyMatched.count
          });
        }

        if (partiallyMatched) {
          newData.push({
            matching_status: "partially_matched",
            dlls: partiallyMatched.matched_dlls,
            count: partiallyMatched.count
          });
          newData.push({
            matching_status: "partially_unmatched",
            dlls: partiallyMatched.allocated_dlls - partiallyMatched.matched_dlls,
            count: partiallyMatched.count
          });
        }

        if (unmatched) {
          newData.push({
            matching_status: "unmatched",
            dlls: unmatched.allocated_dlls,
            count: unmatched.count
          });
        }

        const totalDlls = newData.reduce((sum, r) => sum + r.dlls, 0);
        newData.forEach(r => {
          r["% dlls"] = totalDlls > 0 ? ((r.dlls / totalDlls) * 100).toFixed(1) : '0.0';
        });

        setGroupedData(newData);

        // Closed Bets in Last 24h
        const cutoffTime = new Date(Date.now() - 24 * 3600 * 1000);
        const closed = enrichedWagers
          .filter(w => w.winning_status !== "tbd" && w.settled_at && new Date(w.settled_at) >= cutoffTime)
          .sort((a, b) => (b.profit || 0) - (a.profit || 0));

        const profitSum = closed.reduce((sum, w) => sum + (w.profit || 0), 0);
        setRecentClosedBets(closed);
        setProfitLast24(profitSum);

        // Currently Open Bets
        const open = enrichedWagers
          .filter(w =>
            w.name &&
            w.winning_status === "tbd" &&
            w.status !== "wiped" &&
            w.status !== "canceled"
          )
          .sort((a, b) => (b.matched_stake || 0) - (a.matched_stake || 0));

        setCurrentOpenBets(open);
        setStatusMessage("");
      } catch (e) {
        console.error(e);
        setError(e.message);
        setStatusMessage("Error occurred");
      }
    };

    runProcess();
  }, []);

  return (
    <div>
      <h3>{statusMessage}</h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h2 className="section-title">Status of Open Bets</h2>
      <div className="games-container">
        <div>
          <table className="game-table-secret">
            <thead>
              <tr>
                <th>Status</th>
                <th>DLLs</th>
                <th>Count</th>
                <th>% DLLs</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map(row => (
                <tr key={row.matching_status}>
                  <td>{row.matching_status}</td>
                  <td>{row.dlls.toFixed(2)}</td>
                  <td>{row.count}</td>
                  <td>{row["% dlls"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="section-title">Bets Closed in Last 24 hrs</h2>
      <p className="section-title">Profit in last 24 hrs: {profitLast24.toFixed(2)}</p>
      <div className="games-container">
        <div>
          <table className="game-table-secret">
            <thead>
              <tr>
                <th>Match</th>
                <th>Player Bet On</th>
                <th>Odds</th>
                <th>Matched Stake</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {recentClosedBets.map(bet => (
                <tr key={bet.wager_id || bet.line_id}>
                  <td>{bet.name || "Unknown"}</td>
                  <td>{bet.player}</td>
                  <td>{bet.odds}</td>
                  <td>{bet.matched_stake}</td>
                  <td>{bet.profit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="section-title">Bets Currently Open</h2>
      <div className="games-container">
        <div>
          <table className="game-table-secret">
            <thead>
              <tr>
                <th>Player Bet On</th>
                <th>Odds</th>
                <th>Matched Stake</th>
                <th>Original Stake</th>
              </tr>
            </thead>
            <tbody>
              {currentOpenBets.map(bet => (
                <tr key={bet.wager_id || bet.line_id}>
                  <td>{bet.player}</td>
                  <td>{bet.odds}</td>
                  <td>{bet.matched_stake}</td>
                  <td>{bet.original_stake}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Secret;