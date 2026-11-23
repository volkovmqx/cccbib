import type { StatRow } from '../model/playbackStats';
import React from 'react';

export const StatsPanel = React.memo(function StatsPanel({ rows, title }: { rows: StatRow[]; title: string }) {
  return (
    <div className="playerStats" role="region" aria-label={title}>
      {rows.map((row) => (
        <div className="playerStats__row" key={row.label}>
          <span className="playerStats__label">{row.label}</span>
          <span className="playerStats__value">{row.value}</span>
        </div>
      ))}
    </div>
  );
});
