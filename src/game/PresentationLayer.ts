/**
 * PresentationLayer — Bridges EventBus to AudioSystem + VfxSystem.
 * Subscribes to Engine events and triggers audio / visual feedback.
 * Holds NO simulation state. Safe to destroy/recreate.
 */

import type { EffectsLevel } from '../types/save';
import { globalAudio } from './AudioSystem';
import { eventBus } from './EventBus';
import { VfxSystem } from './VfxSystem';

export class PresentationLayer {
  readonly audio = globalAudio;
  readonly vfx = new VfxSystem();
  private unsubscribers: Array<() => void> = [];
  private initialized = false;

  /** Call from user gesture to init AudioContext */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.audio.init();
    this.subscribe();
    this.audio.playMusic('battle');
  }

  setEffectsLevel(level: EffectsLevel): void {
    this.vfx.setEffectsLevel(level);
  }

  getEffectsLevel(): EffectsLevel {
    return this.vfx.getEffectsLevel();
  }

  private subscribe(): void {
    const unsubs = this.unsubscribers;

    unsubs.push(
      eventBus.on('enemy:hit', (d) => {
        this.vfx.emitHit(d.x, d.y, d.crit, d.damageType);
        this.vfx.emitDamage(d.enemyId ?? null, d.x, d.y, d.damage, d.crit, d.damageType);
        this.audio.play('impactHit');
      }),
    );

    unsubs.push(
      eventBus.on('enemy:kill', (d) => {
        if (!d.isBoss) {
          this.vfx.emitDeath(d.x, d.y, false);
          this.audio.play('enemyDeath');
        }
      }),
    );

    unsubs.push(
      eventBus.on('tower:build', (d) => {
        this.vfx.emitUpgrade(d.x, d.y);
        this.audio.play('towerBuild');
      }),
    );

    unsubs.push(
      eventBus.on('tower:upgrade', (d) => {
        this.vfx.emitUpgrade(d.x, d.y);
        this.audio.play('towerUpgrade');
      }),
    );

    unsubs.push(
      eventBus.on('tower:sell', () => {
        this.audio.play('towerSell');
      }),
    );

    unsubs.push(
      eventBus.on('tower:fire', (d) => {
        switch (d.kind) {
          case 'arrow':
            this.audio.play('arrowShot');
            break;
          case 'magicBolt':
            this.audio.play('magicShot');
            break;
          case 'cannonShell':
            this.audio.play('cannonShot');
            break;
        }
      }),
    );

    unsubs.push(
      eventBus.on('projectile:impact', (d) => {
        if (d.splash) {
          this.vfx.emitExplosion(d.x, d.y, 50);
          this.audio.play('explosion');
        }
      }),
    );

    unsubs.push(
      eventBus.on('boss:spawn', () => {
        this.audio.play('bossWarning');
        this.audio.playMusic('boss');
      }),
    );

    unsubs.push(
      eventBus.on('boss:phase', () => {
        this.audio.play('bossPhase');
      }),
    );

    unsubs.push(
      eventBus.on('boss:area-attack', (d) => {
        this.vfx.emitLightning(d.x, d.y, d.radius);
        this.audio.play('bossAreaImpact');
      }),
    );

    unsubs.push(
      eventBus.on('boss:death', (d) => {
        this.vfx.emitDeath(d.x, d.y, true);
        this.audio.play('bossDeath');
        this.audio.playMusic('battle');
      }),
    );

    unsubs.push(
      eventBus.on('soldier:hit', (d) => {
        this.vfx.emitHit(d.x, d.y, false, d.damageType);
        this.audio.play('soldierHit');
      }),
    );

    unsubs.push(
      eventBus.on('soldier:death', (d) => {
        this.audio.play('soldierDeath');
        this.vfx.emitHit(d.x, d.y, false, 'physical');
      }),
    );

    unsubs.push(
      eventBus.on('wave:start', () => {
        this.audio.play('waveStart');
      }),
    );

    unsubs.push(
      eventBus.on('wave:complete', () => {
        this.audio.play('waveComplete');
      }),
    );

    unsubs.push(
      eventBus.on('enemy:reached', () => {
        this.audio.play('lifeLost');
      }),
    );

    unsubs.push(
      eventBus.on('game:victory', () => {
        this.audio.play('victory');
        this.audio.stopMusic();
      }),
    );

    unsubs.push(
      eventBus.on('game:over', () => {
        this.audio.play('defeat');
        this.audio.stopMusic();
      }),
    );

    unsubs.push(
      eventBus.on('status:apply', (d) => {
        this.vfx.emitStatus(d.x, d.y, d.type);
      }),
    );
  }

  update(dt: number): void {
    this.vfx.update(dt);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.vfx.draw(ctx);
  }

  reset(): void {
    this.vfx.reset();
    this.audio.playMusic('battle');
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
    this.audio.dispose();
    this.vfx.reset();
    this.initialized = false;
  }
}
