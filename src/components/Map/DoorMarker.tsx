import React from 'react';
import type { Marker } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

interface DoorMarkerProps {
  marker: Marker;
}

const DoorMarker: React.FC<DoorMarkerProps> = ({ marker }) => {
  const { position, setPosition } = usePlayerStore();

  // 检查是否在交互范围内
  const distance = Math.sqrt(
    Math.pow(position.x - marker.x, 2) + Math.pow(position.y - marker.y, 2)
  );
  const inRange = distance < 30;

  const handleClick = () => {
    if (inRange && marker.targetMap && marker.targetX && marker.targetY) {
      // 传送逻辑
      setPosition({ x: marker.targetX, y: marker.targetY });
      // TODO: 切换地图
    }
  };

  return (
    <div
      className={`absolute w-[32px] h-[32px] bg-purple-600 rounded border-2 ${
        inRange ? 'border-green-400 cursor-pointer animate-pulse' : 'border-purple-400'
      } flex items-center justify-center text-white text-xs font-bold shadow`}
      style={{
        left: marker.x - 16,
        top: marker.y - 16,
      }}
      onClick={handleClick}
      title={marker.name || '传送门'}
    >
      D
    </div>
  );
};

export default DoorMarker;