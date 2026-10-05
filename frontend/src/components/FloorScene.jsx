import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Grid, OrbitControls, useCursor } from '@react-three/drei';
import { BENCH_STATUS_COLOR, BENCH_STATUS_LABEL, benchesOf, zoneGeom, zoneStatusFrom } from '../data/floor';

/* ------------------------------------------------------------------ primitives */
const Box = ({ p = [0, 0, 0], s = [1, 1, 1], c = '#9aa3b2', m = 0.3, r = 0.55, e, ei = 0, o = 1, rot, shadow = true, children }) => (
  <mesh position={p} rotation={rot} castShadow={shadow && o === 1} receiveShadow>
    <boxGeometry args={s} />
    <meshStandardMaterial color={c} metalness={m} roughness={r} emissive={e || '#000000'} emissiveIntensity={ei} transparent={o < 1} opacity={o} depthWrite={o === 1} />
    {children}
  </mesh>
);

const Cyl = ({ p = [0, 0, 0], r = 0.1, h = 1, c = '#9aa3b2', m = 0.4, ro = 0.5, rot, e, ei = 0, seg = 24, shadow = true }) => (
  <mesh position={p} rotation={rot} castShadow={shadow} receiveShadow>
    <cylinderGeometry args={[r, r, h, seg]} />
    <meshStandardMaterial color={c} metalness={m} roughness={ro} emissive={e || '#000000'} emissiveIntensity={ei} />
  </mesh>
);

/** Table legs helper: four posts under a top of size [w, d] at height y. */
const Legs = ({ w, d, y, c = '#2b313d', t = 0.05 }) => (
  <>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
      <Box key={i} p={[sx * (w / 2 - t), y / 2, sz * (d / 2 - t)]} s={[t, y, t]} c={c} m={0.7} r={0.4} />
    ))}
  </>
);

/* ------------------------------------------------------------------ people */
function Person({ pos, color }) {
  const g = useRef();
  const seed = useMemo(() => Math.random() * 6, []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + seed;
    g.current.rotation.y = Math.sin(t * 0.6) * 0.18;
    g.current.position.y = Math.sin(t * 1.6) * 0.008;
  });
  return (
    <group ref={g} position={pos}>
      <Cyl p={[-0.08, 0.42, 0]} r={0.055} h={0.84} c="#252a35" ro={0.8} m={0.05} seg={10} />
      <Cyl p={[0.08, 0.42, 0]} r={0.055} h={0.84} c="#252a35" ro={0.8} m={0.05} seg={10} />
      <mesh position={[0, 1.18, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.42, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.18, 0.001]}>
        <capsuleGeometry args={[0.152, 0.1, 4, 12]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.4} emissive="#e5e7eb" emissiveIntensity={0.25} />
      </mesh>
      <Cyl p={[-0.2, 1.1, 0.12]} r={0.04} h={0.55} c={color} ro={0.7} m={0.05} rot={[0.9, 0, 0]} seg={8} />
      <Cyl p={[0.2, 1.1, 0.12]} r={0.04} h={0.55} c={color} ro={0.7} m={0.05} rot={[0.9, 0, 0]} seg={8} />
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.115, 20, 16]} />
        <meshStandardMaterial color="#d9a47c" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.67, 0]} castShadow>
        <sphereGeometry args={[0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f5f5f4" roughness={0.35} metalness={0.1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ bench decor per zone */
function PrinterHead({ x = 0, speed = 1 }) {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.position.x = x + Math.sin(clock.elapsedTime * 2.2 * speed) * 0.14; });
  return (
    <mesh ref={ref} position={[x, 0.32, 0]}>
      <boxGeometry args={[0.07, 0.05, 0.07]} />
      <meshStandardMaterial color="#ff5a1f" emissive="#ff5a1f" emissiveIntensity={0.6} />
    </mesh>
  );
}

