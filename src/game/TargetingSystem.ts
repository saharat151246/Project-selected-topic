import type { Enemy } from '../entities/Enemy';
import type { Point, TargetMode } from '../types/game';

export const TARGET_MODES: ReadonlyArray<{ id: TargetMode; label: string }> = [
  { id: 'first', label: 'First' },
  { id: 'last', label: 'Last' },
  { id: 'strongest', label: 'Strongest' },
  { id: 'weakest', label: 'Weakest' },
  { id: 'closest', label: 'Closest' },
];

export function isTargetMode(value: unknown): value is TargetMode {
  return TARGET_MODES.some((m) => m.id === value);
}

export function selectTarget(
  origin: Point,
  range: number,
  mode: TargetMode,
  enemies: readonly Enemy[],
  includeFlying: boolean,
): Enemy | null {
  let best: Enemy | null = null;
  let bestScore = -Infinity;

  for (const e of enemies) {
    if (!e.isActive) continue;
    if (e.config.flying && !includeFlying) continue;

    const dist = Math.hypot(e.x - origin.x, e.y - origin.y);
    if (dist > range) continue;

    let score: number;
    switch (mode) {
      case 'first':
        score = e.progress; // ใช้ progress (0-1) แทนระยะดิบ
        break;
      case 'last':
        score = -e.progress;
        break;
      case 'strongest':
        score = e.hp;
        break;
      case 'weakest':
        score = -e.hp;
        break;
      case 'closest':
        score = -dist;
        break;
    }

    if (score > bestScore || (score === bestScore && best !== null && e.id < best.id)) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}
