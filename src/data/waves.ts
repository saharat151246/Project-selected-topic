import type { WaveConfig } from '../types/game';

// Wave 1-10 ตามที่กำหนดใน Phase 4
// เพิ่ม Boss ใน Phase 5 ทำได้โดยเพิ่มกลุ่มในนี้โดยไม่ต้องแก้ WaveManager
export const WAVES: WaveConfig[] = [
  {
    id: 1,
    spawnInterval: 1.6,
    reward: 50,
    enemies: [{ type: 'goblin', count: 5 }],
  },
  {
    id: 2,
    spawnInterval: 1.4,
    reward: 60,
    enemies: [
      { type: 'goblin', count: 8 },
      { type: 'orc', count: 2 },
    ],
  },
  {
    id: 3,
    spawnInterval: 1.2,
    reward: 70,
    enemies: [
      { type: 'goblin', count: 10 },
      { type: 'orc', count: 5 },
      { type: 'wolf', count: 2 },
    ],
  },
  {
    id: 4,
    spawnInterval: 1.0,
    reward: 80,
    enemies: [
      { type: 'wolf', count: 8 },
      { type: 'goblin', count: 6 },
    ],
  },
  {
    id: 5,
    spawnInterval: 1.5,
    reward: 90,
    enemies: [
      { type: 'knight', count: 2 },
      { type: 'goblin', count: 6 },
      { type: 'orc', count: 3 },
    ],
  },
  {
    id: 6,
    spawnInterval: 1.3,
    reward: 100,
    enemies: [
      { type: 'healer', count: 2 },
      { type: 'orc', count: 6 },
      { type: 'wolf', count: 4 },
    ],
  },
  {
    id: 7,
    spawnInterval: 1.1,
    reward: 110,
    enemies: [
      { type: 'bat', count: 8 },
      { type: 'goblin', count: 6 },
    ],
  },
  {
    id: 8,
    spawnInterval: 1.2,
    reward: 120,
    enemies: [
      { type: 'darkMage', count: 4 },
      { type: 'knight', count: 3 },
      { type: 'wolf', count: 6 },
    ],
  },
  {
    id: 9,
    spawnInterval: 1.0,
    reward: 130,
    enemies: [
      { type: 'goblin', count: 10 },
      { type: 'orc', count: 6 },
      { type: 'knight', count: 4 },
      { type: 'healer', count: 3 },
      { type: 'bat', count: 6 },
    ],
  },
  {
    id: 10,
    spawnInterval: 0.9,
    reward: 140,
    enemies: [
      { type: 'goblin', count: 12 },
      { type: 'orc', count: 8 },
      { type: 'knight', count: 5 },
      { type: 'darkMage', count: 4 },
      { type: 'healer', count: 3 },
      { type: 'bat', count: 8 },
      { type: 'wolf', count: 6 },
      { type: 'stoneLord', count: 1 },
    ],
  },
];
