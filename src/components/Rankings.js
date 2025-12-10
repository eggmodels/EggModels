import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import nflModel from '../python/nfl_2025/nflModel2025.json';
import '../Rankings.css';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
);


// Define a dictionary to map team names to their main colors
const teamColors = {
  'Cardinals': '#97233F',
  'Falcons': '#A71930',
  'Ravens': '#241773',
  'Bills': '#00338D',
  'Panthers': '#0085CA',
  'Bears': '#0B162A',
  'Bengals': '#FB4F14',
  'Browns': '#311D00',
  'Cowboys': '#041E42',
  'Broncos': '#FB4F14',
  'Lions': '#0076B6',
  'Packers': '#203731',
  'Texans': '#03202F',
  'Colts': '#002C5F',
  'Jaguars': '#006778',
  'Chiefs': '#E31837',
  'Raiders': '#000000',
  'Chargers': '#002A5E',
  'Rams': '#003594',
  'Dolphins': '#008E97',
  'Vikings': '#4F2683',
  'Patriots': '#002244',
  'Saints': '#D3BC8D',
  'Giants': '#0B2265',
  'Jets': '#125740',
  'Eagles': '#004C54',
  'Steelers': '#FFB612',
  '49ers': '#AA0000',
  'Seahawks': '#002244',
  'Buccaneers': '#D50A0A',
  'Titans': '#0C2340',
  'Commanders': '#773141',
};

const Rankings = () => {
  const [teamEloData, setTeamEloData] = useState({
    labels: [],
    datasets: [],
  });

  useEffect(() => {
    const labels = [];
    const teamDatasets = {};

    // Extract all unique team names from the JSON data
    const teamNames = [...new Set(nflModel.map((game) => game.Home))];

    // Create a dataset for each team
    teamNames.forEach((teamName) => {
      const teamEloRatings = [];
      const teamGames = nflModel.filter(
        (game) => game.Home === teamName || game.Away === teamName
      );

      teamGames.forEach((game) => {
        const week = game.Week;
        labels.push(`Week ${week}`);
        const teamElo = game.Home === teamName ? game.ElopreH : game.ElopreA;
        teamEloRatings.push(teamElo);
      });

      // Get the main color for the team from the dictionary
      const color = teamColors[teamName] || getRandomColor();

      // Create a dataset for the team
      teamDatasets[teamName] = {
        label: `${teamName}`,
        data: teamEloRatings,
        borderColor: color,
        fill: false,
      };
    });

    setTeamEloData({
      labels: [...new Set(labels)], // Remove duplicates from labels
      datasets: Object.values(teamDatasets), // Convert the object of datasets to an array
    });
  }, []);

  // Function to generate a random color if a team's color is not defined
  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  return (
    <div className='rankings'>
      <h1>NFL Elo Ratings</h1>
      <Line
        data={teamEloData}
        options={{
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: {
                color: 'grey',
              },
              beginAtZero: true,
              autoSkip: false, // Prevent Chart.js from automatically skipping labels
              maxTicksLimit: 22, // Set a limit to the maximum number of ticks on the x-axis
              ticks: {
                callback: function(val, index) {
                  // Return a label for every tick, ensuring week 10 is included
                  return `Week ${index + 1}`;
                },
                color: 'black',
              },
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'grey',
              },
              min: 1275,
              max: 1775,
              ticks: {
                color: 'black',
                stepSize: 25,
              },
            },
          },
          plugins: {
            legend: {
              display: true,
              labels: {
                font: {
                  size: 14,
                  family: 'Space Mono',
                  color: '#000',
                },
              },
            },
          },
        }}
      />
    </div>
  );
};

export default Rankings;