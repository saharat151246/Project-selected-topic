import { ENEMIES } from '../data/enemies';
import { WAVES } from '../data/waves';
import type { EnemySystem } from '../systems/EnemySystem';
import type { EnemyTypeId, WaveConfig, WavePhase } from '../types/game';

interface SpawnQueueItem {
  type: EnemyTypeId;
  delay: number;
}

export type StartWaveResult = 'STARTED' | 'SKIPPED' | 'VICTORY' | 'NOT_READY';

export class WaveManager {
  wave = 1;
  wavePhase: WavePhase = 'READY';
  waveRemaining = 0;
  waveTotal = 0;

  private spawnQueue: SpawnQueueItem[] = [];
  private spawnTimer = 0;
  private spawnedCount = 0;
  private hasSpawnFailure = false;

  constructor(private readonly waves: readonly WaveConfig[] = WAVES) {
    this.wave = this.firstWaveId;
  }

  getTotalWaves(): number {
    return this.waves.length;
  }

  private get firstWaveId(): number {
    const firstWaveId = this.waves.reduce((minId, config) => Math.min(minId, config.id), Infinity);
    return Number.isFinite(firstWaveId) ? firstWaveId : 1;
  }

  private get finalWaveId(): number {
    return this.waves.reduce((maxId, config) => Math.max(maxId, config.id), 0);
  }

  private getNextWaveId(currentWaveId: number): number | null {
    let nextWaveId = Infinity;
    for (const config of this.waves) {
      if (config.id > currentWaveId && config.id < nextWaveId) {
        nextWaveId = config.id;
      }
    }
    return Number.isFinite(nextWaveId) ? nextWaveId : null;
  }

  reset(): void {
    this.wave = this.firstWaveId;
    this.wavePhase = 'READY';
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveRemaining = 0;
    this.waveTotal = 0;
    this.spawnedCount = 0;
    this.hasSpawnFailure = false;
  }

  addWaveTotal(count: number): void {
    if (count > 0) {
      this.waveTotal += count;
    }
  }

  startWave(): StartWaveResult {
    if (this.wavePhase !== 'READY') return 'NOT_READY';

    const waveConfig = this.waves.find((w) => w.id === this.wave);
    if (!waveConfig) {
      console.warn(`[Game Warning] Missing wave configuration for wave ${this.wave}`);
      const nextWaveId = this.getNextWaveId(this.wave);
      if (nextWaveId !== null) {
        this.wave = nextWaveId;
        return 'SKIPPED';
      }
      return 'VICTORY';
    }

    if (!Number.isFinite(waveConfig.spawnInterval) || waveConfig.spawnInterval <= 0) {
      console.warn(`[Game Warning] Invalid wave spawnInterval: ${waveConfig.spawnInterval}`);
      const nextWaveId = this.getNextWaveId(this.wave);
      if (nextWaveId !== null) {
        this.wave = nextWaveId;
        return 'SKIPPED';
      }
      return 'VICTORY';
    }

    // สร้าง Spawn Queue ตามลำดับกลุ่ม
    const queue: SpawnQueueItem[] = [];
    for (const group of waveConfig.enemies) {
      if (!group || !ENEMIES[group.type] || !Number.isInteger(group.count) || group.count <= 0) {
        console.warn(
          `[Game Warning] Invalid enemy group in wave ${this.wave}: type=${group?.type}, count=${group?.count}`,
        );
        continue;
      }

      if (group.interval !== undefined && (!Number.isFinite(group.interval) || group.interval <= 0)) {
        console.warn(`[Game Warning] Invalid enemy group interval in wave ${this.wave}: ${group.interval}`);
        continue;
      }

      const delay = group.interval ?? waveConfig.spawnInterval;
      for (let i = 0; i < group.count; i += 1) {
        queue.push({
          type: group.type,
          delay,
        });
      }
    }

    // ถ้า Wave ไม่เหลือ Enemy ที่ถูกต้อง → ข้ามทันที (console.warn, ไม่มี Reward)
    if (queue.length === 0) {
      console.warn(`[Game Warning] Wave ${this.wave} has no valid enemies, skipping immediately.`);
      const nextWaveId = this.getNextWaveId(this.wave);
      if (nextWaveId !== null) {
        this.wave = nextWaveId;
        this.wavePhase = 'READY';
        return 'SKIPPED';
      }
      return 'VICTORY';
    }

    this.spawnQueue = queue;
    this.waveTotal = queue.length;
    this.waveRemaining = queue.length;
    this.wavePhase = 'ACTIVE';
    this.spawnedCount = 0;
    this.hasSpawnFailure = false;

    // Wave แรกของแต่ละ Wave Spawn ตัวแรกหลังกด START WAVE 1 วินาที
    this.spawnTimer = 1.0;
    return 'STARTED';
  }

  update(dt: number, enemySystem: EnemySystem): void {
    if (this.wavePhase !== 'ACTIVE' || !Number.isFinite(dt) || dt <= 0) return;

    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      while (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
        const item = this.spawnQueue.shift()!;
        const spawned = enemySystem.spawn(item.type);
        if (!spawned) {
          console.warn(`[Game Warning] Failed to spawn enemy "${item.type}" in wave ${this.wave}`);
          this.hasSpawnFailure = true;
        } else {
          this.spawnedCount += 1;
        }

        if (this.spawnQueue.length > 0) {
          this.spawnTimer += this.spawnQueue[0].delay;
        }
      }
    }

    this.waveRemaining = this.spawnQueue.length + enemySystem.enemies.length;
  }

  checkWaveComplete(
    onWaveComplete: (completedWave: number, reward: number) => void,
    onVictory: () => void,
    currentEnemyCount: number,
  ): void {
    if (this.wavePhase !== 'ACTIVE') return;

    if (this.spawnQueue.length === 0 && currentEnemyCount === 0) {
      if (this.hasSpawnFailure || this.spawnedCount === 0) {
        console.warn(
          `[Game Warning] Wave ${this.wave} ended with spawn failure or 0 enemies spawned. Skipping reward and victory.`,
        );
        this.wavePhase = 'READY';
        this.waveRemaining = 0;
        this.waveTotal = 0;
        this.hasSpawnFailure = false;
        this.spawnedCount = 0;
        return;
      }

      const completedWave = this.wave;
      const currentConfig = this.waves.find((w) => w.id === completedWave);
      const reward = currentConfig ? currentConfig.reward : 0;

      onWaveComplete(completedWave, reward);

      const nextWaveId = this.getNextWaveId(completedWave);
      if (nextWaveId !== null) {
        this.wave = nextWaveId;
        this.wavePhase = 'READY';
        this.waveRemaining = 0;
        this.waveTotal = 0;
        this.spawnedCount = 0;
        this.hasSpawnFailure = false;
      } else {
        this.wave = this.finalWaveId;
        this.wavePhase = 'READY';
        this.waveRemaining = 0;
        this.waveTotal = 0;
        this.spawnedCount = 0;
        this.hasSpawnFailure = false;
        onVictory();
      }
    }
  }
}
