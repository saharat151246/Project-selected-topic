/**
 * data/effects.ts — Configuration constants for particles, floating damage text,
 * and effects levels (high / low / off).
 */

import type { EffectsLevel } from '../types/save';

export interface EffectsCap {
  maxParticles: number;
  maxFloatingTexts: number;
  trailsEnabled: boolean;
  dotNumbersEnabled: boolean;
  minDamageThreshold: number; // Low level only shows damage >= this threshold or CRIT
}

export const EFFECTS_CONFIG: Record<EffectsLevel, EffectsCap> = {
  high: {
    maxParticles: 400,
    maxFloatingTexts: 40,
    trailsEnabled: true,
    dotNumbersEnabled: true,
    minDamageThreshold: 1,
  },
  low: {
    maxParticles: 150,
    maxFloatingTexts: 20,
    trailsEnabled: false,
    dotNumbersEnabled: false,
    minDamageThreshold: 20, // Only show CRIT or >= 20
  },
  off: {
    maxParticles: 0,
    maxFloatingTexts: 0,
    trailsEnabled: false,
    dotNumbersEnabled: false,
    minDamageThreshold: 999999,
  },
};

export const FLOATING_TEXT_CONFIG = {
  duration: 0.7, // seconds in simTime
  floatSpeed: 28, // pixels per second upward
  mergeWindowMs: 150, // 0.15 seconds merge window for hits on same enemy
  dotIntervalMs: 500, // 0.5 seconds batch interval for DoT
  colors: {
    physical: '#ffffff',
    magic: '#d6bcfa',
    trueDamage: '#faf089',
    crit: '#ecc94b',
    burn: '#ed8936',
    poison: '#48bb78',
  },
};
