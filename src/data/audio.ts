/**
 * data/audio.ts — Audio configuration, throttle intervals, sound priorities,
 * and generative music scales/patterns for Web Audio synthesizer.
 */

export interface SoundMeta {
  minIntervalMs: number;
  priority: number; // Higher number = higher priority (won't be dropped easily)
}

export const SOUND_META: Record<string, SoundMeta> = {
  uiClick: { minIntervalMs: 30, priority: 10 },
  towerBuild: { minIntervalMs: 50, priority: 7 },
  towerUpgrade: { minIntervalMs: 50, priority: 7 },
  towerSell: { minIntervalMs: 50, priority: 7 },
  arrowShot: { minIntervalMs: 60, priority: 3 },
  magicShot: { minIntervalMs: 50, priority: 4 },
  cannonShot: { minIntervalMs: 70, priority: 5 },
  impactHit: { minIntervalMs: 45, priority: 2 },
  explosion: { minIntervalMs: 90, priority: 6 },
  enemyDeath: { minIntervalMs: 80, priority: 5 },
  soldierHit: { minIntervalMs: 50, priority: 3 },
  soldierDeath: { minIntervalMs: 60, priority: 6 },
  lifeLost: { minIntervalMs: 100, priority: 8 },
  waveStart: { minIntervalMs: 200, priority: 8 },
  waveComplete: { minIntervalMs: 200, priority: 8 },
  bossWarning: { minIntervalMs: 300, priority: 10 },
  bossPhase: { minIntervalMs: 300, priority: 9 },
  bossDeath: { minIntervalMs: 300, priority: 10 },
  bossAreaTelegraph: { minIntervalMs: 200, priority: 8 },
  bossAreaImpact: { minIntervalMs: 200, priority: 9 },
  victory: { minIntervalMs: 500, priority: 10 },
  defeat: { minIntervalMs: 500, priority: 10 },
  notEnoughGold: { minIntervalMs: 150, priority: 7 },
};

export const DEFAULT_SOUND_META: SoundMeta = {
  minIntervalMs: 50,
  priority: 3,
};

// Generative Music Definitions
export type MusicTrackId = 'menu' | 'battle' | 'boss';

export interface MusicPattern {
  bpm: number;
  scale: number[]; // Frequencies in Hz
  bassNotes: number[]; // Bassline note indices
  melodyNotes: number[]; // Melody note indices
  chords: number[][]; // Triads / chords
}

// Pentatonic / modal scales for clean synthetic playback
export const MUSIC_PATTERNS: Record<MusicTrackId, MusicPattern> = {
  menu: {
    bpm: 96,
    // C Major Pentatonic (C4, D4, E4, G4, A4, C5)
    scale: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
    bassNotes: [130.81, 146.83, 164.81, 196.0], // C3, D3, E3, G3
    melodyNotes: [0, 2, 4, 3, 2, 1, 3, 0],
    chords: [
      [261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
    ],
  },
  battle: {
    bpm: 124,
    // D Minor Pentatonic (D3, F3, G3, A3, C4, D4)
    scale: [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0],
    bassNotes: [73.42, 87.31, 98.0, 110.0], // D2, F2, G2, A2
    melodyNotes: [0, 3, 2, 5, 4, 2, 3, 1, 0, 4, 5, 3, 2, 1, 0, 2],
    chords: [
      [146.83, 174.61, 220.0],
      [130.81, 164.81, 196.0],
      [116.54, 146.83, 174.61],
      [110.0, 138.59, 164.81],
    ],
  },
  boss: {
    bpm: 138,
    // E Phrygian / Heavy Minor (E2, F2, G2, A2, B2, C3, D3, E3)
    scale: [82.41, 87.31, 98.0, 110.0, 123.47, 130.81, 146.83, 164.81],
    bassNotes: [41.2, 43.65, 49.0, 55.0], // E1, F1, G1, A1
    melodyNotes: [0, 1, 0, 3, 2, 0, 4, 3, 1, 2, 0, 5, 4, 2, 1, 0],
    chords: [
      [82.41, 98.0, 123.47],
      [87.31, 110.0, 130.81],
      [73.42, 98.0, 116.54],
      [82.41, 103.83, 123.47],
    ],
  },
};
