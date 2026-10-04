/**
 * VfxSystem — Particle effects, floating damage text, visual death ghosts.
 * Uses ObjectPool for zero-allocation particle and text management.
 * All drawing is procedural, no external sprites or fonts.
 * Complies strictly with Phase 7:
 * - No screen shake (forbidden in Phase 7)
 * - No floating gold/heal (forbidden in Phase 7)
 * - Damage aggregation (< 0.15s per enemy merged into 1 number, CRITICAL separate)
 * - Visual death ghosts for enemies and soldiers
 * - High/Low/Off auto-degrade caps
 */

import { EFFECTS_CONFIG, FLOATING_TEXT_CONFIG } from '../data/effects';
import type { DamageType } from '../types/game';
import type { EffectsLevel } from '../types/save';
import { CosmeticRng } from './CosmeticRng';
import { ObjectPool } from './ObjectPool';

// ===== Particle =====
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  gravity: number;
  shrink: boolean;
}

function resetParticle(p: Particle): void {
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
  p.life = 0; p.maxLife = 0; p.size = 0;
  p.r = 255; p.g = 255; p.b = 255; p.alpha = 1;
  p.gravity = 0; p.shrink = false;
}

function createParticle(): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 3, r: 255, g: 255, b: 255, alpha: 1, gravity: 0, shrink: false };
}

// ===== Floating Text =====
export interface FloatingText {
  enemyId: number | null;
  x: number;
  y: number;
  text: string;
  damageValue: number;
  isCrit: boolean;
  life: number;
  maxLife: number;
  color: string;
  fontSize: number;
  createdAt: number;
}

function resetFloatingText(t: FloatingText): void {
  t.enemyId = null;
  t.x = 0; t.y = 0; t.text = ''; t.damageValue = 0; t.isCrit = false;
  t.life = 0; t.maxLife = 0; t.color = '#fff'; t.fontSize = 14;
  t.createdAt = 0;
}

function createFloatingText(): FloatingText {
  return { enemyId: null, x: 0, y: 0, text: '', damageValue: 0, isCrit: false, life: 0, maxLife: 0, color: '#fff', fontSize: 14, createdAt: 0 };
}

// ===== Visual Death Ghost =====
export interface DeathGhost {
  x: number;
  y: number;
  radius: number;
  color: string;
  isBoss: boolean;
  life: number;
  maxLife: number;
}

export class VfxSystem {
  private rng = new CosmeticRng();
  private effectsLevel: EffectsLevel = 'high';

  private particlePool: ObjectPool<Particle>;
  private activeParticles: Particle[] = [];

  private textPool: ObjectPool<FloatingText>;
  private activeTexts: FloatingText[] = [];

  private activeGhosts: DeathGhost[] = [];

  // Lightning impact visual
  private lightningBolts: Array<{ x: number; y: number; radius: number; life: number; maxLife: number }> = [];

  constructor() {
    this.particlePool = new ObjectPool(createParticle, resetParticle, 400);
    this.textPool = new ObjectPool(createFloatingText, resetFloatingText, 40);
  }

  setEffectsLevel(level: EffectsLevel): void {
    this.effectsLevel = level;
  }

  getEffectsLevel(): EffectsLevel {
    return this.effectsLevel;
  }

  getCounts(): { particles: number; texts: number; ghosts: number } {
    return {
      particles: this.activeParticles.length,
      texts: this.activeTexts.length,
      ghosts: this.activeGhosts.length,
    };
  }

  emitHit(x: number, y: number, crit: boolean, damageType: DamageType): void {
    const cap = EFFECTS_CONFIG[this.effectsLevel];
    if (cap.maxParticles === 0) return;

    const count = crit ? 12 : 5;
    for (let i = 0; i < count; i++) {
      if (this.activeParticles.length >= cap.maxParticles) break;
      const p = this.particlePool.acquire();
      if (!p) break;

      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(30, crit ? 140 : 80);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = this.rng.range(0.15, 0.35);
      p.size = crit ? 3.5 : 2;
      p.shrink = true;

      if (damageType === 'magic') {
        p.r = 180; p.g = 120; p.b = 255;
      } else if (crit) {
        p.r = 255; p.g = 220; p.b = 50;
      } else {
        p.r = 255; p.g = 255; p.b = 255;
      }
      this.activeParticles.push(p);
    }
  }

