import type { Enemy } from '../entities/Enemy';
import { Tower } from '../entities/Tower';
import { eventBus } from '../game/EventBus';
import type { ProjectileSystem } from '../game/ProjectileSystem';
import type { SpatialGrid } from '../game/SpatialGrid';
import { selectTarget } from '../game/TargetingSystem';
import type { Point, TowerConfig, TowerSpot } from '../types/game';

// คืนข้อความเหตุผลถ้า Config ไม่ถูกต้อง, null ถ้าใช้ได้
export function validateTowerConfig(c: TowerConfig | undefined): string | null {
  if (!c) return 'config is missing';
  if (!Number.isFinite(c.cost) || c.cost < 0) return 'cost must be a non-negative number';
  if (!Array.isArray(c.levels) || c.levels.length === 0) return 'tower must define at least one level';

  const first = c.levels[0];
  const isRanged = Boolean(first.ranged);
  const isBarracks = Boolean(first.barracks);

  if ((isRanged && isBarracks) || (!isRanged && !isBarracks)) {
    return 'tower must define either ranged or barracks stats, not both or neither';
  }

  for (let i = 0; i < c.levels.length; i += 1) {
    const lvl = c.levels[i];
    if (!Number.isFinite(lvl.upgradeCost) || lvl.upgradeCost < 0) {
      return `level ${i + 1} upgradeCost must be a non-negative number`;
    }

    if (isRanged) {
      if (!lvl.ranged || lvl.barracks) {
        return `level ${i + 1} must be ranged and not barracks`;
      }
      const r = lvl.ranged;
      const fields: Array<[string, number]> = [
        ['damage', r.damage],
        ['range', r.range],
        ['attackSpeed', r.attackSpeed],
        ['projectileSpeed', r.projectileSpeed],
      ];
      for (const [name, value] of fields) {
        if (!Number.isFinite(value) || value <= 0) {
          return `level ${i + 1} ${name} must be greater than 0`;
        }
      }
      if (!Number.isFinite(r.splashRadius) || r.splashRadius < 0) {
        return `level ${i + 1} splashRadius must be >= 0`;
      }
      if (!Number.isFinite(r.magicPenetration) || r.magicPenetration < 0) {
        return `level ${i + 1} magicPenetration must be >= 0`;
      }

      if (r.effects) {
        if (!Array.isArray(r.effects)) {
          return `level ${i + 1} effects must be an array`;
        }
        for (const eff of r.effects) {
          if (!eff || !eff.type || !Number.isFinite(eff.duration) || eff.duration <= 0) {
            return `level ${i + 1} effect has invalid duration or type`;
          }
          if (eff.chance !== undefined && (!Number.isFinite(eff.chance) || eff.chance < 0 || eff.chance > 1)) {
            return `level ${i + 1} effect chance must be between 0 and 1`;
          }
        }
      }
    } else {
      if (!lvl.barracks || lvl.ranged) {
        return `level ${i + 1} must be barracks and not ranged`;
      }
      const b = lvl.barracks;
      if (!Number.isInteger(b.soldierCount) || b.soldierCount <= 0) {
        return `level ${i + 1} soldierCount must be a positive integer`;
      }
      if (!Number.isFinite(b.rallyRadius) || b.rallyRadius <= 0) {
        return `level ${i + 1} rallyRadius must be > 0`;
      }
      if (!Number.isFinite(b.respawnDelay) || b.respawnDelay <= 0) {
        return `level ${i + 1} respawnDelay must be > 0`;
      }
      const s = b.soldier;
      if (
        !s ||
        !(s.hp > 0) ||
        !(s.attackSpeed > 0) ||
        !(s.speed > 0) ||
        !(s.damage >= 0) ||
        !(s.armor >= 0) ||
        !(s.regen >= 0)
      ) {
        return `level ${i + 1} soldier stats are invalid`;
      }
    }
  }

  return null;
}

// จุดบน Path ที่ใกล้ตำแหน่ง p ที่สุด (ใช้เป็น Rally Point ของ Barracks)
function closestPointOnPath(path: readonly Point[], p: Point): Point {
  if (path.length < 2) return { x: p.x, y: p.y };
  let best: Point = { x: path[0].x, y: path[0].y };
  let bestDist = Infinity;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < bestDist) {
      bestDist = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

export class TowerSystem {
  towers: Tower[] = [];
  private nextId = 1;

  constructor(private readonly path: readonly Point[]) {}

  reset(): void {
    for (const t of this.towers) {
      t.destroy();
    }
    this.towers = [];
    this.nextId = 1;
  }

  getBySpot(spotId: number): Tower | undefined {
    return this.towers.find((t) => t.spot.id === spotId);
  }

  getById(id: number): Tower | undefined {
    return this.towers.find((t) => t.id === id);
  }

  build(spot: TowerSpot, config: TowerConfig): Tower | null {
    const problem = validateTowerConfig(config);
    if (problem) {
      console.warn(`[Game Warning] Invalid tower data (${config?.id ?? 'unknown'}): ${problem}`);
      return null;
    }
    if (this.getBySpot(spot.id)) return null; // วางทับกันไม่ได้

    const rally = closestPointOnPath(this.path, spot);
    const tower = new Tower(this.nextId, config, spot, rally);
    this.nextId += 1;
    this.towers.push(tower);
    return tower;
  }

  remove(towerId: number): Tower | null {
    const index = this.towers.findIndex((t) => t.id === towerId);
    if (index === -1) return null;
    const tower = this.towers[index];
    tower.destroy();
    this.towers.splice(index, 1);
    return tower;
  }

  update(
    dt: number,
    enemies: readonly Enemy[],
    projectiles: ProjectileSystem,
    enemyGrid?: SpatialGrid<Enemy>,
  ): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    for (const tower of this.towers) {
      for (const soldier of tower.soldiers) soldier.update(dt, enemies);

      tower.cooldown = Math.max(0, tower.cooldown - dt);
      const r = tower.currentRanged;
      if (!r || tower.cooldown > 0) continue;

      const candidates = enemyGrid
        ? enemyGrid.queryRadius(tower.x, tower.y, r.range)
        : enemies;
      const target = selectTarget(tower, r.range, tower.targetMode, candidates, r.targetsFlying);
      if (!target) continue; // ไม่มี Target → ไม่ยิง

      const crit = r.critChance > 0 && Math.random() < r.critChance;
      projectiles.spawn({
        kind: r.projectileKind,
        x: tower.x,
        y: tower.y - 34,
        speed: r.projectileSpeed,
        target,
        damage: r.damage * (crit ? r.critMultiplier : 1),
        damageType: r.damageType,
        splashRadius: r.splashRadius,
        magicPenetration: r.magicPenetration,
        hitsFlying: r.targetsFlying,
        crit,
        effects: r.effects,
      });
      eventBus.emit('tower:fire', { fromX: tower.x, fromY: tower.y - 34, kind: r.projectileKind });
      tower.cooldown = 1 / r.attackSpeed;
    }
  }
}
