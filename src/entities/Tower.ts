import { ECONOMY } from '../data/economy';
import type {
  BarracksStats,
  Point,
  RangedStats,
  TargetMode,
  TowerConfig,
  TowerInfo,
  TowerLevelStats,
  TowerSpot,
  TowerStat,
} from '../types/game';
import { Soldier } from './Soldier';

export class Tower {
  readonly x: number;
  readonly y: number;
  level = 1;
  investedGold: number;
  targetMode: TargetMode = 'first';
  cooldown = 0;
  readonly soldiers: Soldier[] = [];

  constructor(
    readonly id: number,
    readonly config: TowerConfig,
    readonly spot: TowerSpot,
    readonly rally: Point,
  ) {
    this.x = spot.x;
    this.y = spot.y;
    this.investedGold = config.cost;

    const b = this.currentBarracks;
    if (b) {
      for (let i = 0; i < b.soldierCount; i += 1) {
        const post = this.calculatePost(i, b.soldierCount);
        this.soldiers.push(
          new Soldier(b.soldier, { x: this.x, y: this.y }, rally, b.rallyRadius, b.respawnDelay, post),
        );
      }
    }
  }

  get currentStats(): TowerLevelStats {
    return this.config.levels[this.level - 1] ?? this.config.levels[0];
  }

  get currentRanged(): RangedStats | undefined {
    return this.currentStats.ranged;
  }

  get currentBarracks(): BarracksStats | undefined {
    return this.currentStats.barracks;
  }

  get nextLevelStats(): TowerLevelStats | null {
    if (this.level < this.config.levels.length) {
      return this.config.levels[this.level];
    }
    return null;
  }

  get isMaxLevel(): boolean {
    return this.level >= this.config.levels.length;
  }

  get displayRange(): number {
    return this.currentRanged?.range ?? this.currentBarracks?.rallyRadius ?? 0;
  }

  private calculatePost(index: number, count: number): Point {
    const angle = Math.PI / 2 + (index / count) * Math.PI * 2;
    const spread = count > 1 ? 18 : 0;
    return {
      x: this.rally.x + Math.cos(angle) * spread,
      y: this.rally.y + Math.sin(angle) * spread,
    };
  }

  upgrade(): boolean {
    const next = this.nextLevelStats;
    if (!next) return false;

    this.level += 1;
    this.investedGold += next.upgradeCost;

    const b = this.currentBarracks;
    if (b) {
      // อัปเดตทหารเดิม: ทหารที่ยังมีชีวิตได้ stats ใหม่และ HP เต็ม ทหารที่ตายเกิดใหม่ด้วย stats ใหม่
      for (let i = 0; i < this.soldiers.length; i += 1) {
        const post = this.calculatePost(i, b.soldierCount);
        this.soldiers[i].upgradeStats(b.soldier, b.rallyRadius, b.respawnDelay, post);
      }
      // ถ้า soldierCount เพิ่มขึ้น ให้เพิ่มทหาร
      while (this.soldiers.length < b.soldierCount) {
        const idx = this.soldiers.length;
        const post = this.calculatePost(idx, b.soldierCount);
        this.soldiers.push(
          new Soldier(b.soldier, { x: this.x, y: this.y }, this.rally, b.rallyRadius, b.respawnDelay, post),
        );
      }
    }
    return true;
  }

  sellRefund(percentage: number = ECONOMY.sellPercentage): number {
    return Math.max(0, Math.floor(this.investedGold * percentage));
  }

  destroy(): void {
    for (const soldier of this.soldiers) {
      soldier.cleanup();
    }
    this.soldiers.length = 0;
  }

  stats(): TowerStat[] {
    const out: TowerStat[] = [];
    const r = this.currentRanged;
    const nextR = this.nextLevelStats?.ranged;

    if (r) {
      out.push({
        label: r.damageType === 'magic' ? 'Magic Damage' : 'Damage',
        value: String(r.damage),
        nextValue: nextR ? String(nextR.damage) : undefined,
      });
      out.push({
        label: 'Range',
        value: String(r.range),
        nextValue: nextR ? String(nextR.range) : undefined,
      });
      out.push({
        label: 'Attack Speed',
        value: `${r.attackSpeed.toFixed(1)}/s`,
        nextValue: nextR ? `${nextR.attackSpeed.toFixed(1)}/s` : undefined,
      });
      if (r.critChance > 0 || (nextR && nextR.critChance > 0)) {
        out.push({
          label: 'Critical',
          value: `${Math.round(r.critChance * 100)}%`,
          nextValue: nextR ? `${Math.round(nextR.critChance * 100)}%` : undefined,
        });
      }
      if (r.splashRadius > 0 || (nextR && nextR.splashRadius > 0)) {
        out.push({
          label: r.projectileKind === 'cannonShell' ? 'Explosion Radius' : 'Splash Radius',
          value: String(r.splashRadius),
          nextValue: nextR ? String(nextR.splashRadius) : undefined,
        });
      }
      if (r.magicPenetration > 0 || (nextR && nextR.magicPenetration > 0)) {
        out.push({
          label: 'Magic Penetration',
          value: `${r.magicPenetration}%`,
          nextValue: nextR ? `${nextR.magicPenetration}%` : undefined,
        });
      }
    }

    const b = this.currentBarracks;
    const nextB = this.nextLevelStats?.barracks;
    if (b) {
      out.push({
        label: 'Soldiers',
        value: String(b.soldierCount),
        nextValue: nextB ? String(nextB.soldierCount) : undefined,
      });
      out.push({
        label: 'Soldier HP',
        value: String(b.soldier.hp),
        nextValue: nextB ? String(nextB.soldier.hp) : undefined,
      });
      out.push({
        label: 'Soldier Damage',
        value: String(b.soldier.damage),
        nextValue: nextB ? String(nextB.soldier.damage) : undefined,
      });
      out.push({
        label: 'Armor',
        value: String(b.soldier.armor),
        nextValue: nextB ? String(nextB.soldier.armor) : undefined,
      });
      out.push({
        label: 'Rally Radius',
        value: String(b.rallyRadius),
        nextValue: nextB ? String(nextB.rallyRadius) : undefined,
      });
      out.push({
        label: 'Respawn',
        value: `${b.respawnDelay}s`,
        nextValue: nextB ? `${nextB.respawnDelay}s` : undefined,
      });
    }
    return out;
  }

  toInfo(): TowerInfo {
    return {
      id: this.id,
      typeId: this.config.id,
      name: this.config.name,
      symbol: this.config.symbol,
      level: this.level,
      maxLevel: this.config.levels.length,
      upgradeCost: this.nextLevelStats?.upgradeCost ?? 0,
      sellRefund: this.sellRefund(),
      targetMode: this.targetMode,
      hasTargeting: this.currentRanged !== undefined,
      stats: this.stats(),
    };
  }
}