  emitDamage(enemyId: number | null, x: number, y: number, damage: number, crit: boolean, damageType: DamageType): void {
    const cap = EFFECTS_CONFIG[this.effectsLevel];
    if (cap.maxFloatingTexts === 0) return;

    const roundedDamage = Math.max(1, Math.round(damage));

    // Under low effects, filter out small non-crit damage
    if (!crit && roundedDamage < cap.minDamageThreshold) {
      return;
    }

    const now = performance.now();

    // Damage aggregation: merge non-crit hits on the same enemy within mergeWindowMs
    if (!crit && enemyId !== null) {
      const existing = this.activeTexts.find(
        (t) => t.enemyId === enemyId && !t.isCrit && now - t.createdAt < FLOATING_TEXT_CONFIG.mergeWindowMs,
      );
      if (existing) {
        existing.damageValue += roundedDamage;
        existing.text = `-${existing.damageValue}`;
        existing.x = x + this.rng.range(-6, 6);
        existing.y = y - 10;
        return;
      }
    }

    if (this.activeTexts.length >= cap.maxFloatingTexts) return;
    const t = this.textPool.acquire();
    if (!t) return;

    t.enemyId = enemyId;
    t.x = x + this.rng.range(-8, 8);
    t.y = y - 12;
    t.damageValue = roundedDamage;
    t.isCrit = crit;
    t.text = crit ? `CRITICAL! -${roundedDamage}` : `-${roundedDamage}`;
    t.life = 0;
    t.maxLife = FLOATING_TEXT_CONFIG.duration;
    t.fontSize = crit ? 15 : 12;
    t.createdAt = now;

    if (crit) {
      t.color = FLOATING_TEXT_CONFIG.colors.crit;
    } else if (damageType === 'magic') {
      t.color = FLOATING_TEXT_CONFIG.colors.magic;
    } else {
      t.color = FLOATING_TEXT_CONFIG.colors.physical;
    }

    this.activeTexts.push(t);
  }

  emitExplosion(x: number, y: number, radius: number): void {
    const cap = EFFECTS_CONFIG[this.effectsLevel];
    if (cap.maxParticles === 0) return;

    const count = Math.min(25, Math.floor(radius * 0.5));
    for (let i = 0; i < count; i++) {
      if (this.activeParticles.length >= cap.maxParticles) break;
      const p = this.particlePool.acquire();
      if (!p) break;

      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(40, radius * 2.5);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = this.rng.range(0.25, 0.5);
      p.size = this.rng.range(3, 6);
      p.shrink = true;
      p.r = 255;
      p.g = this.rng.int(60, 180);
      p.b = 30;
      this.activeParticles.push(p);
    }
  }

  emitDeath(x: number, y: number, isBoss: boolean, color = '#4a5568'): void {
    // 1. Particle burst
    const cap = EFFECTS_CONFIG[this.effectsLevel];
    if (cap.maxParticles > 0) {
      const count = isBoss ? 45 : 14;
      for (let i = 0; i < count; i++) {
        if (this.activeParticles.length >= cap.maxParticles) break;
        const p = this.particlePool.acquire();
        if (!p) break;

        const angle = this.rng.range(0, Math.PI * 2);
        const speed = this.rng.range(30, isBoss ? 160 : 70);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0;
        p.maxLife = this.rng.range(0.3, isBoss ? 0.8 : 0.45);
        p.size = this.rng.range(2, isBoss ? 5 : 3.5);
        p.shrink = true;
        p.r = isBoss ? 240 : 160;
        p.g = isBoss ? 120 : 160;
        p.b = isBoss ? 40 : 160;
        this.activeParticles.push(p);
      }
    }

    // 2. Visual Ghost that fades out in ~0.4s
    this.activeGhosts.push({
      x,
      y,
      radius: isBoss ? 28 : 12,
      color,
      isBoss,
      life: 0,
      maxLife: 0.4,
    });
  }

  emitUpgrade(x: number, y: number): void {
    const cap = EFFECTS_CONFIG[this.effectsLevel];
    if (cap.maxParticles === 0) return;

    for (let i = 0; i < 16; i++) {
      if (this.activeParticles.length >= cap.maxParticles) break;
      const p = this.particlePool.acquire();
      if (!p) break;

      const angle = (i / 16) * Math.PI * 2;
      const speed = this.rng.range(40, 75);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 20; // upward bias
      p.life = 0;
      p.maxLife = 0.45;
      p.size = 3;
      p.shrink = true;
      p.r = 250; p.g = 200; p.b = 60;
      this.activeParticles.push(p);
    }
  }

