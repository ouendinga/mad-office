import React from 'react';

// Pentágono de estados (0-5, con un decimal). Más área = mejor día.
const AXES = [
  { key: 'energia', label: 'Energía' },
  { key: 'animo', label: 'Ánimo' },
  { key: 'saciedad', label: 'Saciedad' },
  { key: 'social', label: 'Social' },
  { key: 'calma', label: 'Calma' },
];

function point(i, r, cx, cy) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export default function StatsPentagon({ stats, size = 190 }) {
  if (!stats) return null;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const R = size / 2 - 34;
  const ring = f => AXES.map((_, i) => point(i, R * f, cx, cy).join(',')).join(' ');
  const shape = AXES.map((ax, i) => point(i, (R * Math.max(0, Math.min(5, stats[ax.key] || 0))) / 5, cx, cy).join(',')).join(' ');
  const summary = AXES.map(ax => `${ax.label} ${(stats[ax.key] ?? 0).toFixed(1)}`).join(', ');

  return (
    <svg className="pentagon" width={size} height={size + 8} viewBox={`0 0 ${size} ${size + 8}`} role="img" aria-label={`Estados: ${summary} (de 0 a 5)`}>
      {[0.2, 0.4, 0.6, 0.8, 1].map(f => (
        <polygon key={f} points={ring(f)} className={f === 1 ? 'pentagon-ring pentagon-ring-outer' : 'pentagon-ring'} />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = point(i, R, cx, cy);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="pentagon-axis" />;
      })}
      <polygon points={shape} className="pentagon-shape" />
      {AXES.map((ax, i) => {
        const [x, y] = point(i, R + 17, cx, cy);
        return (
          <text key={ax.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="pentagon-label">
            <tspan>{ax.label}</tspan>
            <tspan x={x} dy="11" className="pentagon-value">{(stats[ax.key] ?? 0).toFixed(1)}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
