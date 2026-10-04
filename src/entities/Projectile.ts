import type { DamageType, ProjectileKind, StatusApplication } from '../types/game';
import type { Enemy } from './Enemy';

export interface ProjectileInit {
  kind: ProjectileKind;
  x: number;
  y: number;
  speed: number;
  target: Enemy;
  damage: number;
  damageType: DamageType;
  splashRadius: number;
  magicPenetration: number;
  hitsFlying: boolean;
  crit: boolean;
  effects?: StatusApplication[];
}

const MAX_AGE = 6; // วินาที กัน Projectile ค้าง

export class Projectile {
  x = 0;
  y = 0;
  angle = 0;
  target: Enemy | null = null;
  private tx = 0;
  private ty = 0;
  private age = 0;
  kind: ProjectileKind = 'arrow';
  speed = 0;
  damage = 0;
  damageType: DamageType = 'physical';
  splashRadius = 0;
  magicPenetration = 0;
  hitsFlying = false;
  crit = false;
  effects?: StatusApplication[];

  constructor(init: ProjectileInit) {
    this.reinit(init);
  }

  reinit(init: ProjectileInit | Projectile): void {
    this.kind = init.kind;
    this.x = init.x;
    this.y = init.y;
    this.angle = 0;
    this.speed = init.speed;
    this.target = init.target;
    this.tx = init.target ? init.target.x : init.x;
    this.ty = init.target ? init.target.y : init.y;
    this.age = 0;
    this.damage = init.damage;
    this.damageType = init.damageType;
    this.splashRadius = init.splashRadius;
    this.magicPenetration = init.magicPenetration;
    this.hitsFlying = init.hitsFlying;
    this.crit = init.crit;
    this.effects = init.effects;
  }

  clear(): void {
    this.target = null;
    this.effects = undefined;
    this.age = 0;
  }

  // คืน 'hit' เมื่อถึงจุดหมาย, 'expired' เมื่อหมดอายุ, 'flying' เมื่อยังบินอยู่
  update(dt: number): 'flying' | 'hit' | 'expired' {
    this.age += dt;
    if (this.age > MAX_AGE) return 'expired';

    // Target ตายหรือถูก Remove แล้ว → บินไปตำแหน่งสุดท้ายที่รู้
    if (this.target && !this.target.isActive) this.target = null;
    if (this.target) {
      this.tx = this.target.x;
      this.ty = this.target.y;
    }

    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (dist <= step || dist < 0.001) {
      this.x = this.tx;
      this.y = this.ty;
      return 'hit';
    }
    this.angle = Math.atan2(dy, dx);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    return 'flying';
  }
}
