import type { MapData } from '../types/game';

export const greenValley: MapData = {
  id: 'green-valley',
  name: 'Green Valley',
  difficulty: 'Easy',
  width: 1280,
  height: 720,
  // Path ต้องมีอย่างน้อย 2 จุด (จุดแรก = Spawn, จุดสุดท้าย = Base)
  path: [
    { x: 40, y: 540 },
    { x: 300, y: 540 },
    { x: 300, y: 200 },
    { x: 620, y: 200 },
    { x: 620, y: 500 },
    { x: 900, y: 500 },
    { x: 900, y: 260 },
    { x: 1130, y: 260 },
  ],
  spawnPoint: { x: 40, y: 540 },
  basePoint: { x: 1130, y: 260 },
  towerSpots: [
    { id: 1, x: 170, y: 455 },
    { id: 2, x: 200, y: 625 },
    { id: 3, x: 385, y: 330 },
    { id: 4, x: 460, y: 115 },
    { id: 5, x: 535, y: 380 },
    { id: 6, x: 760, y: 415 },
    { id: 7, x: 760, y: 585 },
    { id: 8, x: 985, y: 400 },
  ],
  totalWaves: 10,
  starRules: {
    threeStarMinLife: 15,
    threeStarMaxEscaped: 5,
    twoStarMinLife: 8,
  },
};

export const desertOasis: MapData = {
  id: 'desert-oasis',
  name: 'Desert Oasis',
  difficulty: 'Normal',
  width: 1280,
  height: 720,
  path: [
    { x: 40, y: 360 },
    { x: 380, y: 360 },
    { x: 380, y: 160 },
    { x: 780, y: 160 },
    { x: 780, y: 560 },
    { x: 1140, y: 560 },
  ],
  spawnPoint: { x: 40, y: 360 },
  basePoint: { x: 1140, y: 560 },
  towerSpots: [
    { id: 1, x: 200, y: 260 },
    { id: 2, x: 200, y: 460 },
    { id: 3, x: 480, y: 260 },
    { id: 4, x: 680, y: 260 },
    { id: 5, x: 680, y: 460 },
    { id: 6, x: 880, y: 460 },
    { id: 7, x: 880, y: 640 },
    { id: 8, x: 1020, y: 440 },
  ],
  totalWaves: 10,
  starRules: {
    threeStarMinLife: 15,
    threeStarMaxEscaped: 5,
    twoStarMinLife: 8,
  },
};

export const MAP_LIST: MapData[] = [greenValley, desertOasis];

export const MAPS: Record<string, MapData> = {
  'green-valley': greenValley,
  'desert-oasis': desertOasis,
};

