import type { ActiveStatusEffect, EnemyConfig, Point } from '../types/game';
import type { Soldier } from './Soldier';

export class Enemy {
  x: number;
  y: number;
  hp: number;
  waypointIndex = 1; // path[0] คือจุด Spawn
  distanceTravelled = 0; // ระยะทางสะสมที่เคลื่อนที่ได้
  progress = 0; // 0 - 1 สำหรับ Target Priority First / Last
  totalPathLength = 1;
  reachedBase = false;
  removed = false;
  blocked = false; // true = กำลังสู้กับ Soldier หยุดเดิน
  engagedBy: Soldier | null = null; // Soldier ที่จองตัวนี้ไว้ (1 ต่อ 1)
  attackCooldown = 0;

  // Status Effects & Abilities
  speedMultiplier = 1.0;
  phaseSpeedMultiplier = 1.0;
  armorBonus = 0;
  isStunned = false;
  statusEffects: ActiveStatusEffect[] = [];
  abilityCooldowns: number[] = [];

  readonly maxHp: number;
  readonly baseDamage: number;
  readonly meleeDamage: number;

  constructor(
    readonly id: number,
    readonly config: EnemyConfig,
    start: Point,
    path: readonly Point[] = [],
    maxHp?: number,
    baseDamage?: number,
    meleeDamage?: number,
  ) {
    this.x = start.x;
    this.y = start.y;
    this.maxHp = maxHp !== undefined ? maxHp : config.hp;
    this.hp = this.maxHp;
    this.baseDamage = baseDamage !== undefined ? baseDamage : config.baseDamage;
    this.meleeDamage = meleeDamage !== undefined ? meleeDamage : config.meleeDamage;
    this.calculateTotalPathLength(path, start);

    this.abilityCooldowns = config.abilities.map((ability) => ability.interval);
  }

  private calculateTotalPathLength(path: readonly Point[], start: Point): void {
    if (!path || path.length < 2) {
      this.totalPathLength = 1;
      return;
    }

    if (this.config.flying) {
      const end = path[path.length - 1];
      this.totalPathLength = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
    } else {
      let total = 0;
      for (let i = 0; i < path.length - 1; i += 1) {
        total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
      }
      this.totalPathLength = Math.max(1, total);
    }
  }

  get armor(): number {
    return Math.max(0, Math.min(100, this.config.armor + this.armorBonus));
  }

  get magicResistance(): number {
    return this.config.magicResistance;
  }

  get isActive(): boolean {
    return this.hp > 0 && !this.reachedBase && !this.removed;
  }

  update(dt: number, path: readonly Point[]): void {
    if (this.hp <= 0 || this.reachedBase || this.blocked || this.isStunned || !Number.isFinite(dt) || dt <= 0) return;

    const currentSpeed = this.config.speed * this.phaseSpeedMultiplier * this.speedMultiplier;
    let remaining = currentSpeed * dt;

    if (this.config.flying) {
      // Flying เดินเส้นตรงจาก path[0] ไปจุดสุดท้ายของ Path
      const target = path[path.length - 1];
      if (!target) {
        this.reachedBase = true;
        this.progress = 1;
        return;
      }

      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= remaining || dist < 0.001) {
        this.x = target.x;
        this.y = target.y;
        this.distanceTravelled += dist;
        this.reachedBase = true;
        this.progress = 1;
      } else {
        this.x += (dx / dist) * remaining;
        this.y += (dy / dist) * remaining;
        this.distanceTravelled += remaining;
        this.progress = Math.min(1, this.distanceTravelled / this.totalPathLength);
      }
      return;
    }

    // Ground: เดินตาม Waypoint
    while (remaining > 0) {
      const target = path[this.waypointIndex];
      if (!target) {
        this.reachedBase = true;
        this.progress = 1;
        return;
      }

      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= remaining) {
        this.x = target.x;
        this.y = target.y;
        this.distanceTravelled += dist;
        remaining -= dist;
        this.waypointIndex += 1;
        if (this.waypointIndex >= path.length) {
          this.reachedBase = true;
          this.progress = 1;
          return;
        }
      } else {
        this.x += (dx / dist) * remaining;
        this.y += (dy / dist) * remaining;
        this.distanceTravelled += remaining;
        remaining = 0;
      }
    }

    this.progress = Math.min(1, this.distanceTravelled / this.totalPathLength);
  }
}
