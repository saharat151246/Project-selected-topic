/**
 * Animation — Pure functions for procedural unit and tower animations.
 * Completely stateless and side-effect free.
 */

import { CosmeticRng } from './CosmeticRng';

const cosmeticRng = new CosmeticRng(42);

export interface Pose {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  tilt: number; // in radians
  alpha: number;
  flash: boolean;
}

export function defaultPose(): Pose {
  return {
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    tilt: 0,
    alpha: 1,
    flash: false,
  };
}

/**
 * Enemy Animation Pose
 * @param state 'walk' | 'idle' | 'attack' | 'hit' | 'death'
 * @param phase travel distance or cycle time
 * @param progress 0..1 for momentary animations like hit or attack
 */
export function getEnemyPose(
  state: 'walk' | 'idle' | 'attack' | 'hit' | 'death',
  phase: number,
  progress = 0,
): Pose {
  switch (state) {
    case 'walk': {
      // Bob and squash rhythm based on distance traveled
      const bob = Math.sin(phase * 0.15);
      return {
        offsetX: 0,
        offsetY: -Math.abs(bob) * 3,
        scaleX: 1 + bob * 0.08,
        scaleY: 1 - bob * 0.08,
        tilt: Math.sin(phase * 0.1) * 0.05,
        alpha: 1,
        flash: false,
      };
    }
    case 'attack': {
      // Thrust forward and recoil
      const lunge = Math.sin(progress * Math.PI);
      return {
        offsetX: lunge * 4,
        offsetY: 0,
        scaleX: 1 + lunge * 0.15,
        scaleY: 1 - lunge * 0.1,
        tilt: lunge * 0.1,
        alpha: 1,
        flash: false,
      };
    }
    case 'hit': {
      return {
        offsetX: (cosmeticRng.next() - 0.5) * 2,
        offsetY: (cosmeticRng.next() - 0.5) * 2,
        scaleX: 0.95,
        scaleY: 1.08,
        tilt: 0,
        alpha: 1,
        flash: true,
      };
    }
    case 'death': {
      // Sink down and fade out
      const p = Math.min(1, Math.max(0, progress));
      return {
        offsetX: 0,
        offsetY: p * 8,
        scaleX: 1 - p * 0.3,
        scaleY: 1 - p * 0.5,
        tilt: p * 0.3,
        alpha: 1 - p,
        flash: false,
      };
    }
    case 'idle':
    default: {
      const breath = Math.sin(phase * 2) * 0.03;
      return {
        offsetX: 0,
        offsetY: -breath * 2,
        scaleX: 1 + breath,
        scaleY: 1 - breath,
        tilt: 0,
        alpha: 1,
        flash: false,
      };
    }
  }
}

/**
 * Soldier Animation Pose
 */
export function getSoldierPose(
  state: 'idle' | 'walk' | 'attack' | 'hit' | 'dead' | 'returning' | 'chasing' | 'fighting',
  time: number,
  attackProgress = 0,
): Pose {
  switch (state) {
    case 'chasing':
    case 'returning':
    case 'walk': {
      const bob = Math.sin(time * 8);
      return {
        offsetX: 0,
        offsetY: -Math.abs(bob) * 2.5,
        scaleX: 1 + bob * 0.06,
        scaleY: 1 - bob * 0.06,
        tilt: bob * 0.08,
        alpha: 1,
        flash: false,
      };
    }
    case 'fighting':
    case 'attack': {
      const swing = Math.sin(attackProgress * Math.PI);
      return {
        offsetX: swing * 3,
        offsetY: 0,
        scaleX: 1 + swing * 0.1,
        scaleY: 1,
        tilt: swing * 0.15,
        alpha: 1,
        flash: false,
      };
    }
    case 'hit': {
      return {
        offsetX: (cosmeticRng.next() - 0.5) * 2,
        offsetY: (cosmeticRng.next() - 0.5) * 2,
        scaleX: 0.95,
        scaleY: 1.05,
        tilt: 0,
        alpha: 1,
        flash: true,
      };
    }
    case 'dead': {
      return {
        offsetX: 0,
        offsetY: 4,
        scaleX: 0.9,
        scaleY: 0.4,
        tilt: 0.2,
        alpha: 0.4,
        flash: false,
      };
    }
    case 'idle':
    default: {
      const breath = Math.sin(time * 3) * 0.02;
      return {
        offsetX: 0,
        offsetY: 0,
        scaleX: 1 + breath,
        scaleY: 1 - breath,
        tilt: 0,
        alpha: 1,
        flash: false,
      };
    }
  }
}
