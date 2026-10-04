import type { DamageType } from '../types/game';

export interface Damageable {
  hp: number;
  readonly armor: number;
  readonly magicResistance: number;
}

const clampPercent = (v: number): number =>
  Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;

// Physical Final = max(1, Damage x (1 - Armor/100))
export function calcPhysical(damage: number, armor: number): number {
  return Math.max(1, damage * (1 - clampPercent(armor) / 100));
}

// Magic Final = Damage x (1 - (MagicResistance - Penetration)/100)
export function calcMagic(damage: number, resistance: number, penetration = 0): number {
  const effective = Math.max(0, clampPercent(resistance) - clampPercent(penetration));
  return damage * (1 - effective / 100);
}

export function dealDamage(
  target: Damageable,
  damage: number,
  type: DamageType,
  penetration = 0,
): number {
  if (!Number.isFinite(damage) || damage <= 0) return 0;
  const final =
    type === 'physical'
      ? calcPhysical(damage, target.armor)
      : calcMagic(damage, target.magicResistance, penetration);
  target.hp -= final;
  return final;
}
