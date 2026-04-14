import React, { useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { Marker } from '../../types';
import PlayerMarker from './PlayerMarker';
import NpcMarker from './NpcMarker';
import DoorMarker from './DoorMarker';
import EnemyMarker from './EnemyMarker';

const Map: React.FC = () => {
  const { position, setPosition } = usePlayerStore();
  const { mapData } = useWorldStore();
  const { moveSpeed } = useSettingsStore();

  // 碰撞检测
  const checkCollision = (newX: number, newY: number): boolean => {
    if (!mapData) return true;

    // 边界检查
    if (newX < 0 || newX > mapData.width || newY < 0 || newY > mapData.height) {
      return true;
    }

    // 碰撞区域检查
    for (const collision of mapData.collisions) {
      if (collision.type === 'rect') {
        if (
          newX >= collision.x &&
          newX <= collision.x + collision.width &&
          newY >= collision.y &&
          newY <= collision.y + collision.height
        ) {
          return true;
        }
      } else if (collision.type === 'circle') {
        const dx = newX - collision.x;
        const dy = newY - collision.y;
        if (Math.sqrt(dx * dx + dy * dy) <= collision.radius) {
          return true;
        }
      }
    }

    return false;
  };

  // 键盘移动控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let dx = 0, dy = 0;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          dy = -moveSpeed;
          break;
        case 's':
        case 'arrowdown':
          dy = moveSpeed;
          break;
        case 'a':
        case 'arrowleft':
          dx = -moveSpeed;
          break;
        case 'd':
        case 'arrowright':
          dx = moveSpeed;
          break;
        default:
          return;
      }

      const newX = position.x + dx;
      const newY = position.y + dy;

      if (!checkCollision(newX, newY)) {
        setPosition({ x: newX, y: newY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [position, moveSpeed, setPosition]);

  // 渲染图元
  const renderMarker = (marker: Marker) => {
    switch (marker.type) {
      case 'npc':
        return <NpcMarker key={marker.id} marker={marker} />;
      case 'door':
        return <DoorMarker key={marker.id} marker={marker} />;
      case 'enemy':
        return <EnemyMarker key={marker.id} marker={marker} />;
      default:
        return null;
    }
  };

  if (!mapData) {
    return (
      <div className="w-[1024px] h-[1024px] bg-gray-600 flex items-center justify-center">
        <span className="text-gray-400">加载地图...</span>
      </div>
    );
  }

  return (
    <div className="relative w-[1024px] h-[1024px] overflow-hidden">
      {/* 背景图 */}
      <img
        src={mapData.background}
        alt={mapData.name}
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          // 如果图片加载失败，显示占位背景
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement!.style.backgroundColor = '#3a5a40';
        }}
      />

      {/* 图元层 */}
      <div className="absolute inset-0">
        {mapData.markers.map(renderMarker)}
        <PlayerMarker position={position} />
      </div>
    </div>
  );
};

export default Map;