/**
 * data/visuals.ts — Visual parameters and styling for procedural rendering
 * of distinct enemies, towers, soldiers, and status visuals.
 */

export interface EnemyVisualConfig {
  bodyColor: string;
  accentColor: string;
  radius: number;
  features: 'goblin' | 'wolf' | 'orc' | 'knight' | 'mage' | 'healer' | 'bat' | 'boss';
}

export const ENEMY_VISUALS: Record<string, EnemyVisualConfig> = {
  goblin: {
    bodyColor: '#38a169',
    accentColor: '#22543d',
    radius: 12,
    features: 'goblin',
  },
  wolf: {
    bodyColor: '#718096',
    accentColor: '#2d3748',
    radius: 13,
    features: 'wolf',
  },
  orc: {
    bodyColor: '#48bb78',
    accentColor: '#742a2a',
    radius: 17,
    features: 'orc',
  },
  knight: {
    bodyColor: '#4299e1',
    accentColor: '#edf2f7',
    radius: 16,
    features: 'knight',
  },
  darkMage: {
    bodyColor: '#805ad5',
    accentColor: '#d6bcfa',
    radius: 14,
    features: 'mage',
  },
  healer: {
    bodyColor: '#ecc94b',
    accentColor: '#48bb78',
    radius: 14,
    features: 'healer',
  },
  bat: {
    bodyColor: '#4a5568',
    accentColor: '#9f7aea',
    radius: 11,
    features: 'bat',
  },
  stoneLord: {
    bodyColor: '#4a5568',
    accentColor: '#dd6b20',
    radius: 32,
    features: 'boss',
  },
};

export interface TowerVisualConfig {
  baseColor: string;
  roofColor: string;
  accentColor: string;
  name: string;
}

export const TOWER_VISUALS: Record<string, TowerVisualConfig> = {
  archer: {
    baseColor: '#8c6239',
    roofColor: '#276749',
    accentColor: '#68d391',
    name: 'Archer Tower',
  },
  barracks: {
    baseColor: '#718096',
    roofColor: '#742a2a',
    accentColor: '#e2e8f0',
    name: 'Barracks',
  },
  mage: {
    baseColor: '#4a5568',
    roofColor: '#553c9a',
    accentColor: '#b794f4',
    name: 'Mage Tower',
  },
  artillery: {
    baseColor: '#4a5568',
    roofColor: '#c05621',
    accentColor: '#fbd38d',
    name: 'Artillery',
  },
};
