import React, { useEffect } from 'react';
import type { Marker } from '../../types';
import { useDialogueStore } from '../../store/dialogueStore';
import { usePlayerStore } from '../../store/playerStore';
import { useScriptStore } from '../../store/scriptStore';

interface NpcMarkerProps {
  marker: Marker;
}

const NpcMarker: React.FC<NpcMarkerProps> = ({ marker }) => {
  const { position } = usePlayerStore();
  const { openLLMDialogue, updateInRange } = useDialogueStore();

  // 检查是否在交互范围内
  const distance = Math.sqrt(
    Math.pow(position.x - marker.x, 2) + Math.pow(position.y - marker.y, 2)
  );
  const inRange = distance < 50;

  // 当玩家与 NPC 距离变化时，更新 inRange 状态
  useEffect(() => {
    updateInRange(marker.id, inRange);
  }, [inRange, marker.id]);

  const handleClick = () => {
    if (inRange && marker.interactable) {
      const npcSystemPrompt = useScriptStore.getState().getNpcSystemPrompt(marker.id);
      openLLMDialogue(marker.id, marker.name || 'NPC', npcSystemPrompt || undefined);
    }
  };

  return (
    <div
      className={`absolute w-[32px] h-[32px] bg-yellow-500 rounded border-2 ${
        inRange ? 'border-green-400 cursor-pointer' : 'border-yellow-300'
      } flex items-center justify-center text-white text-xs font-bold shadow`}
      style={{
        left: marker.x - 16,
        top: marker.y - 16,
      }}
      onClick={handleClick}
      title={marker.name}
    >
      N
    </div>
  );
};

export default NpcMarker;
