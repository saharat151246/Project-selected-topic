import type { DifficultyConfig, DifficultyId } from '../types/game';

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    hpMultiplier: 0.8,
    damageMultiplier: 0.75,
    goldMultiplier: 1.2,
    initialGold: 600,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    hpMultiplier: 1.0,
    damageMultiplier: 1.0,
    goldMultiplier: 1.0,
    initialGold: 500,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    hpMultiplier: 1.25,
    damageMultiplier: 1.5,
    goldMultiplier: 0.85,
    initialGold: 425,
  },
};
