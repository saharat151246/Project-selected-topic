import { Enemy } from '../entities/Enemy';
import type { EnemyConfig, EnemyTypeId, Point } from '../types/game';

export class EnemySystem {
  enemies: Enemy[] = [];
  private nextId = 1;
  private hpMultiplier = 1.0;
  private damageMultiplier = 1.0;

  constructor(
    private readonly path: readonly Point[],
    private readonly configs: Record<EnemyTypeId, EnemyConfig>,
    private readonly enabled: boolean,
  ) {}

  setDifficultyMultipliers(hpMult: number, damageMult: number): void {
    this.hpMultiplier = Number.isFinite(hpMult) && hpMult > 0 ? hpMult : 1.0;
    this.damageMultiplier = Number.isFinite(damageMult) && damageMult > 0 ? damageMult : 1.0;
  }

  reset(): void {
    this.enemies = [];
    this.nextId = 1;
  }

  // ปล่อย Enemy ตามประเภทที่ระบุ
  spawn(type: EnemyTypeId): Enemy | null {
    if (!this.enabled || !this.path || this.path.length === 0) return null;

    const config = this.configs[type];
    if (!config) {
      console.warn(`[Game Warning] Unknown enemy type: ${String(type)}`);
      return null;
    }

    const maxHp = Math.max(1, Math.round(config.hp * this.hpMultiplier));
    const baseDamage = Math.max(1, Math.round(config.baseDamage * this.damageMultiplier));
    const meleeDamage = Math.round(config.meleeDamage * this.damageMultiplier);

    const enemy = new Enemy(
      this.nextId++,
      config,
      this.path[0],
      this.path,
      maxHp,
      baseDamage,
      meleeDamage,
    );
    this.enemies.push(enemy);
    return enemy;
  }

  // ปล่อย Enemy ที่ตำแหน่งเฉพาะ (ใช้สำหรับ Boss Summon)
  spawnAt(
    type: EnemyTypeId,
    x: number,
    y: number,
    waypointIndex: number,
    distanceTravelled: number,
  ): Enemy | null {
    if (!this.enabled || !this.path || this.path.length === 0) return null;

    const config = this.configs[type];
    if (!config) {
      console.warn(`[Game Warning] Unknown enemy type: ${String(type)}`);
      return null;
    }

    const maxHp = Math.max(1, Math.round(config.hp * this.hpMultiplier));
    const baseDamage = Math.max(1, Math.round(config.baseDamage * this.damageMultiplier));
    const meleeDamage = Math.round(config.meleeDamage * this.damageMultiplier);

    const enemy = new Enemy(
      this.nextId++,
      config,
      { x, y },
      this.path,
      maxHp,
      baseDamage,
      meleeDamage,
    );
    enemy.waypointIndex = waypointIndex;
    enemy.distanceTravelled = distanceTravelled;
    enemy.progress = Math.min(1, distanceTravelled / enemy.totalPathLength);
    this.enemies.push(enemy);
    return enemy;
  }

  // ขั้นที่ 1: เคลื่อนที่ Enemy (Enemy ที่ถูก Block หรือ Stun จะหยุดเอง)
  move(dt: number): void {
    if (!this.enabled || !Number.isFinite(dt) || dt <= 0) return;

    for (const enemy of this.enemies) {
      enemy.update(dt, this.path);
    }
  }

  // ขั้นที่ 2: Remove Enemy ที่ตายหรือถึง Castle
  // กฎ: ถ้า Enemy HP <= 0 และถึง Castle ในเฟรมเดียวกัน ให้นับว่าตาย (ไม่นับ Escaped)
  resolve(onDeath: (enemy: Enemy) => void, onReachBase: (enemy: Enemy) => void): void {
    const alive: Enemy[] = [];

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        enemy.removed = true;
        enemy.blocked = false;
        onDeath(enemy);
      } else if (enemy.reachedBase) {
        enemy.removed = true;
        enemy.blocked = false;
        onReachBase(enemy);
      } else {
        alive.push(enemy);
      }
    }

    this.enemies = alive;
  }
}