function BenchDecor({ zone, label }) {
  const y = 0.93;
  switch (zone.id) {
    case 'a':
      return (<>
        <Box p={[-0.45, y + 0.04, 0]} s={[0.3, 0.08, 0.22]} c="#6b7280" m={0.9} r={0.3} />
        <Box p={[0.35, y + 0.08, 0.05]} s={[0.1, 0.16, 0.1]} c="#1f2937" m={0.6} />
        <Box p={[0.1, y + 0.02, -0.1]} s={[0.3, 0.04, 0.03]} c="#9ca3af" m={0.9} r={0.2} rot={[0, 0.5, 0]} />
      </>);
    case 'b':
      return (<>
        <Box p={[-0.35, y + 0.2, -0.18]} s={[0.5, 0.3, 0.025]} c="#0b1220" e="#38bdf8" ei={0.55} m={0.1} r={0.3} />
        <Box p={[-0.35, y + 0.04, -0.18]} s={[0.08, 0.08, 0.06]} c="#1f2937" />
        <Box p={[0.3, y + 0.1, -0.05]} s={[0.34, 0.2, 0.3]} c="#374151" m={0.4}>
          <mesh position={[0, 0.02, 0.152]}><planeGeometry args={[0.26, 0.12]} /><meshStandardMaterial color="#052e16" emissive="#22c55e" emissiveIntensity={0.7} /></mesh>
        </Box>
        <Box p={[0.05, y + 0.02, 0.2]} s={[0.5, 0.01, 0.25]} c="#14532d" r={0.9} m={0} />
      </>);
    case 'c':
      return (<>
        <Box p={[-0.2, y + 0.26, 0]} s={[0.5, 0.5, 0.5]} c="#111827" m={0.5} r={0.4} o={1} />
        <Box p={[-0.2, y + 0.26, 0.255]} s={[0.44, 0.44, 0.01]} c="#9ec8ff" o={0.25} shadow={false} />
        <group position={[-0.2, y, 0]}><PrinterHead x={0} /></group>
        <Cyl p={[0.45, y + 0.06, 0.1]} r={0.1} h={0.06} c="#22c55e" ro={0.7} m={0.1} rot={[Math.PI / 2, 0, 0]} />
      </>);
    case 'd':
      return (<>
        <Box p={[-0.4, y + 0.08, 0]} s={[0.3, 0.16, 0.25]} c="#eab308" m={0.2} />
        <Box p={[0.3, y + 0.04, 0]} s={[0.4, 0.08, 0.3]} c="#374151" m={0.8} r={0.3} />
      </>);
    case 'e':
      return (<>
        <Box p={[-0.35, y + 0.09, 0]} s={[0.4, 0.18, 0.3]} c="#8b5cf6" m={0.2} />
        <Box p={[0.3, y + 0.08, 0.05]} s={[0.12, 0.16, 0.2]} c="#4b5563" m={0.7} />
        <Box p={[0.45, y + 0.2, 0.05]} s={[0.04, 0.4, 0.04]} c="#9ca3af" m={0.9} />
      </>);
    case 'f':
      return (<>
        <Box p={[-0.3, y + 0.015, 0.05]} s={[0.4, 0.02, 0.28]} c="#111827" m={0.6} r={0.3} />
        <Box p={[-0.3, y + 0.15, -0.09]} s={[0.4, 0.26, 0.015]} c="#0b1220" e="#ec4899" ei={0.4} rot={[-0.2, 0, 0]} />
        <Box p={[0.35, y + 0.06, 0]} s={[0.3, 0.12, 0.3]} c="#d4a373" r={0.7} m={0} />
      </>);
    default:
      return (<>
        <Box p={[-0.45, y + 0.07, 0]} s={[0.16, 0.14, 0.18]} c="#4b5563" m={0.8} r={0.3} />
        <Box p={[0.35, y + 0.08, 0.05]} s={[0.4, 0.16, 0.25]} c={label.endsWith('1') || label.endsWith('3') ? '#dc2626' : '#2563eb'} m={0.2} />
      </>);
  }
}

