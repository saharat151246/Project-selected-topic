import type { RunStats, StarRules } from '../types/game';

export class ScoreSystem {
  score = 0;
  stats: RunStats = {
    kills: 0,
    bossKills: 0,
    upgrades: 0,
    towersBuilt: 0,
    perfectWaves: 0,
  };

  reset(): void {
    this.score = 0;
    this.stats = {
      kills: 0,
      bossKills: 0,
      upgrades: 0,
      towersBuilt: 0,
      perfectWaves: 0,
    };
  }

  onEnemyKill(baseReward: number, isBoss: boolean): void {
    this.stats.kills += 1;
    // Score: Enemy ตาย +reward x5 (ใช้ reward ใน Config ก่อนคูณ Difficulty)
    this.score += Math.max(0, baseReward * 5);

    if (isBoss) {
      this.stats.bossKills += 1;
      // Boss ตาย +1000
      this.score += 1000;
    }
  }

  onWaveComplete(waveNumber: number, perfect: boolean): void {
    // จบ Wave n +100 x n
    this.score += 100 * waveNumber;
    if (perfect) {
      this.stats.perfectWaves += 1;
    }
  }

  onVictory(remainingLife: number): void {
    // Victory +Life ที่เหลือ x100
    this.score += Math.max(0, remainingLife * 100);
  }

  onTowerBuilt(): void {
    this.stats.towersBuilt += 1;
  }

  onTowerUpgrade(): void {
    this.stats.upgrades += 1;
  }

  calculateStars(life: number, escaped: number, rules: StarRules): number {
    if (life >= rules.threeStarMinLife && escaped <= rules.threeStarMaxEscaped) {
      return 3;
    }
    if (life >= rules.twoStarMinLife) {
      return 2;
    }
    return 1;
  }
}
