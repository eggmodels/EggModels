import React from 'react';
import '../../App.css';

interface StatTileProps {
  label: string;
  value: string;
  caption: string;
}

export function StatTile({ label, value, caption }: StatTileProps) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-caption">{caption}</div>
    </div>
  );
}

export function StatTileRow({ children }: { children: React.ReactNode }) {
  return <div className="stat-tile-row">{children}</div>;
}
