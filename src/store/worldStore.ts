import { create } from 'zustand';
import type { MapData, Marker } from '../types';

interface WorldState {
  currentMapId: string;
  mapData: MapData | null;
  flags: Record<string, boolean>;
  completedQuests: string[];
  currentDialogueNpc: string | null;

  // Actions
  setCurrentMap: (mapId: string) => void;
  setMapData: (data: MapData) => void;
  setFlag: (key: string, value: boolean) => void;
  completeQuest: (questId: string) => void;
  setCurrentDialogueNpc: (npcId: string | null) => void;
  updateMarker: (markerId: string, updates: Partial<Marker>) => void;
}

// 默认地图数据 - 4:3 比例
const defaultMapData: MapData = {
  id: 'village',
  name: '村庄',
  background: '/assets/maps/village.png',
  width: 1024,
  height: 768,
  markers: [
    {
      id: 'npc_elder',
      type: 'npc',
      x: 300,
      y: 200,
      sprite: '/assets/sprites/elder.png',
      name: '村长',
      interactable: true,
      dialogueId: 'dialogue_elder'
    },
    {
      id: 'door_tavern',
      type: 'door',
      x: 800,
      y: 400,
      name: '酒馆',
      targetMap: 'tavern',
      targetX: 100,
      targetY: 200
    },
    {
      id: 'enemy_goblin',
      type: 'enemy',
      x: 600,
      y: 500,
      sprite: '/assets/sprites/goblin.png',
      name: '哥布林',
      hp: 50,
      maxHp: 50
    }
  ],
  collisions: [
    { type: 'rect', x: 0, y: 0, width: 50, height: 768 }, // 左边界
    { type: 'rect', x: 974, y: 0, width: 50, height: 768 }, // 右边界
    { type: 'rect', x: 0, y: 0, width: 1024, height: 50 }, // 上边界
    { type: 'rect', x: 0, y: 718, width: 1024, height: 50 } // 下边界
  ]
};

export const useWorldStore = create<WorldState>((set) => ({
  currentMapId: 'village',
  mapData: defaultMapData,
  flags: {},
  completedQuests: [],
  currentDialogueNpc: null,

  setCurrentMap: (mapId) => set({ currentMapId: mapId }),
  setMapData: (data) => set({ mapData: data }),
  setFlag: (key, value) => set((state) => ({
    flags: { ...state.flags, [key]: value }
  })),
  completeQuest: (questId) => set((state) => ({
    completedQuests: [...state.completedQuests, questId]
  })),
  setCurrentDialogueNpc: (npcId) => set({ currentDialogueNpc: npcId }),
  updateMarker: (markerId, updates) => set((state) => {
    if (!state.mapData) return state;
    return {
      mapData: {
        ...state.mapData,
        markers: state.mapData.markers.map(m =>
          m.id === markerId ? { ...m, ...updates } : m
        )
      }
    };
  }),
}));