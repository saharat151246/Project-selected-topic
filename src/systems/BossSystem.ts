import { BOSSES } from '../data/bosses';
import type { Enemy } from '../entities/Enemy';
import type { Soldier } from '../entities/Soldier';
import { eventBus } from '../game/EventBus';
import type {
  BannerNotice,
  BossAreaAttack,
  BossConfig,
  BossPhase,
  BossSnapshot,
  Point,
} from '../types/game';
import type { EnemySystem } from './EnemySystem';

export interface AreaAttackRenderInfo {
  center: Point;
  radius: number;
  progress: number; // 0 - 1
}

export interface ImpactRenderInfo {
  center: Point;
  radius: number;
  remainingTime: number; // 0.25s
}

export class BossSystem {
  private activeBoss: Enemy | null = null;
  private currentPhaseIndex = 0; // 0 = Phase 1

  // Banner
  private bannerTimer = 0;
  banner: BannerNotice | null = null;
  private nextBannerId = 1;
  private pendingBanners: Array<{ text: string; kind: 'warning' | 'phase'; duration: number }> = [];

  // Area Attack State
  private areaAttackConfig: BossAreaAttack | null = null;
  private areaAttackCooldown = 0;
  private isTelegraphing = false;
  private telegraphTimer = 0;
  private telegraphCenter: Point | null = null;

  // Impact Flash for Renderer
  impactFlash: ImpactRenderInfo | null = null;

  // Callback to increase wave total in WaveManager when summoning minions
  onSummonMinions?: (count: number) => void;

  reset(): void {
    this.activeBoss = null;
    this.currentPhaseIndex = 0;
    this.banner = null;
    this.bannerTimer = 0;
    this.pendingBanners = [];
    this.areaAttackConfig = null;
    this.areaAttackCooldown = 0;
    this.isTelegraphing = false;
    this.telegraphTimer = 0;
    this.telegraphCenter = null;
    this.impactFlash = null;
  }

  onBossRemoved(boss: Enemy, defeated: boolean): void {
    if (this.activeBoss !== boss) return;

    if (defeated) {
      eventBus.emit('boss:death', { x: boss.x, y: boss.y, name: boss.config.name });
    }

    this.activeBoss = null;
    this.banner = null;
    this.bannerTimer = 0;
    this.pendingBanners = [];
    this.areaAttackConfig = null;
    this.areaAttackCooldown = 0;
    this.isTelegraphing = false;
    this.telegraphTimer = 0;
    this.telegraphCenter = null;
  }

  // คืน snapshot สำหรับ BossBar และ HUD
  getBossSnapshot(): BossSnapshot | null {
    if (!this.activeBoss || !this.activeBoss.isActive) return null;
    const config = BOSSES[this.activeBoss.config.id];
    if (!config || !config.phases || config.phases.length === 0) return null;

    const hpPercent = Math.max(0, Math.min(100, Math.round((this.activeBoss.hp / this.activeBoss.maxHp) * 100)));
    const currentPhase = config.phases[this.currentPhaseIndex] ?? config.phases[0];

    return {
      name: config.name,
      hpPercent,
      phase: this.currentPhaseIndex + 1,
      phaseCount: config.phases.length,
      phaseName: currentPhase.name,
    };
  }

  // ข้อมูลสำหรับ Renderer แสดง Aura และ Telegraph
  getRenderInfo(): {
    boss: Enemy | null;
    phase: number;
    telegraph: AreaAttackRenderInfo | null;
    impact: ImpactRenderInfo | null;
  } {
    return {
      boss: this.activeBoss && this.activeBoss.isActive ? this.activeBoss : null,
      phase: this.currentPhaseIndex + 1,
      telegraph:
        this.isTelegraphing && this.telegraphCenter && this.areaAttackConfig
          ? {
              center: this.telegraphCenter,
              radius: this.areaAttackConfig.radius,
              progress: 1 - Math.max(0, this.telegraphTimer / this.areaAttackConfig.telegraph),
            }
          : null,
      impact: this.impactFlash,
    };
  }

  update(
    dt: number,
    enemies: readonly Enemy[],
    enemySystem: EnemySystem,
    soldiers: readonly Soldier[],
  ): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    // อัปเดต Impact Flash
    if (this.impactFlash) {
      this.impactFlash.remainingTime -= dt;
      if (this.impactFlash.remainingTime <= 0) {
        this.impactFlash = null;
      }
    }

    const boss = enemies.find((e) => e.isActive && e.config.type === 'boss') ?? null;

