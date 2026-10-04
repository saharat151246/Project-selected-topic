import type { Enemy } from '../entities/Enemy';
import { calcMagic } from '../game/CombatSystem';
import { eventBus } from '../game/EventBus';
import type { ActiveStatusEffect, StatusApplication } from '../types/game';
import { FLOATING_TEXT_CONFIG } from '../data/effects';

const DOT_FEEDBACK_INTERVAL = FLOATING_TEXT_CONFIG.dotIntervalMs / 1000;

export class StatusEffectSystem {
  applyEffect(enemy: Enemy, app: StatusApplication): boolean {
    if (!enemy.isActive) return false;

    // ตรวจสอบความถูกต้องของ Effect (ห้าม Crash)
    if (!app || !app.type || !Number.isFinite(app.duration) || app.duration <= 0) {
      console.warn(`[Game Warning] Invalid status effect duration: ${app?.duration}`);
      return false;
    }
    if (app.magnitude !== undefined && (!Number.isFinite(app.magnitude) || app.magnitude < 0)) {
      console.warn(`[Game Warning] Invalid status effect magnitude: ${app.magnitude}`);
      return false;
    }

    // ตรวจสอบ Immunities ของ Enemy
    if (enemy.config.immunities && enemy.config.immunities.includes(app.type)) {
      return false;
    }

    const existing = enemy.statusEffects.find((e) => e.type === app.type);
    if (existing) {
      const newMag = app.magnitude ?? 0;
      const oldMag = existing.magnitude ?? 0;

      // ถ้าชนิดเดียวกัน: ถ้า magnitude ใหม่ > เดิม → แทนที่ทั้ง magnitude และเวลา; ถ้าเท่ากันหรือน้อยกว่า → ต่อเวลาเป็น max(เหลือ, ใหม่)
      if (app.type === 'slow' || app.type === 'burn' || app.type === 'poison') {
        if (newMag > oldMag) {
          existing.magnitude = app.magnitude;
          existing.duration = app.duration;
          existing.remainingDuration = app.duration;
        } else {
          existing.remainingDuration = Math.max(existing.remainingDuration, app.duration);
        }
      } else {
        // stun / freeze
        existing.remainingDuration = Math.max(existing.remainingDuration, app.duration);
      }
    } else {
      enemy.statusEffects.push({
        type: app.type,
        duration: app.duration,
        remainingDuration: app.duration,
        magnitude: app.magnitude,
        pendingDamage: 0,
        feedbackTimer: DOT_FEEDBACK_INTERVAL,
      });
    }
    return true;
  }

  update(dt: number, enemies: readonly Enemy[]): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    for (const enemy of enemies) {
      if (!enemy.isActive) {
        enemy.statusEffects = [];
        continue;
      }

      let slowMult = 1.0;
      let hasFreeze = false;
      let isStunned = false;

      const remainingEffects: ActiveStatusEffect[] = [];

      for (const eff of enemy.statusEffects) {
        eff.remainingDuration -= dt;

        // DoT applies even on the expiring tick
        switch (eff.type) {
          case 'burn': {
            const dps = eff.magnitude ?? 0;
            const dmg = calcMagic(dps * dt, enemy.magicResistance, 0);
            enemy.hp -= dmg;
            this.queueDotFeedback(eff, dmg, dt);
            break;
          }
          case 'poison': {
            const dps = eff.magnitude ?? 0;
            const dmg = dps * dt;
            enemy.hp -= dmg;
            this.queueDotFeedback(eff, dmg, dt);
            break;
          }
        }

        const alive = eff.remainingDuration > 0 && enemy.isActive;
        if ((eff.type === 'burn' || eff.type === 'poison') && ((eff.feedbackTimer ?? 0) <= 0 || !alive)) {
          this.emitDotFeedback(enemy, eff);
        }
        if (alive) {
          remainingEffects.push(eff);

          // Only count speed modifiers from effects that survive this tick
          switch (eff.type) {
            case 'slow': {
              const reduction = eff.magnitude ?? 0;
              const factor = Math.max(0, 1 - reduction);
              if (factor < slowMult) slowMult = factor;
              break;
            }
            case 'freeze': {
              hasFreeze = true;
              break;
            }
            case 'stun': {
              isStunned = true;
              break;
            }
          }
        }
      }

      enemy.statusEffects = remainingEffects;

      // Freeze: ความเร็ว x0.3 (ลด 70%) และใช้ร่วมกับ Slow โดยเลือกตัวคูณที่ช้ากว่า (ไม่คูณซ้อนกัน)
      let combinedSpeedMult = slowMult;
      if (hasFreeze) {
        combinedSpeedMult = Math.min(slowMult, 0.3);
      }

      // Stun: ความเร็ว x0
      if (isStunned) {
        combinedSpeedMult = 0;
      }

      enemy.speedMultiplier = combinedSpeedMult;
      enemy.isStunned = isStunned;
    }
  }

  private queueDotFeedback(effect: ActiveStatusEffect, damage: number, dt: number): void {
    if (damage <= 0) return;
    effect.pendingDamage = (effect.pendingDamage ?? 0) + damage;
    effect.feedbackTimer = (effect.feedbackTimer ?? DOT_FEEDBACK_INTERVAL) - dt;
  }

  private emitDotFeedback(enemy: Enemy, effect: ActiveStatusEffect): void {
    const damage = effect.pendingDamage ?? 0;
    if (damage > 0) {
      eventBus.emit('enemy:hit', {
        enemyId: enemy.id,
        x: enemy.x,
        y: enemy.y,
        damage,
        crit: false,
        damageType: 'magic',
      });
    }
    effect.pendingDamage = 0;
    effect.feedbackTimer = DOT_FEEDBACK_INTERVAL;
  }
}
