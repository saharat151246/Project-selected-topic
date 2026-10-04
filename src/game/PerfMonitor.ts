/**
 * PerfMonitor — 120-frame ring buffer for measuring FPS, avg frame ms,
 * 99th-percentile frame ms, and auto-degrade detection.
 */

import type { EffectsLevel } from '../types/save';

export class PerfMonitor {
  private readonly bufferSize = 120;
  private readonly frameTimes: number[] = new Array(120).fill(16.6);
  private head = 0;
  private count = 0;

  // Auto-degrade tracking
  private windowTimes: number[] = [];
  private windowDuration = 0;
  private lastDegradeTime = -99999;
  private degradeCount = 0;
  private onDegradeCallback?: (newLevel: EffectsLevel) => void;

  /**
   * Record a frame execution time
   * @param frameMs Duration of the frame in ms
   * @param isPaused Whether the game is currently paused
   * @param currentTime Optional external timestamp for headless tests
   */
  recordFrame(frameMs: number, isPaused = false, currentTime?: number): void {
    const now = currentTime ?? performance.now();

    // Store in ring buffer
    this.frameTimes[this.head] = frameMs;
    this.head = (this.head + 1) % this.bufferSize;
    if (this.count < this.bufferSize) this.count++;

    // Don't auto-degrade on pause or extreme lag spikes (> 250ms like tab switch)
    if (isPaused || frameMs > 250) {
      return;
    }

    this.windowTimes.push(frameMs);
    this.windowDuration += frameMs;

    // Prune window to roughly 3000ms (3 seconds)
    while (this.windowDuration > 3000 && this.windowTimes.length > 10) {
      const removed = this.windowTimes.shift()!;
      this.windowDuration -= removed;
    }

    // Check auto-degrade condition:
    // Window has accumulated at least 2.5s, avg > 24ms, hasn't degraded in 10s, max 2 degrades
    if (
      this.windowDuration >= 2500 &&
      this.degradeCount < 2 &&
      now - this.lastDegradeTime >= 10000
    ) {
      const avg = this.windowDuration / this.windowTimes.length;
      if (avg > 24) {
        this.triggerDegrade(now);
      }
    }
  }

  onDegrade(callback: (newLevel: EffectsLevel) => void): void {
    this.onDegradeCallback = callback;
  }

  private triggerDegrade(now: number): void {
    this.degradeCount++;
    this.lastDegradeTime = now;
    this.windowTimes = [];
    this.windowDuration = 0;

    const nextLevel: EffectsLevel = this.degradeCount === 1 ? 'low' : 'off';
    if (this.onDegradeCallback) {
      this.onDegradeCallback(nextLevel);
    }
  }

  getAverageFps(): number {
    const avgMs = this.getAverageFrameMs();
    return avgMs > 0 ? Math.round(1000 / avgMs) : 60;
  }

  getAverageFrameMs(): number {
    if (this.count === 0) return 16.6;
    let sum = 0;
    for (let i = 0; i < this.count; i++) {
      sum += this.frameTimes[i];
    }
    return Math.round((sum / this.count) * 10) / 10;
  }

  getP99FrameMs(): number {
    if (this.count === 0) return 16.6;
    const sorted = this.frameTimes.slice(0, this.count).sort((a, b) => a - b);
    const p99Index = Math.min(this.count - 1, Math.floor(this.count * 0.99));
    return Math.round(sorted[p99Index] * 10) / 10;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.frameTimes.fill(16.6);
    this.windowTimes = [];
    this.windowDuration = 0;
    this.lastDegradeTime = -99999;
    this.degradeCount = 0;
  }
}
