import React from 'react';
import FloorExplorer from '../components/FloorExplorer';

export default function Facility({ onToast }) {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-[1500px] px-5 pb-20 md:px-8">
        <div className="pt-6">
          <h1 className="font-display text-4xl font-bold text-white">Makerspace Floor</h1>
          <p className="mt-1.5 text-sm text-ink-300">Interactive 3D model of the workshop. Pick a zone or a bench to see its equipment and request it.</p>
        </div>
        <FloorExplorer onToast={onToast} />
      </div>
    </div>
  );
}