  emitStatus(x: number, y: number, type: 'burn' | 'poison' | 'slow' | 'freeze' | 'stun'): void {
    const cap = EFFECTS_CONFIG[this.effectsLevel];
    if (cap.maxParticles === 0) return;

    for (let i = 0; i < 4; i++) {
      if (this.activeParticles.length >= cap.maxParticles) break;
      const p = this.particlePool.acquire();
      if (!p) break;

      p.x = x + this.rng.range(-8, 8);
      p.y = y + this.rng.range(-8, 8);
      p.vx = this.rng.range(-15, 15);
      p.vy = type === 'burn' ? -this.rng.range(25, 45) : this.rng.range(-15, 15);
      p.life = 0;
      p.maxLife = 0.35;
      p.size = 2.5;
      p.shrink = true;

      switch (type) {
        case 'burn': p.r = 240; p.g = 100; p.b = 30; break;
        case 'poison': p.r = 60; p.g = 200; p.b = 60; break;
        case 'slow':
        case 'freeze': p.r = 90; p.g = 180; p.b = 255; break;
        case 'stun': p.r = 255; p.g = 240; p.b = 100; break;
      }
      this.activeParticles.push(p);
    }
  }

  emitLightning(x: number, y: number, radius: number): void {
    this.lightningBolts.push({
      x,
      y,
      radius,
      life: 0,
      maxLife: 0.3,
    });
    this.emitExplosion(x, y, radius);
  }

  update(dt: number): void {
    // 1. Update particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particlePool.release(p);
        this.activeParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    // 2. Update floating texts
    for (let i = this.activeTexts.length - 1; i >= 0; i--) {
      const t = this.activeTexts[i];
      t.life += dt;
      if (t.life >= t.maxLife) {
        this.textPool.release(t);
        this.activeTexts.splice(i, 1);
        continue;
      }
      t.y -= FLOATING_TEXT_CONFIG.floatSpeed * dt;
    }

    // 3. Update ghosts
    for (let i = this.activeGhosts.length - 1; i >= 0; i--) {
      const g = this.activeGhosts[i];
      g.life += dt;
      if (g.life >= g.maxLife) {
        this.activeGhosts.splice(i, 1);
      }
    }

    // 4. Update lightning bolts
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.life += dt;
      if (bolt.life >= bolt.maxLife) {
        this.lightningBolts.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // 1. Draw death ghosts
    for (const g of this.activeGhosts) {
      const p = g.life / g.maxLife;
      const alpha = Math.max(0, 1 - p);
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y + p * 6, g.radius * (1 - p * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw lightning bolts
    for (const bolt of this.lightningBolts) {
      const alpha = Math.max(0, 1 - bolt.life / bolt.maxLife);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Zigzag strike from top of screen to target
      ctx.moveTo(bolt.x + 15, 0);
      ctx.lineTo(bolt.x - 10, bolt.y * 0.4);
      ctx.lineTo(bolt.x + 12, bolt.y * 0.7);
      ctx.lineTo(bolt.x, bolt.y);
      ctx.stroke();

      // Impact ring
      ctx.strokeStyle = `rgba(255, 100, 100, ${alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius * (bolt.life / bolt.maxLife), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw particles
    for (const p of this.activeParticles) {
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`;
      ctx.beginPath();
      const currentSize = p.shrink ? p.size * (1 - p.life / p.maxLife) : p.size;
      ctx.arc(p.x, p.y, Math.max(0.5, currentSize), 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw floating damage text with dark outline
    if (this.activeTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of this.activeTexts) {
        const alpha = Math.max(0, 1 - t.life / t.maxLife);
        ctx.font = `bold ${t.fontSize}px sans-serif`;

        // Dark stroke outline for readability
        ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.85})`;
        ctx.lineWidth = 2.5;
        ctx.strokeText(t.text, t.x, t.y);

        // Fill text
        ctx.fillStyle = t.color;
        ctx.globalAlpha = alpha;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.restore();
    }
  }

  reset(): void {
    this.particlePool.releaseAll();
    this.textPool.releaseAll();
    this.activeParticles.length = 0;
    this.activeTexts.length = 0;
    this.activeGhosts.length = 0;
    this.lightningBolts.length = 0;
  }
}
