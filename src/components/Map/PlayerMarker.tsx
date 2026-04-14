import React from 'react';
import type { Position } from '../../types';

interface PlayerMarkerProps {
  position: Position;
}

const PlayerMarker: React.FC<PlayerMarkerProps> = ({ position }) => {
  return (
    <div
      className="absolute w-[32px] h-[32px] bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-lg z-10"
      style={{
        left: position.x - 16,
        top: position.y - 16,
        transform: 'translate(0, 0)'
      }}
    >
      P
    </div>
  );
};

export default PlayerMarker;