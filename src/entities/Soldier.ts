import { dealDamage } from '../game/CombatSystem';
import { eventBus } from '../game/EventBus';
import type { DamageType, Point, SoldierConfig } from '../types/game';
import type { Enemy } from './Enemy';

export type SoldierState = 'idle' | 'returning' | 'chasing' | 'fighting' | 'dead';

// Enemy ที่ออกนอกรัศมีนี้ (เทียบกับ rallyRadius) Soldier จะเลิกไล่
const LEASH = 1.6;

export class Soldier {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  armor: number;
  readonly magicResistance = 0;
  radius: number;
  state: SoldierState = 'returning';
  target: Enemy | null = null;
  private attackCooldown = 0;
  private respawnTimer = 0;

  constructor(
    private config: SoldierConfig,
    private readonly origin: Point, // ตำแหน่ง Tower (จุดเกิด)
    private readonly rally: Point,
    private rallyRadius: number,
    private respawnDelay: number,
    private post: Point, // ตำแหน่งยืนประจำของตัวนี้
  ) {
    this.x = origin.x;
    this.y = origin.y;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.armor = config.armor;
    this.radius = config.radius;
  }

  get isAlive(): boolean {
    return this.state !== 'dead';
  }

  upgradeStats(
    newConfig: SoldierConfig,
    rallyRadius: number,
    respawnDelay: number,
    newPost?: Point,
  ): void {
    this.config = newConfig;
    this.maxHp = newConfig.hp;
    this.armor = newConfig.armor;
    this.radius = newConfig.radius;
    this.rallyRadius = rallyRadius;
    this.respawnDelay = respawnDelay;
    if (newPost) this.post = newPost;

    if (this.state !== 'dead') {
      this.hp = this.maxHp; // ทหารที่มีชีวิตได้ HP เต็ม
    }
  }

  cleanup(): void {
    this.releaseTarget();
    this.state = 'dead';
    this.hp = 0;
  }

  takeDamage(amount: number, type: DamageType = 'physical'): void {
    if (this.state === 'dead' || this.hp <= 0) return;
    const damage = dealDamage(this, amount, type);
    if (damage > 0) {
      eventBus.emit('soldier:hit', { x: this.x, y: this.y, damage, damageType: type });
    }
    if (this.hp <= 0) {
      this.die();
    }
  }

  update(dt: number, enemies: readonly Enemy[]): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    if (this.state === 'dead') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.revive();
      return;
    }

    if (this.target && !this.isTargetValid()) this.releaseTarget();

    if (this.state === 'fighting') {
      this.fight(dt);
    } else if (this.state === 'chasing') {
      this.chase(dt);
    } else {
      this.idleOrReturn(dt, enemies);
    }
  }

  private isTargetValid(): boolean {
    const t = this.target;
    if (!t || !t.isActive || t.engagedBy !== this) return false;
    if (this.state === 'chasing') {
      const d = Math.hypot(t.x - this.rally.x, t.y - this.rally.y);
      if (d > this.rallyRadius * LEASH) return false;
    }
    return true;
  }

  releaseTarget(): void {
    const t = this.target;
    if (t && t.engagedBy === this) {
      t.engagedBy = null;
      t.blocked = false;
    }
    this.target = null;
    if (this.state !== 'dead') this.state = 'returning';
  }

  private die(): void {
    const x = this.x;
    const y = this.y;
    this.releaseTarget();
    this.hp = 0;
    this.state = 'dead';
    this.respawnTimer = this.respawnDelay;
    eventBus.emit('soldier:death', { x, y });
  }

  private revive(): void {
    this.hp = this.maxHp;
    this.x = this.origin.x;
    this.y = this.origin.y;
    this.attackCooldown = 0;
    this.state = 'returning';
  }

  private idleOrReturn(dt: number, enemies: readonly Enemy[]): void {
    if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.config.regen * dt);
    }

    const found = this.findTarget(enemies);
    if (found) {
      this.target = found;
      found.engagedBy = this;
      this.state = 'chasing';
      return;
    }

    if (this.moveToward(this.post.x, this.post.y, dt)) {
      this.state = 'idle';
    } else {
      this.state = 'returning';
    }
  }

  private findTarget(enemies: readonly Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (!e.isActive || e.config.flying || e.engagedBy) continue;
      if (Math.hypot(e.x - this.rally.x, e.y - this.rally.y) > this.rallyRadius) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  private chase(dt: number): void {
    const t = this.target;
    if (!t) {
      this.state = 'returning';
      return;
    }
    const contact = this.radius + t.config.radius + 2;
    const dist = Math.hypot(t.x - this.x, t.y - this.y);
    if (dist <= contact) {
      this.state = 'fighting';
      t.blocked = true; // Enemy หยุดเดิน
      return;
    }
    this.moveToward(t.x, t.y, dt);
  }

  private fight(dt: number): void {
    const t = this.target;
    if (!t) {
      this.state = 'returning';
      return;
    }

    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      const damage = dealDamage(t, this.config.damage, 'physical');
      if (damage > 0) {
        eventBus.emit('enemy:hit', {
          enemyId: t.id,
          x: t.x,
          y: t.y,
          damage,
          crit: false,
          damageType: 'physical',
        });
      }
      this.attackCooldown = 1 / this.config.attackSpeed;
    }

    if (!t.isActive) {
      this.releaseTarget();
      return;
    }

    // ศัตรูที่ถูก Stun จะไม่โจมตี Soldier (attackCooldown ไม่ลด)
    if (!t.isStunned) {
      t.attackCooldown -= dt;
      if (t.attackCooldown <= 0) {
        this.takeDamage(t.config.meleeDamage, 'physical');
        t.attackCooldown = 1 / t.config.attackSpeed;
      }
    }

    if (this.hp <= 0) this.die();
  }

  // คืน true เมื่อถึงจุดหมายแล้ว
  private moveToward(tx: number, ty: number, dt: number): boolean {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.config.speed * dt;
    if (dist <= step || dist < 0.001) {
      this.x = tx;
      this.y = ty;
      return true;
    }
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    return false;
  }
}
