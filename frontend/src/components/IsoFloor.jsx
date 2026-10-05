import React from 'react';

// Isometric projection helpers (grid units -> screen px)
const S = 34;
const C = 0.866;
const px = (x, y) => (x - y) * C * S;
const py = (x, y, z = 0) => (x + y) * 0.5 * S - z * S;
const P = (x, y, z = 0) => `${px(x, y).toFixed(1)},${py(x, y, z).toFixed(1)}`;

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

const Box = ({ x, y, w, h, z0 = 0, z1, top, left, right, stroke }) => (
  <g>
    <polygon points={`${P(x + w, y, z0)} ${P(x + w, y + h, z0)} ${P(x + w, y + h, z1)} ${P(x + w, y, z1)}`} fill={right} stroke={stroke} strokeWidth=".6" />
    <polygon points={`${P(x, y + h, z0)} ${P(x + w, y + h, z0)} ${P(x + w, y + h, z1)} ${P(x, y + h, z1)}`} fill={left} stroke={stroke} strokeWidth=".6" />
    <polygon points={`${P(x, y, z1)} ${P(x + w, y, z1)} ${P(x + w, y + h, z1)} ${P(x, y + h, z1)}`} fill={top} stroke={stroke} strokeWidth=".6" />
  </g>
);

export const STATE_COLOR = { available: '#22c55e', occupied: '#ff5a1f', reserved: '#a78bfa', maintenance: '#3b82f6' };
const STATE_LABEL = { available: 'Available', occupied: 'In Use', reserved: 'Reserved', maintenance: 'Maintenance' };

/** Deterministic bench layout so the plan is stable between renders. */
const benchesFor = (zone) => {
  const [x, y, w, h] = zone.rect;
  const cols = Math.max(2, Math.floor((w - 1) / 1.3));
  const rows = Math.max(1, Math.floor((h - 1.4) / 1.4));
  const out = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: x + 0.6 + c * ((w - 1.2) / cols),
        y: y + 1.4 + r * ((h - 1.9) / rows),
        w: (w - 1.2) / cols - 0.45,
        h: 0.8,
        i: i++,
      });
    }
  }
  return out;
};

export default function IsoFloor({ zones, activeId, onSelect, dark = false, labels = true, hoverId, onHover }) {
  const floorTop = dark ? '#161c28' : '#eef0f4';
  const floorL = dark ? '#0d1119' : '#cfd4de';
  const floorR = dark ? '#0a0d14' : '#b9bfcc';
  const grid = dark ? 'rgba(255,255,255,.06)' : 'rgba(10,13,19,.08)';
  const W = 14;
  const H = 10;

  const sorted = [...zones].sort((a, b) => (a.rect[0] + a.rect[1]) - (b.rect[0] + b.rect[1]));

  return (
    <svg viewBox="-330 -70 760 560" className="h-auto w-full select-none" role="img" aria-label="Isometric makerspace floor plan">
      <defs>
        <filter id="zglow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <ellipse cx={px(W / 2, H / 2)} cy={py(W, H, 0) + 18} rx="330" ry="40" fill={dark ? '#000' : '#0a0d13'} opacity={dark ? 0.5 : 0.09} />

      <Box x={-0.5} y={-0.5} w={W + 1} h={H + 1} z0={-0.45} z1={0} top={floorTop} left={floorL} right={floorR} stroke={dark ? '#000' : '#fff'} />
      {Array.from({ length: W + 1 }, (_, i) => <line key={`gx${i}`} x1={px(i, 0)} y1={py(i, 0)} x2={px(i, H)} y2={py(i, H)} stroke={grid} strokeWidth=".6" />)}
      {Array.from({ length: H + 1 }, (_, i) => <line key={`gy${i}`} x1={px(0, i)} y1={py(0, i)} x2={px(W, i)} y2={py(W, i)} stroke={grid} strokeWidth=".6" />)}

      {sorted.map((z) => {
        const [x, y, w, h] = z.rect;
        const active = activeId === z.id;
        const lit = active || hoverId === z.id;
        const cx = px(x + w / 2, y + h / 2);
        const cy = py(x + w / 2, y + h / 2, 1.5);
        return (
          <g
            key={z.id}
            onClick={() => onSelect?.(z.id)}
            onMouseEnter={() => onHover?.(z.id)}
            onMouseLeave={() => onHover?.(null)}
            style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'opacity .2s' }}
            opacity={activeId && !active ? 0.5 : 1}
            tabIndex={onSelect ? 0 : undefined}
            role={onSelect ? 'button' : undefined}
            aria-label={`${z.name}, ${STATE_LABEL[z.status]}`}
            onKeyDown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(z.id); } }}
          >
            <g filter={lit ? 'url(#zglow)' : undefined}>
              <Box x={x} y={y} w={w} h={h} z0={0} z1={lit ? 0.42 : 0.28}
                top={shade(z.color, dark ? -95 : 60)} left={shade(z.color, -40)} right={shade(z.color, -70)} stroke={z.color} />
              <polygon points={`${P(x, y, 0.3)} ${P(x + w, y, 0.3)} ${P(x + w, y + h, 0.3)} ${P(x, y + h, 0.3)}`} fill="none" stroke={z.color} strokeWidth={lit ? 2.4 : 1.2} opacity={lit ? 1 : 0.7} />
            </g>
            {benchesFor(z).map((b) => {
              const dot = z.status === 'available' ? STATE_COLOR.available : z.status === 'occupied' ? (b.i < z.used ? STATE_COLOR.occupied : STATE_COLOR.available) : STATE_COLOR[z.status];
              return (
                <g key={b.i}>
                  <Box x={b.x} y={b.y} w={b.w} h={b.h} z0={0.28} z1={0.78}
                    top={dark ? '#2a3348' : '#ffffff'} left={dark ? '#1b2232' : '#d9dde6'} right={dark ? '#141a26' : '#c3c9d6'} stroke={dark ? '#000' : '#aeb5c4'} />
                  <circle cx={px(b.x + b.w / 2, b.y + b.h / 2)} cy={py(b.x + b.w / 2, b.y + b.h / 2, 0.78)} r="2.6" fill={dot} />
                </g>
              );
            })}
            {labels && (
              <g transform={`translate(${cx} ${cy - 24})`} style={{ pointerEvents: 'none' }}>
                <rect x={-52} y={-17} width={104} height={36} rx={7} fill={dark ? 'rgba(6,8,12,.88)' : 'rgba(255,255,255,.96)'} stroke={z.color} strokeWidth="1.4" />
                <text y={-3} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={dark ? '#fff' : '#0a0d13'} fontFamily="Space Grotesk, sans-serif">{z.letter} · {z.short}</text>
                <text y={12} textAnchor="middle" fontSize="9.5" fill={STATE_COLOR[z.status]} fontFamily="Inter, sans-serif">{STATE_LABEL[z.status]}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const FLOOR_LEGEND = [
  { label: 'Available', color: STATE_COLOR.available },
  { label: 'In Use', color: STATE_COLOR.occupied },
  { label: 'Reserved', color: STATE_COLOR.reserved },
];
