import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Crosshair, MousePointer2 } from 'lucide-react';
import IsoFloor from './IsoFloor';
import { BENCH_STATUS_COLOR, BENCH_STATUS_LABEL, zoneByLabel, zoneStatusFrom } from '../data/floor';

// three.js is heavy: only fetched when a page actually shows the floor.
const FloorScene = lazy(() => import('./FloorScene'));

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

class SceneBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const Skeleton = () => (
  <div className="flex h-full flex-col items-center justify-center gap-4 text-ink-300">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
    <div className="font-mono text-[11px] uppercase tracking-[.25em]">Building 3D floor…</div>
  </div>
);

/**
 * Interactive 3D floor used inside forms: click a zone or a bench and the parent gets `onPick`.
 * The parent owns the selection (zoneId / bench) so a dropdown and the model always agree.
 */
export default function FloorPicker({ zones, statusMap, zoneId, bench, onPick, className = '' }) {
  const [webgl] = useState(hasWebGL);
  const [hover, setHover] = useState(null);
  const [focused, setFocused] = useState(false);
  const [nonce, setNonce] = useState(0);
  const lastZone = useRef(zoneId);

  // Fly the camera to the zone whenever the selection changes (from the model or from a dropdown).
  // Comparing with the previous value (not a 'first render' flag) keeps this correct under React StrictMode's double effects.
  useEffect(() => {
    if (lastZone.current === zoneId) return;
    lastZone.current = zoneId;
    setFocused(true);
    setNonce((n) => n + 1);
  }, [zoneId]);

  const pickZone = (id) => { if (id) onPick({ zoneId: id, bench: '' }); };
  const pickBench = (label) => onPick({ zoneId: zoneByLabel(label).id, bench: label });
  const overview = () => { setFocused(false); setNonce((n) => n + 1); };

  const fallback = (
    <div className="p-4">
      <div className="mb-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">3D is unavailable on this device. Showing the 2D plan.</div>
      <IsoFloor dark zones={zones.map((z) => ({ ...z, status: zoneStatusFrom(z, statusMap) }))} activeId={zoneId} onSelect={pickZone} />
    </div>
  );

  return (
    <div className={`relative overflow-hidden bg-ink-950 ${className}`}>
      {webgl ? (
        <SceneBoundary fallback={fallback}>
          <Suspense fallback={<Skeleton />}>
            <FloorScene
              zones={zones} statusMap={statusMap} selectedZone={zoneId} selectedBench={bench || null} hoverZone={hover}
              filter="all" view={focused ? 'zone' : 'overview'} nonce={nonce} showLabels showPeople
              onSelectZone={pickZone} onSelectBench={pickBench} onHover={setHover}
            />
          </Suspense>
        </SceneBoundary>
      ) : fallback}

      {webgl && (
        <>
          <div className="pointer-events-none absolute left-3 top-3">
            <button onClick={overview} className="pointer-events-auto glass flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink-100 hover:text-white"><Crosshair size={14} /> Whole floor</button>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-xl glass px-3 py-2 text-[11px] font-medium text-ink-100">
            {['available', 'occupied', 'reserved'].map((s) => <span key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BENCH_STATUS_COLOR[s] }} />{BENCH_STATUS_LABEL[s]}</span>)}
          </div>
          <div className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-2 rounded-xl glass px-3 py-2 text-[11px] text-ink-200 lg:flex">
            <MousePointer2 size={13} className="text-brand-400" /> Click a zone or bench to choose it
          </div>
        </>
      )}
    </div>
  );
}