/* ------------------------------------------------------------------ bench */
function Bench({ b, zone, status, selected, dimmed, highlight, showPeople, onSelectBench, onHover }) {
  const outline = useRef();
  const col = BENCH_STATUS_COLOR[status];
  const wood = zone.id === 'g' || zone.id === 'h';
  useFrame(({ clock }) => {
    if (!outline.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.025;
    outline.current.scale.set(s, 1, s);
  });
  return (
    <group
      position={[b.x, 0, b.z]}
      onClick={(e) => { e.stopPropagation(); onSelectBench(b.label); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(zone.id); }}
      onPointerOut={() => onHover(null)}
    >
      <Box p={[0, 0.9, 0]} s={[1.5, 0.06, 0.75]} c={wood ? '#b0825a' : '#c8cdd6'} m={wood ? 0.05 : 0.7} r={wood ? 0.6 : 0.32} />
      <Box p={[0, 0.84, 0]} s={[1.46, 0.06, 0.71]} c="#20252f" m={0.4} />
      <Legs w={1.5} d={0.75} y={0.87} />
      <Box p={[0, 0.28, 0]} s={[1.38, 0.03, 0.63]} c="#2b313d" m={0.5} />
      <BenchDecor zone={zone} label={b.label} />

      {/* status beacon */}
      <Cyl p={[0.68, 1.12, -0.3]} r={0.012} h={0.4} c="#9ca3af" m={0.9} shadow={false} />
      <mesh position={[0.68, 1.34, -0.3]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={dimmed ? 0.6 : 2.4} />
      </mesh>
      <mesh position={[0.68, 1.34, -0.3]}>
        <sphereGeometry args={[highlight ? 0.28 : 0.16, 16, 16]} />
        <meshBasicMaterial color={col} transparent opacity={dimmed ? 0.05 : highlight ? 0.3 : 0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {showPeople && status === 'occupied' && <Person pos={[0, 0, 0.82]} color={zone.color} />}

      {selected && (
        <group ref={outline}>
          {[[0, -0.5, 1.85, 0.05], [0, 0.5, 1.85, 0.05], [-0.92, 0, 0.05, 1.05], [0.92, 0, 0.05, 1.05]].map(([x, z, w, d], i) => (
            <mesh key={i} position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, d]} />
              <meshBasicMaterial color={col} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ zone machinery */
function WeldingBay({ active }) {
  const lamp = useRef();
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.intensity = active ? 14 + Math.sin(clock.elapsedTime * 41) * 7 + Math.random() * 6 : 0;
  });
  return (
    <group>
      {[[-1.75, -2.5], [1.75, -2.5], [-1.75, -0.5], [1.75, -0.5]].map(([x, z], i) => <Cyl key={i} p={[x, 1.1, z]} r={0.035} h={2.2} c="#3a414f" m={0.85} />)}
      <Box p={[0, 1.1, -2.5]} s={[3.5, 2.0, 0.02]} c="#ff7a1f" o={0.4} e="#ff5a1f" ei={0.12} />
      <Box p={[-1.75, 1.1, -1.5]} s={[0.02, 2.0, 2.0]} c="#ff7a1f" o={0.4} e="#ff5a1f" ei={0.12} />
      <Box p={[1.75, 1.1, -1.5]} s={[0.02, 2.0, 2.0]} c="#ff7a1f" o={0.4} e="#ff5a1f" ei={0.12} />
      <Box p={[0, 2.2, -1.5]} s={[3.5, 0.05, 2.05]} c="#3a414f" m={0.8} />
      <Box p={[0, 0.8, -1.55]} s={[1.7, 0.08, 0.9]} c="#6b7280" m={0.9} r={0.3} />
      <group position={[0, 0, -1.55]}><Legs w={1.7} d={0.9} y={0.78} c="#374151" t={0.07} /></group>
      <Box p={[-1.3, 0.45, -2.15]} s={[0.5, 0.9, 0.6]} c="#b91c1c" m={0.35} r={0.45} />
      <Box p={[-1.3, 0.75, -1.84]} s={[0.36, 0.14, 0.02]} c="#111827" e="#22c55e" ei={0.5} />
      <Cyl p={[1.45, 0.72, -2.2]} r={0.12} h={1.44} c="#2563eb" m={0.55} ro={0.35} />
      <Cyl p={[1.45, 1.48, -2.2]} r={0.05} h={0.1} c="#d1d5db" m={0.9} />
      <Cyl p={[1.15, 0.72, -2.2]} r={0.12} h={1.44} c="#b91c1c" m={0.55} ro={0.35} />
      <Cyl p={[1.15, 1.48, -2.2]} r={0.05} h={0.1} c="#d1d5db" m={0.9} />
      <Cyl p={[0, 2.0, -1.0]} r={0.03} h={1.2} c="#9ca3af" m={0.9} rot={[Math.PI / 2, 0, 0]} />
      <Box p={[0, 1.55, -1.3]} s={[0.5, 0.04, 0.5]} c="#4b5563" m={0.8} rot={[0.5, 0, 0]} />
      <pointLight ref={lamp} position={[0, 1.2, -1.5]} color="#a5d8ff" distance={6} decay={2} intensity={0} />
    </group>
  );
}

function PcbStation() {
  const bins = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
  return (
    <group>
      {[[-1.7, -2.45], [1.7, -2.45], [-1.7, -2.15], [1.7, -2.15]].map(([x, z], i) => <Box key={i} p={[x, 1.0, z]} s={[0.05, 2.0, 0.05]} c="#4b5563" m={0.8} />)}
      {[0.35, 0.95, 1.55].map((y, i) => (
        <group key={y}>
          <Box p={[0, y, -2.3]} s={[3.4, 0.04, 0.4]} c="#6b7280" m={0.8} r={0.35} />
          {Array.from({ length: 9 }, (_, k) => <Box key={k} p={[-1.5 + k * 0.375, y + 0.1, -2.3]} s={[0.3, 0.16, 0.32]} c={bins[(k + i * 2) % bins.length]} r={0.6} m={0.05} />)}
        </group>
      ))}
      <Box p={[1.3, 0.95, -1.2]} s={[0.9, 1.1, 0.6]} c="#9ec8ff" o={0.2} />
      <Box p={[1.3, 0.38, -1.2]} s={[0.9, 0.76, 0.6]} c="#334155" m={0.5} />
      <Box p={[1.3, 1.5, -1.2]} s={[0.9, 0.04, 0.6]} c="#1f2937" m={0.7} />
      <Cyl p={[1.3, 1.6, -1.2]} r={0.1} h={0.15} c="#9ca3af" m={0.9} />
    </group>
  );
}

function PrintFarm() {
  const spool = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#e5e7eb'];
  return (
    <group>
      <Box p={[0, 0.84, -2.05]} s={[3.4, 0.05, 0.75]} c="#374151" m={0.6} r={0.4} />
      <group position={[0, 0, -2.05]}><Legs w={3.4} d={0.75} y={0.82} /></group>
      {[-1.25, -0.42, 0.42, 1.25].map((x, i) => (
        <group key={i} position={[x, 0.865, -2.05]}>
          <Box p={[0, 0.27, 0]} s={[0.6, 0.54, 0.55]} c="#111827" m={0.5} r={0.4} />
          <Box p={[0, 0.27, 0.285]} s={[0.54, 0.48, 0.01]} c="#9ec8ff" o={0.22} />
          <group position={[0, 0.17, 0]}><PrinterHead x={0} speed={0.8 + i * 0.15} /></group>
          <Box p={[0, 0.02, 0]} s={[0.4, 0.015, 0.4]} c="#ff5a1f" e="#ff5a1f" ei={0.35} shadow={false} />
        </group>
      ))}
      {[-1.45, 1.45].map((x) => (
        <group key={x}>
          <Box p={[x, 1.3, -2.3]} s={[0.04, 0.9, 0.04]} c="#9ca3af" m={0.8} />
          {spool.slice(0, 4).map((c, k) => <Cyl key={k} p={[x, 1.0 + k * 0.001 + (k % 2) * 0.35, -2.3 + 0.05 * k]} r={0.13} h={0.07} c={c} ro={0.6} m={0.05} rot={[Math.PI / 2, 0, 0]} />)}
        </group>
      ))}
    </group>
  );
}

function CncBay({ reserved }) {
  const gantry = useRef();
  const head = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (gantry.current) gantry.current.position.x = Math.sin(t * 0.7) * 0.75;
    if (head.current) head.current.position.z = Math.sin(t * 1.3) * 0.28;
  });
  return (
    <group>
      <Box p={[0, 0.4, -1.65]} s={[2.5, 0.8, 1.4]} c="#1f2937" m={0.6} r={0.45} />
      <Box p={[0, 0.83, -1.65]} s={[2.4, 0.06, 1.3]} c="#9ca3af" m={0.9} r={0.28} />
      <Box p={[0, 0.88, -1.65]} s={[1.9, 0.04, 1.0]} c="#c08a4a" r={0.7} m={0} />
      <group ref={gantry} position={[0, 0, -1.65]}>
        <Box p={[0, 1.15, 0]} s={[0.22, 0.28, 1.45]} c="#eab308" m={0.5} r={0.4} />
        <Box p={[0, 0.98, -0.72]} s={[0.14, 0.3, 0.1]} c="#374151" m={0.7} />
        <Box p={[0, 0.98, 0.72]} s={[0.14, 0.3, 0.1]} c="#374151" m={0.7} />
        <group ref={head}>
          <Box p={[0, 1.0, 0]} s={[0.2, 0.24, 0.2]} c="#6b7280" m={0.8} r={0.3} />
          <Cyl p={[0, 0.82, 0]} r={0.035} h={0.18} c="#d1d5db" m={0.95} ro={0.2} />
          <Box p={[0, 0.725, 0]} s={[0.012, 0.012, 0.012]} c="#fff" e="#ffd8b0" ei={3} shadow={false} />
        </group>
      </group>
      {/* safety enclosure */}
      {[[-1.35, -1.65, 0.02, 1.6], [1.35, -1.65, 0.02, 1.6]].map(([x, z, w, d], i) => <Box key={i} p={[x, 1.1, z]} s={[w, 2.0, d]} c="#9ec8ff" o={0.16} />)}
      <Box p={[0, 1.1, -2.45]} s={[2.7, 2.0, 0.02]} c="#9ec8ff" o={0.16} />
      <Box p={[0, 2.12, -1.65]} s={[2.74, 0.04, 1.64]} c="#eab308" m={0.5} />
      {[[-1.35, -2.45], [1.35, -2.45], [-1.35, -0.85], [1.35, -0.85]].map(([x, z], i) => <Cyl key={i} p={[x, 1.06, z]} r={0.03} h={2.12} c="#eab308" m={0.6} />)}
      {reserved && (
        <group>
          {[-1.55, 1.55].map((x) => (
            <group key={x}>
              <Cyl p={[x, 0.46, 0.35]} r={0.03} h={0.92} c="#374151" m={0.9} />
              <Cyl p={[x, 0.02, 0.35]} r={0.16} h={0.04} c="#374151" m={0.8} />
              <Cyl p={[x, 0.94, 0.35]} r={0.05} h={0.04} c="#eab308" m={0.5} />
            </group>
          ))}
          <Box p={[0, 0.82, 0.35]} s={[3.1, 0.06, 0.012]} c="#eab308" e="#eab308" ei={0.5} />
          <Box p={[0, 0.74, 0.35]} s={[3.1, 0.06, 0.012]} c="#111827" />
        </group>
      )}
    </group>
  );
}

function AssemblyZone() {
  const crates = ['#8b5cf6', '#a78bfa', '#6d28d9', '#7c3aed'];
  return (
    <group>
      <Box p={[0, 0.82, -1.65]} s={[2.9, 0.09, 1.2]} c="#cbd5e1" m={0.7} r={0.3} />
      <group position={[0, 0, -1.65]}><Legs w={2.9} d={1.2} y={0.8} c="#374151" t={0.08} /></group>
      {/* rover chassis on the table */}
      <group position={[0, 0.87, -1.65]}>
        <Box p={[0, 0.2, 0]} s={[0.9, 0.12, 0.55]} c="#334155" m={0.6} r={0.4} />
        <Box p={[0, 0.3, 0]} s={[0.6, 0.08, 0.4]} c="#ff5a1f" m={0.4} r={0.45} />
        {[-0.38, 0, 0.38].map((x) => (
          <React.Fragment key={x}>
            <Cyl p={[x, 0.12, 0.34]} r={0.12} h={0.1} c="#111827" ro={0.85} m={0.05} rot={[Math.PI / 2, 0, 0]} />
            <Cyl p={[x, 0.12, -0.34]} r={0.12} h={0.1} c="#111827" ro={0.85} m={0.05} rot={[Math.PI / 2, 0, 0]} />
          </React.Fragment>
        ))}
        <Cyl p={[0.2, 0.52, 0]} r={0.015} h={0.4} c="#d1d5db" m={0.9} />
        <Box p={[0.2, 0.74, 0]} s={[0.1, 0.07, 0.1]} c="#111827" e="#38bdf8" ei={0.8} />
      </group>
      {[-1.15, 1.15].map((x) => (
        <group key={x} position={[x, 0, -2.4]}>
          {[[-0.7, -0.2], [0.7, -0.2], [-0.7, 0.2], [0.7, 0.2]].map(([a, b], i) => <Box key={i} p={[a, 0.95, b]} s={[0.04, 1.9, 0.04]} c="#64748b" m={0.8} />)}
          {[0.25, 0.8, 1.35, 1.88].map((y, i) => (
            <group key={y}>
              <Box p={[0, y, 0]} s={[1.45, 0.035, 0.45]} c="#94a3b8" m={0.7} r={0.4} />
              {i < 3 && [-0.45, 0, 0.45].map((cx, k) => <Box key={k} p={[cx, y + 0.12, 0]} s={[0.36, 0.2, 0.34]} c={crates[(i + k) % 4]} r={0.65} m={0.05} />)}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function LaserZone() {
  const dot = useRef();
  useFrame(({ clock }) => { if (dot.current) { dot.current.position.x = Math.sin(clock.elapsedTime * 2.4) * 0.5; dot.current.position.z = Math.cos(clock.elapsedTime * 1.7) * 0.25; } });
  return (
    <group>
      <Box p={[0, 0.4, -1.6]} s={[1.9, 0.8, 1.1]} c="#1f2937" m={0.6} r={0.45} />
      <Box p={[0, 0.98, -1.6]} s={[1.8, 0.36, 1.05]} c="#e5e7eb" m={0.3} r={0.4} />
      <Box p={[0, 1.0, -1.07]} s={[1.5, 0.22, 0.012]} c="#7f1d1d" o={0.55} e="#ef4444" ei={0.35} />
      <Box p={[0.75, 0.98, -1.06]} s={[0.22, 0.28, 0.02]} c="#111827" e="#ec4899" ei={0.6} />
      <group position={[0, 0.86, -1.6]}><mesh ref={dot}><sphereGeometry args={[0.02, 8, 8]} /><meshBasicMaterial color="#ff3b3b" /></mesh></group>
      <Cyl p={[0.6, 2.0, -1.9]} r={0.1} h={2.0} c="#9ca3af" m={0.8} ro={0.4} />
      <Box p={[0.6, 1.05, -1.9]} s={[0.34, 0.08, 0.34]} c="#4b5563" m={0.8} />
      <Box p={[-1.4, 0.4, -1.5]} s={[0.5, 0.8, 0.5]} c="#374151" m={0.5} />
      <Box p={[-1.4, 0.84, -1.5]} s={[0.45, 0.06, 0.45]} c="#d4a373" r={0.7} m={0} />
    </group>
  );
}

function OpenBench({ flip }) {
  const tools = ['#ef4444', '#3b82f6', '#eab308', '#9ca3af', '#22c55e'];
  return (
    <group>
      <Box p={[0, 1.55, -2.55]} s={[3.3, 1.3, 0.04]} c="#2b303c" m={0.4} r={0.6} />
      {Array.from({ length: 11 }, (_, k) => <Box key={k} p={[-1.4 + k * 0.28, 1.55 + ((k * 7) % 5) * 0.1 - 0.2, -2.5]} s={[0.05, 0.3 + (k % 3) * 0.1, 0.03]} c={tools[(k + (flip ? 2 : 0)) % tools.length]} m={0.6} r={0.4} />)}
      <Box p={[1.3, 0.45, -1.8]} s={[0.7, 0.9, 0.45]} c={flip ? '#2563eb' : '#dc2626'} m={0.35} r={0.45} />
      {[0.25, 0.5, 0.75].map((y) => <Box key={y} p={[1.3, y, -1.57]} s={[0.62, 0.015, 0.01]} c="#111827" />)}
      <Box p={[-1.35, 0.4, -1.9]} s={[0.55, 0.8, 0.4]} c="#475569" m={0.6} />
      <Box p={[-1.35, 0.82, -1.9]} s={[0.5, 0.05, 0.36]} c="#b0825a" r={0.6} m={0.05} />
    </group>
  );
}

const DECOR = {
  a: (p) => <WeldingBay active={p.anyOccupied} />,
  b: () => <PcbStation />,
  c: () => <PrintFarm />,
  d: (p) => <CncBay reserved={p.status === 'reserved'} />,
  e: () => <AssemblyZone />,
  f: () => <LaserZone />,
  g: () => <OpenBench />,
  h: () => <OpenBench flip />,
};

/* ------------------------------------------------------------------ zone (floor, edges, label, decor, benches) */
function Zone({ zone, statusMap, selectedZone, selectedBench, hovered, filter, showPeople, onSelectZone, onSelectBench, onHover }) {
  const g = zoneGeom(zone);
  const benches = benchesOf(zone);
  const st = zoneStatusFrom(zone, statusMap);
  const selected = selectedZone === zone.id;
  const lit = selected || hovered;
  const match = filter === 'all' || benches.some((b) => statusMap[b.label] === filter);
  const dimmed = !match || (!!selectedZone && !selected);
  const edge = (w, d, x, z) => (
    <mesh position={[x, 0.016, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={zone.color} transparent opacity={lit ? 1 : dimmed ? 0.25 : 0.7} />
    </mesh>
  );
  const Decor = DECOR[zone.id];
  return (
    <group position={[g.cx, 0, g.cz]}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={(e) => { e.stopPropagation(); onSelectZone(zone.id); }} onPointerOver={(e) => { e.stopPropagation(); onHover(zone.id); }} onPointerOut={() => onHover(null)}>
        <planeGeometry args={[g.w - 0.1, g.d - 0.1]} />
        <meshStandardMaterial color={zone.color} transparent opacity={selected ? 0.34 : lit ? 0.28 : dimmed ? 0.07 : 0.17} roughness={0.35} metalness={0.15} />
      </mesh>
      {edge(g.w - 0.1, 0.07, 0, -g.d / 2 + 0.05)}
      {edge(g.w - 0.1, 0.07, 0, g.d / 2 - 0.05)}
      {edge(0.07, g.d - 0.1, -g.w / 2 + 0.05, 0)}
      {edge(0.07, g.d - 0.1, g.w / 2 - 0.05, 0)}

      <group>
        {Decor && Decor({ status: st, anyOccupied: benches.some((b) => statusMap[b.label] === 'occupied') })}
        {benches.map((b) => (
          <Bench
            key={b.label} b={b} zone={zone} status={statusMap[b.label]}
            selected={selectedBench === b.label} dimmed={!match} highlight={filter !== 'all' && statusMap[b.label] === filter}
            showPeople={showPeople} onSelectBench={onSelectBench} onHover={onHover}
          />
        ))}
      </group>

    </group>
  );
}

/* ------------------------------------------------------------------ room shell + lighting */
function Room() {
  const win = (x, z, rot) => (
    <group key={`${x}${z}`} position={[x, 2.05, z]} rotation={[0, rot, 0]}>
      <Box s={[2.4, 1.5, 0.04]} c="#07090d" shadow={false} />
      <Box p={[0, 0, 0.025]} s={[2.28, 1.38, 0.02]} c="#cfe3ff" e="#8fb8ff" ei={0.85} m={0} r={0.2} shadow={false} />
      <Box p={[0, 0, 0.04]} s={[0.04, 1.38, 0.02]} c="#07090d" shadow={false} />
      <Box p={[0, 0, 0.04]} s={[2.28, 0.04, 0.02]} c="#07090d" shadow={false} />
    </group>
  );
  return (
    <group>
      <Box p={[0, -0.16, 0]} s={[18.4, 0.3, 13.4]} c="#1a1e27" m={0.15} r={0.55} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[18.2, 13.2]} />
        <meshStandardMaterial color="#232834" roughness={0.38} metalness={0.25} />
      </mesh>
      <Grid position={[0, 0.006, 0]} args={[18.2, 13.2]} cellSize={1.15} cellThickness={0.5} cellColor="#303747" sectionSize={4.6} sectionThickness={0.9} sectionColor="#454e63" fadeDistance={45} fadeStrength={1.5} />

      <Box p={[0, 1.7, -6.5]} s={[18.4, 3.4, 0.2]} c="#10131a" m={0.2} r={0.8} />
      <Box p={[-9.2, 1.7, 0]} s={[0.2, 3.4, 13.4]} c="#10131a" m={0.2} r={0.8} />
      {[-6.8, -3.4, 0, 3.4, 6.8].map((x) => win(x, -6.39, 0))}
      {[-4.2, -1.4, 1.4, 4.2].map((z) => win(-9.09, z, Math.PI / 2))}
      <Box p={[0, 0.2, -6.38]} s={[18.2, 0.07, 0.03]} c="#ff5a1f" e="#ff5a1f" ei={2.2} shadow={false} />
      <Box p={[-9.08, 0.2, 0]} s={[0.03, 0.07, 13.2]} c="#ff5a1f" e="#ff5a1f" ei={2.2} shadow={false} />
    </group>
  );
}

function Lights({ zones }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#b8cfff', '#1b1d26', 0.7]} />
      <directionalLight position={[9, 13, 7]} intensity={2.1} color="#fff1e0" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={11} shadow-camera-bottom={-11} shadow-camera-near={1} shadow-camera-far={40} shadow-bias={-0.0004} shadow-normalBias={0.03} />
      {zones.map((z) => {
        const g = zoneGeom(z);
        return (
          <group key={z.id} position={[g.cx, 0, g.cz]}>
            <Box p={[-0.9, 3.05, 0]} s={[0.35, 0.05, 2.4]} c="#fff7ea" e="#ffe6c4" ei={2.2} shadow={false} />
            <Box p={[0.9, 3.05, 0]} s={[0.35, 0.05, 2.4]} c="#fff7ea" e="#ffe6c4" ei={2.2} shadow={false} />
            <pointLight position={[0, 2.8, 0]} intensity={26} distance={8} decay={2} color="#ffe9d2" />
          </group>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ camera */
export const viewGoal = (view, zone) => {
  if (view === 'top') return { pos: [0, 25, 3.2], target: [0, 0, 0.2] };
  if (view === 'zone' && zone) {
    const g = zoneGeom(zone);
    return { pos: [g.cx + 3.4, 4.4, g.cz + 5.6], target: [g.cx, 0.6, g.cz - 0.2] };
  }
  return { pos: [16.5, 12.5, 18.5], target: [0, 0.2, 0.4] };
};

function CameraRig({ goal, controls, busy }) {
  const camera = useThree((s) => s.camera);
  const gp = useMemo(() => new THREE.Vector3(...goal.pos), [goal]);
  const gt = useMemo(() => new THREE.Vector3(...goal.target), [goal]);
  useEffect(() => { busy.current = true; }, [goal, busy]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || !busy.current) return;
    const k = 1 - Math.exp(-dt * 3.4);
    camera.position.lerp(gp, k);
    c.target.lerp(gt, k);
    c.update();
    if (camera.position.distanceTo(gp) < 0.04 && c.target.distanceTo(gt) < 0.04) busy.current = false;
  });
  return null;
}

function Cursor({ active }) {
  useCursor(active);
  return null;
}

/* ------------------------------------------------------------------ DOM label layer
   Labels are plain React DOM (not drei <Html>, which nests a React root and breaks under StrictMode).
   A tiny projector updates each label's screen position every frame. */
function LabelProjector({ items, nodes }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    items.forEach((it) => {
      const el = nodes.current[it.id];
      if (!el) return;
      v.set(it.pos[0], it.pos[1], it.pos[2]);
      const scale = Math.min(1.1, Math.max(0.62, 22 / camera.position.distanceTo(v)));
      v.project(camera);
      if (v.z > 1) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      el.style.zIndex = String(Math.round((1 - v.z) * 10000));
    });
  });
  return null;
}

/* ------------------------------------------------------------------ exported scene */
export default function FloorScene({ zones, statusMap, selectedZone, selectedBench, hoverZone, filter, view, nonce, showLabels, showPeople, onSelectZone, onSelectBench, onHover }) {
  const controls = useRef();
  const busy = useRef(true);
  const nodes = useRef({});
  const zone = zones.find((z) => z.id === selectedZone);
  const goal = useMemo(() => viewGoal(view, zone), [view, zone, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = viewGoal('overview');

  // Everything that needs a floating label: zone pills, plus tags on the benches of the selected zone.
  const items = [];
  const pills = [];
  zones.forEach((z) => {
    const g = zoneGeom(z);
    const benches = benchesOf(z);
    const st = zoneStatusFrom(z, statusMap);
    const selected = selectedZone === z.id;
    const match = filter === 'all' || benches.some((b) => statusMap[b.label] === filter);
    const dimmed = !match || (!!selectedZone && !selected);
    if (showLabels) {
      items.push({ id: 'z' + z.id, pos: [g.cx, 2.55, g.cz] });
      pills.push(
        <div key={'z' + z.id} ref={(el) => { nodes.current['z' + z.id] = el; }} className="pointer-events-auto absolute left-0 top-0 will-change-transform" style={{ display: 'none' }}>
          <button
            onClick={() => onSelectZone(z.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-left shadow-xl backdrop-blur-md transition ${selected ? 'scale-110 border-white bg-ink-950/90' : dimmed ? 'border-white/10 bg-ink-950/50 opacity-50' : 'border-white/20 bg-ink-950/75 hover:border-white/50'}`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md font-display text-xs font-bold text-white" style={{ background: z.color }}>{z.letter}</span>
            <span className="leading-tight">
              <span className="block font-display text-[11px] font-bold text-white">{z.short}</span>
              <span className="block text-[10px] font-semibold" style={{ color: BENCH_STATUS_COLOR[st] }}>{BENCH_STATUS_LABEL[st]} · {benches.filter((b) => statusMap[b.label] === 'available').length} free</span>
            </span>
          </button>
        </div>,
      );
    }
    if (selected) {
      benches.forEach((b) => {
        const id = 'b' + b.label;
        items.push({ id, pos: [g.cx + b.x, 1.75, g.cz + b.z] });
        pills.push(
          <div key={id} ref={(el) => { nodes.current[id] = el; }} className="pointer-events-none absolute left-0 top-0 will-change-transform" style={{ display: 'none' }}>
            <div className={`whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold ${selectedBench === b.label ? 'border-white bg-white text-ink-950' : 'border-white/20 bg-ink-950/80 text-white'}`}>{b.label}</div>
          </div>,
        );
      });
    }
  });

  return (
    <div className="relative h-full w-full">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: start.pos, fov: 34, near: 0.1, far: 140 }} gl={{ antialias: true, powerPreference: 'high-performance' }} onPointerMissed={() => onSelectZone(null)}>
        <color attach="background" args={['#07090d']} />
        <fog attach="fog" args={['#07090d', 32, 70]} />
        <Lights zones={zones} />
        <Room />
        <ContactShadows position={[0, 0.02, 0]} scale={22} opacity={0.5} blur={2.6} far={4.5} resolution={1024} frames={1} />
        {zones.map((z) => (
          <Zone
            key={z.id} zone={z} statusMap={statusMap} selectedZone={selectedZone} selectedBench={selectedBench} hovered={hoverZone === z.id}
            filter={filter} showPeople={showPeople} onSelectZone={onSelectZone} onSelectBench={onSelectBench} onHover={onHover}
          />
        ))}
        <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={3.5} maxDistance={34} maxPolarAngle={Math.PI / 2.05} target={start.target} onStart={() => { busy.current = false; }} />
        <CameraRig goal={goal} controls={controls} busy={busy} />
        <LabelProjector items={items} nodes={nodes} />
        <Cursor active={!!hoverZone} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">{pills}</div>
    </div>
  );
}
