import type { BossConfig, EnemyTypeId } from '../types/game';

export const BOSSES: Partial<Record<EnemyTypeId, BossConfig>> = {
  stoneLord: {
    id: 'stoneLord',
    name: 'Stone Lord',
    phases: [
      {
        name: 'Marching',
        hpThreshold: 1.0,
        message: 'Phase 1: Marching',
      },
      {
        name: 'Enraged',
        hpThreshold: 0.6,
        speedMultiplier: 1.3,
        summons: [{ type: 'orc', count: 2 }],
        message: 'Phase 2: Enraged',
      },
      {
        name: 'Ruin',
        hpThreshold: 0.3,
        armorBonus: 15,
        summons: [{ type: 'goblin', count: 4 }],
        areaAttack: {
          interval: 6,
          telegraph: 1.2,
          radius: 130,
          damage: 70,
          damageType: 'physical',
        },
        message: 'Phase 3: Ruin',
      },
    ],
  },
};