    // อัปเดต Banner Timer
    if (boss && this.banner) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.banner = null;
        const nextBanner = this.pendingBanners.shift();
        if (nextBanner) {
          this.showBanner(nextBanner.text, nextBanner.kind, nextBanner.duration);
        }
      }
    }

    // ค้นหา Boss บนสนาม
    if (!boss) {
      if (this.activeBoss) {
        // Boss เพิ่งตายหรือหายไป
        // EnemySystem.resolve() determines whether this boss was defeated or escaped later in this frame.
      }
      return;
    }

    // พบ Boss
    if (this.activeBoss !== boss) {
      this.activeBoss = boss;
      this.currentPhaseIndex = 0;
      this.validateAndInitBoss(boss, enemySystem);
    }

    const config = BOSSES[boss.config.id];
    if (!config || !this.isValidConfig(config)) {
      return; // ทำงานเป็น Enemy ปกติถ้า Config ผิด
    }

    // ตรวจสอบ Phase Transition
    this.checkPhaseTransitions(boss, config, enemySystem);

    // ประมวลผล Area Attack
    this.updateAreaAttack(dt, boss, soldiers);
  }

  private validateAndInitBoss(boss: Enemy, enemySystem: EnemySystem): void {
    const config = BOSSES[boss.config.id];
    if (!config) {
      console.warn(`[Game Warning] Missing BossConfig for enemy: ${boss.config.id}`);
      return;
    }
    if (!this.isValidConfig(config)) {
      console.warn(`[Game Warning] Invalid BossConfig for boss: ${config.id}`);
      return;
    }

    this.showBanner(`WARNING: ${config.name} is coming!`, 'warning', 3.0);
    eventBus.emit('boss:spawn', { name: config.name });
    this.applyPhase(boss, config.phases[0], enemySystem);
  }

  private isValidConfig(config: BossConfig): boolean {
    if (!config.phases || config.phases.length === 0) return false;
    for (let i = 0; i < config.phases.length; i += 1) {
      const p = config.phases[i];
      if (!Number.isFinite(p.hpThreshold) || p.hpThreshold < 0 || p.hpThreshold > 1) {
        return false;
      }
      if (i > 0 && p.hpThreshold >= config.phases[i - 1].hpThreshold) {
        return false; // ต้องเรียงจากมากไปน้อย
      }
    }
    return true;
  }

  private checkPhaseTransitions(boss: Enemy, config: BossConfig, enemySystem: EnemySystem): void {
    const hpRatio = boss.hp / boss.maxHp;

    // ตรวจสอบทีละ Phase ถัดไป (เข้า Phase ได้ทางเดียว ไม่ถอยกลับ)
    while (this.currentPhaseIndex + 1 < config.phases.length) {
      const nextIndex = this.currentPhaseIndex + 1;
      const nextPhase = config.phases[nextIndex];

      if (hpRatio <= nextPhase.hpThreshold) {
        this.currentPhaseIndex = nextIndex;
        this.applyPhase(boss, nextPhase, enemySystem);
      } else {
        break;
      }
    }
  }

  private applyPhase(boss: Enemy, phase: BossPhase, enemySystem: EnemySystem): void {
    // ผล Phase สะสมถาวร
    if (phase.speedMultiplier !== undefined) {
      boss.phaseSpeedMultiplier = phase.speedMultiplier;
    }
    if (phase.armorBonus !== undefined) {
      boss.armorBonus += phase.armorBonus;
    }

    // Summon Minions
    if (phase.summons && phase.summons.length > 0) {
      let totalSummoned = 0;
      for (const group of phase.summons) {
        for (let i = 0; i < group.count; i += 1) {
          const minion = enemySystem.spawnAt(
            group.type,
            boss.x,
            boss.y,
            boss.waypointIndex,
            boss.distanceTravelled,
          );
          if (minion) {
            totalSummoned += 1;
          }
        }
      }
      if (totalSummoned > 0 && this.onSummonMinions) {
        this.onSummonMinions(totalSummoned);
      }
    }

    // Area Attack setup
    if (phase.areaAttack) {
      this.areaAttackConfig = phase.areaAttack;
      this.areaAttackCooldown = phase.areaAttack.interval;
      this.isTelegraphing = false;
      this.telegraphTimer = 0;
      this.telegraphCenter = null;
    }

    // Banner
    if (phase.message) {
      this.showBanner(phase.message, 'phase', 2.5);
      eventBus.emit('boss:phase', { phase: this.currentPhaseIndex + 1, name: phase.name });
    }
  }

  private updateAreaAttack(dt: number, boss: Enemy, soldiers: readonly Soldier[]): void {
    if (!this.areaAttackConfig) return;

    if (!this.isTelegraphing) {
      this.areaAttackCooldown -= dt;
      if (this.areaAttackCooldown <= 0) {
        this.isTelegraphing = true;
        this.telegraphTimer = this.areaAttackConfig.telegraph;
        // ล็อกจุดศูนย์กลางที่ตำแหน่ง Boss ตอนเริ่ม Telegraph
        this.telegraphCenter = { x: boss.x, y: boss.y };
      }
    } else {
      this.telegraphTimer -= dt;
      if (this.telegraphTimer <= 0) {
        this.executeAreaAttack(soldiers);
        this.isTelegraphing = false;
        this.telegraphCenter = null;
        this.areaAttackCooldown = this.areaAttackConfig.interval;
      }
    }
  }

  private executeAreaAttack(soldiers: readonly Soldier[]): void {
    if (!this.areaAttackConfig || !this.telegraphCenter) return;

    const { x, y } = this.telegraphCenter;
    const { radius, damage, damageType } = this.areaAttackConfig;

    // วาบสั้น ๆ ตอนกระแทก
    this.impactFlash = {
      center: { x, y },
      radius,
      remainingTime: 0.25,
    };

    eventBus.emit('boss:area-attack', { x, y, radius });

    // ทำ Damage ให้ Soldier ทุกตัวที่ยังมีชีวิตและอยู่ในรัศมี
    for (const soldier of soldiers) {
      if (!soldier.isAlive) continue;
      const dist = Math.hypot(soldier.x - x, soldier.y - y);
      if (dist <= radius) {
        soldier.takeDamage(damage, damageType);
      }
    }
  }

  private showBanner(text: string, kind: 'warning' | 'phase', duration: number): void {
    if (this.banner) {
      this.pendingBanners.push({ text, kind, duration });
      return;
    }
    this.banner = {
      id: this.nextBannerId++,
      text,
      kind,
    };
    this.bannerTimer = duration;
  }
}
