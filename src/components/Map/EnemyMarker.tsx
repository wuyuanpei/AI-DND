import React from 'react';
import type { Marker } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

interface EnemyMarkerProps {
  marker: Marker;
}

const EnemyMarker: React.FC<EnemyMarkerProps> = ({ marker }) => {
  const { position } = usePlayerStore();

  // 检查是否在交互范围内
  const distance = Math.sqrt(
    Math.pow(position.x - marker.x, 2) + Math.pow(position.y - marker.y, 2)
  );
  const inRange = distance < 40;

  return (
    <div
      className={`absolute w-[32px] h-[32px] bg-red-600 rounded border-2 ${
        inRange ? 'border-yellow-400 animate-pulse' : 'border-red-400'
      } flex items-center justify-center text-white text-xs font-bold shadow`}
      style={{
        left: marker.x - 16,
        top: marker.y - 16,
      }}
      title={marker.name || '敌人'}
    >
      E
    </div>
  );
};

export default EnemyMarker;