import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
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
  type ChartOptions,
  type ChartData,
  type Plugin,
} from 'chart.js';
import { useSeason } from '../hooks/useSeason';
import { weekLabel } from '../utils/week';
import { getNflTeamLogo } from '../utils/teamLogo';
import SeasonSelector from './SeasonSelector';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend);

// Pre-load team logos so the plugin can draw them synchronously
const allTeams = [
  'Cardinals',
  'Falcons',
  'Ravens',
  'Bills',
  'Panthers',
  'Bears',
  'Bengals',
  'Browns',
  'Cowboys',
  'Broncos',
  'Lions',
  'Packers',
  'Texans',
  'Colts',
  'Jaguars',
  'Chiefs',
  'Raiders',
  'Chargers',
  'Rams',
  'Dolphins',
  'Vikings',
  'Patriots',
  'Saints',
  'Giants',
  'Jets',
  'Eagles',
  'Steelers',
  '49ers',
  'Seahawks',
  'Buccaneers',
  'Titans',
  'Commanders',
];

const teamLogoImages: Record<string, HTMLImageElement> = {};
allTeams.forEach((team) => {
  const src = getNflTeamLogo(team);
  if (src) {
    const img = new Image();
    img.src = src;
    teamLogoImages[team] = img;
  }
});

// Draws each team's logo at the last (most recent) data point on their line
const lastPointLogoPlugin: Plugin<'line'> = {
  id: 'lastPointLogo',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (!meta.visible) return;

      let lastIdx = -1;
      for (let j = dataset.data.length - 1; j >= 0; j--) {
        if (dataset.data[j] !== null && dataset.data[j] !== undefined) {
          lastIdx = j;
          break;
        }
      }
      if (lastIdx === -1) return;

      const point = meta.data[lastIdx] as unknown as { x: number; y: number };
      if (!point) return;

      const img = teamLogoImages[dataset.label ?? ''];
      if (!img?.complete || img.naturalWidth === 0) return;

      const size = 22;
      ctx.drawImage(img, point.x - size / 2, point.y - size / 2, size, size);
    });
  },
};

const teamColors: Record<string, string> = {
  Cardinals: '#97233F',
  Falcons: '#A71930',
  Ravens: '#241773',
  Bills: '#00338D',
  Panthers: '#0085CA',
  Bears: '#0B162A',
  Bengals: '#FB4F14',
  Browns: '#311D00',
  Cowboys: '#041E42',
  Broncos: '#FA4616',
  Lions: '#0076B6',
  Packers: '#203731',
  Texans: '#03202F',
  Colts: '#002C5F',
  Jaguars: '#006778',
  Chiefs: '#E31837',
  Raiders: '#A5ACAF',
  Chargers: '#0080C6',
  Rams: '#003594',
  Dolphins: '#008E97',
  Vikings: '#4F2683',
  Patriots: '#002244',
  Saints: '#9F8958',
  Giants: '#0B2265',
  Jets: '#125740',
  Eagles: '#004C54',
  Steelers: '#FFB612',
  '49ers': '#AA0000',
  Seahawks: '#69BE28',
  Buccaneers: '#D50A0A',
  Titans: '#0C2340',
  Commanders: '#773141',
};

function getRandomColor(): string {
  return '#' + Array.from({ length: 6 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
}

function Rankings() {
  const { season, setSeason, games } = useSeason();
  const [chartData, setChartData] = useState<ChartData<'line'>>({ labels: [], datasets: [] });
  const [yMin, setYMin] = useState(1275);
  const [yMax, setYMax] = useState(1775);

  useEffect(() => {
    if (games.length === 0) return;

    const sortedWeeks = [...new Set(games.map((g) => g.Week))].sort((a, b) => a - b);
    const labels = sortedWeeks.map((w) => weekLabel(w));

    // Compute dynamic Y range from all pre-game Elo values
    const allElos = games.flatMap((g) => [g.ElopreH, g.ElopreA]).filter((e): e is number => e != null);
    const rawMin = Math.min(...allElos);
    const rawMax = Math.max(...allElos);
    const pad = Math.max((rawMax - rawMin) * 0.06, 30);
    setYMin(Math.floor((rawMin - pad) / 25) * 25);
    setYMax(Math.ceil((rawMax + pad) / 25) * 25);

    const teamNames = [...new Set(games.map((g) => g.Home))];
    const datasets = teamNames.map((teamName) => {
      const data: (number | null)[] = sortedWeeks.map((week) => {
        const game = games.find(
          (g) => g.Week === week && (g.Home === teamName || g.Away === teamName),
        );
        if (!game) return null;
        return game.Home === teamName ? game.ElopreH : game.ElopreA;
      });
      return {
        label: teamName,
        data,
        borderColor: teamColors[teamName] ?? getRandomColor(),
        backgroundColor: teamColors[teamName] ?? '#888',
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 1.5,
        spanGaps: true,
      };
    });

    setChartData({ labels, datasets });
  }, [games]);

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      maintainAspectRatio: false,
      responsive: true,
      animation: false,
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.08)' },
          ticks: {
            color: 'var(--color-text)',
            font: { family: 'Space Mono', size: 10 },
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 22,
          },
        },
        y: {
          min: yMin,
          max: yMax,
          grid: { color: 'rgba(0,0,0,0.08)' },
          ticks: {
            color: 'var(--color-text)',
            font: { family: 'Space Mono', size: 10 },
            stepSize: 25,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            font: { size: 10, family: 'Space Mono' },
            color: 'var(--color-text)',
            boxWidth: 16,
            padding: 6,
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label ?? '',
          },
        },
      },
    }),
    [yMin, yMax],
  );

  return (
    <div className="rankings">
      <div className="rankings-header">
        <h1>NFL Elo Ratings Season: </h1>
        <div className="rankings-season">
          <SeasonSelector season={season} onSeasonChange={setSeason} />
        </div>
      </div>
      <div className="rankings-chart-container">
        <Line data={chartData} options={chartOptions} plugins={[lastPointLogoPlugin]} />
      </div>
    </div>
  );
}

export default Rankings;
