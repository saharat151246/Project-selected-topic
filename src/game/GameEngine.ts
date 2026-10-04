import { DIFFICULTIES } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { TOWERS } from '../data/towers';
import type { Enemy } from '../entities/Enemy';
import type { Soldier } from '../entities/Soldier';
import { BossSystem } from '../systems/BossSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { EnemyAbilitySystem } from '../systems/EnemyAbilitySystem';
import { EnemySystem } from '../systems/EnemySystem';
import { validatePath } from '../systems/MapValidator';
import { ScoreSystem } from '../systems/ScoreSystem';
import { StatusEffectSystem } from '../systems/StatusEffectSystem';
import { TowerSystem } from '../systems/TowerSystem';
import type {
  DifficultyId,
  GameSnapshot,
  GameSpeed,
  GameStatus,
  MapData,
  Notice,
  Selection,
  TargetMode,
  TowerInfo,
  TowerSpot,
  TowerTypeId,
  VictoryResult,
} from '../types/game';
import { eventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { PerfMonitor } from './PerfMonitor';
import { PresentationLayer } from './PresentationLayer';
import { ProjectileSystem } from './ProjectileSystem';
import { renderGame } from './Renderer';
import { SpatialGrid } from './SpatialGrid';
import { isTargetMode } from './TargetingSystem';
import { WaveManager } from './WaveManager';

export const INITIAL_LIFE = 20;

export class GameEngine {
  readonly map: MapData;
  private readonly pathValid: boolean;
  private readonly enemySystem: EnemySystem;
  private readonly towerSystem: TowerSystem;
  private readonly projectileSystem = new ProjectileSystem();
  private readonly statusEffectSystem = new StatusEffectSystem();
  private readonly enemyAbilitySystem = new EnemyAbilitySystem();
  private readonly bossSystem = new BossSystem();
  private readonly scoreSystem = new ScoreSystem();
  readonly waveManager = new WaveManager();
  private readonly economy: EconomySystem;
  private readonly loop: GameLoop;
  private readonly enemyGrid: SpatialGrid<Enemy>;
  private ctx: CanvasRenderingContext2D | null = null;

  // Presentation Layer (does not affect simulation)
  readonly presentation = new PresentationLayer();

  // Performance tracking for auto-degrade
  readonly perfMonitor = new PerfMonitor();

  private life = INITIAL_LIFE;
  private escaped = 0;
  private status: GameStatus = 'PLAYING';
  private speed: GameSpeed = 1;
  private difficulty: DifficultyId = 'normal';
  private canChangeDifficulty = true;
  private lostLifeThisWave = false;
  private result: VictoryResult | null = null;

  private selection: Selection | null = null;
  private selectedInfo: TowerInfo | null = null;
  private notice: Notice | null = null;
  private noticeSeq = 0;

  private snapshot: GameSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(map: MapData) {
    this.map = map;

    const result = validatePath(map.path);
    this.pathValid = result.valid;
    if (!result.valid) {
      console.warn(`[Game Warning] Invalid path: ${result.reason ?? 'unknown reason'}`);
    }

    const path = this.pathValid ? map.path : [];
    const diffConfig = DIFFICULTIES[this.difficulty];
    this.economy = new EconomySystem(diffConfig.initialGold);
    this.enemySystem = new EnemySystem(path, ENEMIES, this.pathValid);
    this.enemySystem.setDifficultyMultipliers(diffConfig.hpMultiplier, diffConfig.damageMultiplier);
    this.towerSystem = new TowerSystem(path);
    this.enemyGrid = new SpatialGrid<Enemy>(map.width, map.height);

    this.bossSystem.onSummonMinions = (count) => {
      this.waveManager.addWaveTotal(count);
    };

    this.perfMonitor.onDegrade((newLevel) => {
      this.presentation.setEffectsLevel(newLevel);
      this.notify('Effects reduced to keep the game smooth');
    });

    this.loop = new GameLoop((dt) => this.frame(dt));
    this.snapshot = this.buildSnapshot();
  }

  get fps(): number {
    return this.perfMonitor.getAverageFps();
  }

  get projectileCount(): number {
    return this.projectileSystem.projectiles.length;
  }

  // ===== React bridge (useSyncExternalStore) =====
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): GameSnapshot => this.snapshot;

  // ===== Difficulty & Speed =====
  setDifficulty = (diff: DifficultyId): void => {
    if (!this.canChangeDifficulty || this.waveManager.wave !== 1 || this.waveManager.wavePhase !== 'READY') return;
    this.difficulty = diff;
    this.restart();
  };

  setSpeed = (speed: GameSpeed): void => {
    if (speed !== 1 && speed !== 2 && speed !== 3) return;
    this.speed = speed;
    this.publish();
  };

  togglePause = (): void => {
    if (this.status === 'PLAYING') {
      this.pause();
    } else if (this.status === 'PAUSED') {
      this.resume();
    }
  };

  pause = (): void => {
    if (this.status === 'PLAYING') {
      this.status = 'PAUSED';
      this.setSelection(null);
      this.loop.stop();
      this.publish();
    }
  };

  resume = (): void => {
    if (this.status === 'PAUSED') {
      this.status = 'PLAYING';
      if (this.ctx) this.loop.start();
      this.publish();
    }
  };

  // ===== Wave Controls =====
  startWave = (): void => {
    if (this.status !== 'PLAYING') return;
    if (!this.pathValid) {
      console.warn('[Game Warning] Cannot start wave: Path is invalid.');
      this.notify('Path is invalid');
      return;
    }
    const startResult = this.waveManager.startWave();
    if (startResult === 'STARTED') {
      this.canChangeDifficulty = false;
      eventBus.emit('wave:start', { wave: this.waveManager.wave });
      this.publish();
    } else if (startResult === 'SKIPPED') {
      this.publish();
    } else if (startResult === 'VICTORY') {
      this.handleVictory();
      this.publish();
    }
  };

  // ===== Lifecycle =====
  attach(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
    this.presentation.init();
    this.render();
    if (this.status === 'PLAYING') this.loop.start();
  }

  detach(): void {
    this.loop.stop();
    this.ctx = null;
  }

  restart = (): void => {
    const diffConfig = DIFFICULTIES[this.difficulty];
    this.life = INITIAL_LIFE;
    this.economy.reset(diffConfig.initialGold);
    this.enemySystem.setDifficultyMultipliers(diffConfig.hpMultiplier, diffConfig.damageMultiplier);
    this.escaped = 0;
    this.status = 'PLAYING';
    this.canChangeDifficulty = true;
    this.result = null;
    this.lostLifeThisWave = false;

    this.waveManager.reset();
    this.enemySystem.reset();
    this.towerSystem.reset();
    this.projectileSystem.reset();
    this.bossSystem.reset();
    this.scoreSystem.reset();
    this.presentation.reset();

    this.selection = null;
    this.selectedInfo = null;
    this.notice = null;

    this.publish();
    this.render();
    if (this.ctx) this.loop.start();
  };

  dispose(): void {
    this.loop.stop();
    this.presentation.dispose();
  }

  // ===== Input (เรียกจาก Canvas / UI) =====
  handleClick = (x: number, y: number, isTouch = false): void => {
    if (this.status !== 'PLAYING' || !Number.isFinite(x) || !Number.isFinite(y)) return;

    const spot = this.hitSpot(x, y, isTouch);
    if (!spot) {
      this.setSelection(null);
    } else {
      const tower = this.towerSystem.getBySpot(spot.id);
      const sameSelected =
        this.selection !== null &&
        ((tower && this.selection.kind === 'tower' && this.selection.towerId === tower.id) ||
          (!tower && this.selection.kind === 'spot' && this.selection.spotId === spot.id));

      if (sameSelected) {
        this.setSelection(null);
      } else if (tower) {
        this.setSelection({ kind: 'tower', towerId: tower.id, x: tower.x, y: tower.y });
      } else {
        this.setSelection({ kind: 'spot', spotId: spot.id, x: spot.x, y: spot.y });
      }
    }
    this.publish();
  };

  clearSelection = (): void => {
    this.setSelection(null);
    this.publish();
  };

  getTowerCount = (): number => {
    return this.towerSystem.towers.length;
  };

  buildTower = (spotId: number, typeId: TowerTypeId): boolean => {
    if (this.status !== 'PLAYING') return false;

    const spot = this.map.towerSpots.find((s) => s.id === spotId);
    const config = TOWERS[typeId];
    if (!spot || !config) {
      console.warn(`[Game Warning] Cannot build tower "${String(typeId)}" at spot ${spotId}.`);
      this.notify('Cannot Build Here');
      return false;
    }
    if (this.towerSystem.getBySpot(spotId)) {
      this.notify('Spot Occupied');
      return false;
    }
    if (!this.economy.canAfford(config.cost)) {
      this.notify('Not Enough Gold');
      return false;
    }

    const tower = this.towerSystem.build(spot, config);
    if (!tower) {
      this.notify('Invalid Tower Data');
      return false;
    }

    this.economy.spend(config.cost);
    this.scoreSystem.onTowerBuilt();
    eventBus.emit('tower:build', { x: tower.x, y: tower.y, typeId: String(typeId) });
    this.setSelection({ kind: 'tower', towerId: tower.id, x: tower.x, y: tower.y });
    this.publish();
    this.render();
    return true;
  };

  upgradeTower = (towerId: number): boolean => {
    if (this.status !== 'PLAYING') return false;

    const tower = this.towerSystem.getById(towerId);
    if (!tower) return false;

    if (tower.isMaxLevel) {
      this.notify('Max Level');
      return false;
    }

    const nextStats = tower.nextLevelStats;
    if (!nextStats) return false;

    if (!this.economy.canAfford(nextStats.upgradeCost)) {
      this.notify('Not Enough Gold');
      return false;
    }

    const success = tower.upgrade();
    if (!success) return false;

    this.economy.spend(nextStats.upgradeCost);
    this.scoreSystem.onTowerUpgrade();
    eventBus.emit('tower:upgrade', { x: tower.x, y: tower.y, level: tower.level });
    this.notify(`Upgraded to Level ${tower.level}`);

    if (this.selection?.kind === 'tower' && this.selection.towerId === towerId) {
      this.selectedInfo = tower.toInfo();
    }
    this.publish();
    this.render();
    return true;
  };

  sellTower = (towerId: number): boolean => {
    if (this.status !== 'PLAYING') return false;

    const tower = this.towerSystem.getById(towerId);
    if (!tower) return false;

    const refund = tower.sellRefund();
    const tx = tower.x;
    const ty = tower.y;
    const removed = this.towerSystem.remove(towerId);
    if (!removed) return false;

    this.economy.earn(refund);
    eventBus.emit('tower:sell', { x: tx, y: ty, refund });
    this.setSelection(null);
    this.notify(`Tower Sold +${refund}`);
    this.publish();
    this.render();
    return true;
  };

  setTargetMode = (towerId: number, mode: TargetMode): void => {
    const tower = this.towerSystem.getById(towerId);
    if (!tower || !tower.currentRanged || !isTargetMode(mode)) return;
    tower.targetMode = mode;
    if (this.selection?.kind === 'tower' && this.selection.towerId === towerId) {
      this.selectedInfo = tower.toInfo();
    }
    this.publish();
  };

  // ===== Frame =====
  private frame(realDt: number): void {
    const frameMs = Math.max(1, realDt * 1000);

    if (this.status !== 'PLAYING') {
      this.perfMonitor.recordFrame(frameMs, true);
      this.presentation.update(realDt);
      this.render();
      return;
    }

    // Simulation dt = realDt x speed แล้วแบ่งเป็น Sub-step:
    // steps = min(24, ceil(simDt / (1/60))), stepDt = simDt / steps
    const simDt = realDt * this.speed;
    const steps = Math.min(24, Math.max(1, Math.ceil(simDt / (1 / 60))));
    const stepDt = simDt / steps;

    for (let i = 0; i < steps; i += 1) {
      this.update(stepDt);
      if ((this.status as string) !== 'PLAYING') break;
    }

    // Update presentation (particles, VFX) with simulated dt so effects scale with game speed
    this.presentation.update(simDt);

    this.render();
    if ((this.status as string) === 'GAME_OVER' || (this.status as string) === 'VICTORY') {
      this.loop.stop();
    }

    // Frame tracking for FPS & auto-degrade (measures real interval between frames)
    this.perfMonitor.recordFrame(frameMs, false);
  }

  private update(dt: number): void {
    if (this.status !== 'PLAYING') return;

    const diffConfig = DIFFICULTIES[this.difficulty];

    // ลำดับ Update ตาม Master Prompt:
    // 1. WaveManager.update (Spawn ตามคิว)
    this.waveManager.update(dt, this.enemySystem);

    // 2. StatusEffectSystem.update (DoT, ลดเวลา, คำนวณ speedMultiplier/stunned)
    this.statusEffectSystem.update(dt, this.enemySystem.enemies);

    // 3. EnemySystem.move (Enemy ที่ blocked หรือ stunned ไม่ขยับ)
    this.enemySystem.move(dt);

    // 4. EnemyAbilitySystem.update (Heal)
    this.enemyAbilitySystem.update(dt, this.enemySystem.enemies);

    // 5. BossSystem.update (ตรวจ Phase, Summon, Area Attack)
    const allSoldiers: Soldier[] = [];
    for (const t of this.towerSystem.towers) {
      for (const s of t.soldiers) {
        allSoldiers.push(s);
      }
    }
    this.bossSystem.update(dt, this.enemySystem.enemies, this.enemySystem, allSoldiers);

    // 6. Rebuild SpatialGrid for spatial queries
    this.enemyGrid.rebuild(this.enemySystem.enemies);

    // 7. TowerSystem.update (Soldier ก่อน Tower) — uses grid for target selection
    this.towerSystem.update(dt, this.enemySystem.enemies, this.projectileSystem, this.enemyGrid);

    // 8. ProjectileSystem.update (ชน, Damage, Apply Effect) — uses grid for splash
    this.projectileSystem.update(dt, this.enemySystem.enemies, this.statusEffectSystem, this.enemyGrid);

    // 8. EnemySystem.resolve (ตาย → Gold + Score + Remove, ถึง Castle → Life ลด + Remove)
    this.enemySystem.resolve(
      (enemy: Enemy) => {
        if (enemy.config.type === 'boss') {
          this.bossSystem.onBossRemoved(enemy, true);
        }
        const killGold = Math.floor(enemy.config.reward * diffConfig.goldMultiplier);
        this.economy.earn(killGold);
        this.scoreSystem.onEnemyKill(enemy.config.reward, enemy.config.type === 'boss');

        // Emit presentation events
        eventBus.emit('enemy:kill', {
          enemyId: enemy.id,
          x: enemy.x,
          y: enemy.y,
          reward: killGold,
          isBoss: enemy.config.type === 'boss',
        });
      },
      (enemy: Enemy) => {
        if (enemy.config.type === 'boss') {
          this.bossSystem.onBossRemoved(enemy, false);
        }
        if (this.life <= 0) return;
        this.life = Math.max(0, this.life - enemy.baseDamage);
        this.escaped += 1;
        this.lostLifeThisWave = true;
        eventBus.emit('enemy:reached', { enemyId: enemy.id, x: enemy.x, y: enemy.y });
      },
    );

    // 9. WaveManager ตรวจจบ Wave / Reward
    this.waveManager.checkWaveComplete(
      (completedWave: number, reward: number) => {
        const rewardGold = Math.floor(reward * diffConfig.goldMultiplier);
        this.economy.earn(rewardGold);
        this.scoreSystem.onWaveComplete(completedWave, !this.lostLifeThisWave);
        this.notify(`Wave ${completedWave} Complete +${rewardGold}`);
        this.lostLifeThisWave = false;
        eventBus.emit('wave:complete', { wave: completedWave, reward: rewardGold });
      },
      () => {
        this.handleVictory();
      },
      this.enemySystem.enemies.length,
    );

    // 10. Game Over Check (ถ้า Life <= 0 ให้ Game Over ก่อน Victory)
    if (this.life <= 0) {
      this.status = 'GAME_OVER';
      this.setSelection(null);
      eventBus.emit('game:over', {});
    }

    this.publish();
  }

  private handleVictory(): void {
    if (this.life <= 0) return;

    this.status = 'VICTORY';
    this.scoreSystem.onVictory(this.life);
    const stars = this.scoreSystem.calculateStars(this.life, this.escaped, this.map.starRules);
    this.result = {
      score: this.scoreSystem.score,
      stars,
      life: this.life,
      escaped: this.escaped,
      kills: this.scoreSystem.stats.kills,
      difficulty: this.difficulty,
    };
    this.setSelection(null);
    eventBus.emit('game:victory', {});
  }

  private render(): void {
    if (!this.ctx) return;
    const selectedTower =
      this.selection?.kind === 'tower' ? this.towerSystem.getById(this.selection.towerId) ?? null : null;

    renderGame(this.ctx, this.map, {
      enemies: this.enemySystem.enemies,
      towers: this.towerSystem.towers,
      projectiles: this.projectileSystem.projectiles,
      selectedSpotId: this.selection?.kind === 'spot' ? this.selection.spotId : null,
      selectedTower,
      pathValid: this.pathValid,
      bossRenderInfo: this.bossSystem.getRenderInfo(),
    });

    // Draw VFX on top
    this.presentation.draw(this.ctx);
  }

  // ===== Helpers =====
  private hitSpot(x: number, y: number, isTouch = false): TowerSpot | null {
    let best: TowerSpot | null = null;
    const maxSearchDist = isTouch ? 56 : 28;
    const baseRadius = 28 * (isTouch ? 1.3 : 1.0);
    let bestDist = maxSearchDist;
    for (const s of this.map.towerSpots) {
      const tower = this.towerSystem.getBySpot(s.id);
      if (tower) {
        // Tower body and roof extend upward from s.y (top reaches s.y - 75 to s.y - 80)
        const halfWidth = isTouch ? 30 : 24;
        const topY = s.y - (isTouch ? 85 : 75);
        const bottomY = s.y + (isTouch ? 25 : 18);
        if (x >= s.x - halfWidth && x <= s.x + halfWidth && y >= topY && y <= bottomY) {
          const d = Math.hypot(x - s.x, y - s.y);
          if (best === null || d < bestDist) {
            best = s;
            bestDist = d;
            continue;
          }
        }
      }

      const dx = x - s.x;
      const dy = y - s.y;
      const d = Math.hypot(dx, dy);
      if (d <= baseRadius && d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  }

  private setSelection(sel: Selection | null): void {
    this.selection = sel;
    this.selectedInfo =
      sel && sel.kind === 'tower' ? this.towerSystem.getById(sel.towerId)?.toInfo() ?? null : null;
  }

  private notify(text: string): void {
    this.noticeSeq += 1;
    this.notice = { id: this.noticeSeq, text };
    this.publish();
  }

  // ===== Snapshot =====
  private buildSnapshot(): GameSnapshot {
    return {
      life: this.life,
      gold: this.economy.gold,
      wave: this.waveManager.wave,
      totalWaves: this.waveManager.getTotalWaves(),
      enemyCount: this.enemySystem.enemies.length,
      escaped: this.escaped,
      status: this.status,
      selection: this.selection,
      selectedTower: this.selectedInfo,
      notice: this.notice,
      wavePhase: this.waveManager.wavePhase,
      waveRemaining: this.waveManager.waveRemaining,
      waveTotal: this.waveManager.waveTotal,
      score: this.scoreSystem.score,
      speed: this.speed,
      difficulty: this.difficulty,
      canChangeDifficulty: this.canChangeDifficulty,
      boss: this.bossSystem.getBossSnapshot(),
      banner: this.bossSystem.banner,
      result: this.result,
    };
  }

  private publish(): void {
    const next = this.buildSnapshot();
    const prev = this.snapshot;

    const bossSame =
      (prev.boss === null && next.boss === null) ||
      (prev.boss !== null &&
        next.boss !== null &&
        prev.boss.hpPercent === next.boss.hpPercent &&
        prev.boss.phase === next.boss.phase &&
        prev.boss.name === next.boss.name);

    const bannerSame = prev.banner?.id === next.banner?.id;

    if (
      prev.life === next.life &&
      prev.gold === next.gold &&
      prev.wave === next.wave &&
      prev.totalWaves === next.totalWaves &&
      prev.enemyCount === next.enemyCount &&
      prev.escaped === next.escaped &&
      prev.status === next.status &&
      prev.speed === next.speed &&
      prev.difficulty === next.difficulty &&
      prev.canChangeDifficulty === next.canChangeDifficulty &&
      prev.score === next.score &&
      prev.selection === next.selection &&
      prev.selectedTower === next.selectedTower &&
      prev.notice === next.notice &&
      prev.wavePhase === next.wavePhase &&
      prev.waveRemaining === next.waveRemaining &&
      prev.waveTotal === next.waveTotal &&
      prev.result === next.result &&
      bossSame &&
      bannerSame
    ) {
      return;
    }

    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }
}
