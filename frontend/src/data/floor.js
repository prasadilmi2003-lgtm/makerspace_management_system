import { ZONES } from './mock';

/** Grid units (used by the 2D plan) -> metres in the 3D scene. */
export const U = 1.15;

/** Centre + footprint of a zone in world space (x east, z south, y up). */
export const zoneGeom = (z) => {
  const [x, y, w, h] = z.rect;
  return { cx: (x + w / 2 - 7) * U, cz: (y + h / 2 - 5) * U, w: w * U, d: h * U };
};

/** Four workbenches per zone, arranged 2 x 2 in the front half; machinery lives in the back half. */
export const benchesOf = (z) => {
  const out = [];
  let n = 1;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) out.push({ label: `${z.letter}${n++}`, x: (c ? 1 : -1) * 0.92, z: 0.15 + r * 1.55 });
  }
  return out;
};

export const BENCH_STATUS_LABEL = { available: 'Available', occupied: 'In Use', reserved: 'Reserved' };
export const BENCH_STATUS_COLOR = { available: '#22c55e', occupied: '#ff5a1f', reserved: '#a78bfa' };
export const BENCH_STATUS_CHIP = { available: 'chip-ok', occupied: 'chip-brand', reserved: 'chip-info' };

/** Seed bench state from the zone data so both views agree. */
export const initialBenchStatus = () => {
  const map = {};
  ZONES.forEach((z) => benchesOf(z).forEach((b, i) => {
    map[b.label] = z.status === 'reserved' ? 'reserved' : z.status === 'occupied' && i < z.used ? 'occupied' : 'available';
  }));
  return map;
};

/** Zone-level status derived from its benches. */
export const zoneStatusFrom = (z, map) => {
  const s = benchesOf(z).map((b) => map[b.label]);
  if (s.every((x) => x === 'reserved')) return 'reserved';
  if (s.some((x) => x === 'occupied')) return 'occupied';
  return s.some((x) => x === 'reserved') ? 'reserved' : 'available';
};

export const zoneByLabel = (label) => ZONES.find((z) => z.letter === label[0]);
