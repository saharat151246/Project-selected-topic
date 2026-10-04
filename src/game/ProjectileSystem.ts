import type { Enemy } from '../entities/Enemy';
import { Projectile, type ProjectileInit } from '../entities/Projectile';
import type { StatusEffectSystem } from '../systems/StatusEffectSystem';
import { dealDamage } from './CombatSystem';
import { eventBus } from './EventBus';
import { ObjectPool } from './ObjectPool';
import type { SpatialGrid } from './SpatialGrid';

export class ProjectileSystem {
  private readonly pool = new ObjectPool<Projectile>(
    () =>
      new Projectile({
        kind: 'arrow',
        x: 0,
        y: 0,
        speed: 0,
        target: null as any,
        damage: 0,
        damageType: 'physical',
        splashRadius: 0,
        magicPenetration: 0,
        hitsFlying: false,
        crit: false,
      }),
    (p) => p.clear(),
    64,
    300,
  );

  get projectiles(): readonly Projectile[] {
    return this.pool.activeItems;
  }

  spawn(p: Projectile | ProjectileInit): Projectile {
    const pooled = this.pool.acquire();
    pooled.reinit(p);
    return pooled;
  }

  reset(): void {
    this.pool.releaseAll();
  }

  update(
    dt: number,
    enemies: readonly Enemy[],
    statusEffectSystem?: StatusEffectSystem,
    enemyGrid?: SpatialGrid<Enemy>,
  ): void {
    if (this.pool.activeCount === 0) return;

    this.pool.updateActive((p) => {
      const result = p.update(dt);
      if (result === 'flying') {
        return true;
      }
      if (result === 'hit') {
        this.impact(p, enemies, statusEffectSystem, enemyGrid);
      }
      // 'hit' or 'expired' -> release back to pool
      return false;
    });
  }

  private impact(
    p: Projectile,
    enemies: readonly Enemy[],
    statusEffectSystem?: StatusEffectSystem,
    enemyGrid?: SpatialGrid<Enemy>,
  ): void {
    if (p.splashRadius > 0) {
      // Emit splash impact event
      eventBus.emit('projectile:impact', { x: p.x, y: p.y, kind: p.kind, splash: true });

      // Use SpatialGrid for O(1) area query if available, otherwise fallback to linear search
      const targets = enemyGrid
        ? enemyGrid.queryRadius(p.x, p.y, p.splashRadius)
        : enemies;

      for (const e of targets) {
        if (!e.isActive) continue;
        if (e.config.flying && !p.hitsFlying) continue;

        if (Math.hypot(e.x - p.x, e.y - p.y) <= p.splashRadius) {
          const dealt = dealDamage(e, p.damage, p.damageType, p.magicPenetration);

          // Emit hit event for VFX
          if (dealt > 0) {
            eventBus.emit('enemy:hit', {
              enemyId: e.id,
              x: e.x,
              y: e.y,
              damage: dealt,
              crit: p.crit,
              damageType: p.damageType,
            });
          }

          // Splash โดนหลายตัว แต่ละตัวสุ่ม chance แยกกัน
          if (statusEffectSystem && p.effects && p.effects.length > 0) {
            for (const eff of p.effects) {
              const chance = eff.chance ?? 1;
              if (Math.random() <= chance) {
                if (statusEffectSystem.applyEffect(e, eff)) {
                  eventBus.emit('status:apply', { x: e.x, y: e.y, type: eff.type });
                }
              }
            }
          }
        }
      }
      return;
    }

    // Single Target: ถ้า Target หายไประหว่างบิน (p.target = null) ไม่ทำอะไร
    if (p.target && p.target.isActive) {
      const dealt = dealDamage(p.target, p.damage, p.damageType, p.magicPenetration);

      eventBus.emit('projectile:impact', { x: p.x, y: p.y, kind: p.kind, splash: false });
      if (dealt > 0) {
        eventBus.emit('enemy:hit', {
          enemyId: p.target.id,
          x: p.target.x,
          y: p.target.y,
          damage: dealt,
          crit: p.crit,
          damageType: p.damageType,
        });
      }

      if (statusEffectSystem && p.effects && p.effects.length > 0) {
        for (const eff of p.effects) {
          const chance = eff.chance ?? 1;
          if (Math.random() <= chance) {
            if (statusEffectSystem.applyEffect(p.target, eff)) {
              eventBus.emit('status:apply', { x: p.target.x, y: p.target.y, type: eff.type });
            }
          }
        }
      }
    }
  }
}
