/**
 * Renderer — Procedural 2D Canvas renderer.
 * Optimized according to Phase 7:
 * - Uses StaticLayer for background, decor, path, spawn, castle, and spots
 * - Procedural unit shapes (no abbreviated letters, distinct shapes for Goblin, Wolf, Orc, Knight, Mage, Healer, Bat, Stone Lord)
 * - Level 1-4 distinct procedural towers
 * - Pre-allocated unit sorting buffer to prevent garbage collection spikes
 * - HP bars only drawn when unit is damaged (< maxHp)
 * - No shadowBlur
 */

import { ENEMY_VISUALS } from '../data/visuals';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { Soldier } from '../entities/Soldier';
import type { Tower } from '../entities/Tower';
import type { MapData } from '../types/game';
import { getEnemyPose, getSoldierPose } from './Animation';
import { StaticLayer } from './StaticLayer';

export interface RenderView {
  enemies: readonly Enemy[];
  towers: readonly Tower[];
  projectiles: readonly Projectile[];
  selectedSpotId: number | null;
  selectedTower: Tower | null;
  pathValid: boolean;
  bossRenderInfo?: {
    boss: Enemy | null;
    phase: number;
    telegraph: { center: { x: number; y: number }; radius: number; progress: number } | null;
    impact: { center: { x: number; y: number }; radius: number; remainingTime: number } | null;
  };
}

interface DrawableItem {
  y: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

const staticLayer = new StaticLayer();
const unitBuffer: DrawableItem[] = [];

export function renderGame(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  view: RenderView,
  dpr = 1,
): void {
  ctx.clearRect(0, 0, map.width, map.height);

  // 1. Static layer (cached offscreen)
  const cached = staticLayer.render(map, dpr);
  if (cached) {
    ctx.drawImage(cached, 0, 0, map.width, map.height);
  }

  // 2. Selection highlights & ranges
  drawSelection(ctx, map, view);

  // 3. Boss Telegraph & Aura under units
  drawBossEffects(ctx, view);

  // 4. Towers (sorted by y)
  const towers = view.towers;
  for (let i = 0; i < towers.length; i++) {
    drawTower(ctx, towers[i]);
  }

  // 5. Units (Soldiers & Enemies sorted by y without heap allocations)
  unitBuffer.length = 0;
  const tCount = towers.length;
  for (let i = 0; i < tCount; i++) {
    const sList = towers[i].soldiers;
    for (let j = 0; j < sList.length; j++) {
      const s = sList[j];
      if (s.isAlive) {
        unitBuffer.push({ y: s.y, draw: (c) => drawSoldier(c, s) });
      }
    }
  }

  const enemies = view.enemies;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    unitBuffer.push({ y: e.y, draw: (c) => drawEnemy(c, e) });
  }

  // Stable insertion sort
  for (let i = 1; i < unitBuffer.length; i++) {
    const current = unitBuffer[i];
    let j = i - 1;
    while (j >= 0 && unitBuffer[j].y > current.y) {
      unitBuffer[j + 1] = unitBuffer[j];
      j--;
    }
    unitBuffer[j + 1] = current;
  }

  for (let i = 0; i < unitBuffer.length; i++) {
    unitBuffer[i].draw(ctx);
  }

  // 6. Projectiles
  const projs = view.projectiles;
  for (let i = 0; i < projs.length; i++) {
    drawProjectile(ctx, projs[i]);
  }
}

// ===== Boss Effects (Telegraph, Impact, Aura) =====

function drawBossEffects(ctx: CanvasRenderingContext2D, view: RenderView): void {
  const info = view.bossRenderInfo;
  if (!info) return;

  // Area Attack Telegraph (always shown in all effects levels)
  if (info.telegraph) {
    const { center, radius, progress } = info.telegraph;
    ctx.save();
    ctx.strokeStyle = 'rgba(235, 45, 45, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    const currentR = radius * Math.min(1, Math.max(0, progress));
    ctx.fillStyle = 'rgba(235, 45, 45, 0.28)';
    ctx.beginPath();
    ctx.arc(center.x, center.y, currentR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Impact Flash
  if (info.impact && info.impact.remainingTime > 0) {
    const { center, radius, remainingTime } = info.impact;
    const alpha = Math.min(1, remainingTime / 0.25);
    ctx.save();
    ctx.fillStyle = `rgba(255, 60, 60, ${0.45 * alpha})`;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  // Boss Aura
  if (info.boss && info.boss.isActive && info.phase >= 2) {
    const b = info.boss;
    const isPhase2 = info.phase === 2;
    const auraBase = isPhase2 ? '255, 140, 0' : '220, 20, 20';
    const time = performance.now() / 250;
    const pulse = 0.35 + 0.25 * Math.sin(time);
    const auraR = b.config.radius + 12 + 4 * Math.sin(time);

    ctx.save();
    ctx.fillStyle = `rgba(${auraBase}, ${pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, auraR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${auraBase}, ${pulse * 0.9})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ===== Selection =====

function drawSelection(ctx: CanvasRenderingContext2D, map: MapData, view: RenderView): void {
  if (view.selectedSpotId !== null) {
    const s = map.towerSpots.find((spot) => spot.id === view.selectedSpotId);
    if (s) {
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 36, 26, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const t = view.selectedTower;
  if (t) {
    const range = t.displayRange;
    const isBarracks = Boolean(t.currentBarracks);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(isBarracks ? t.rally.x : t.x, isBarracks ? t.rally.y : t.y, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isBarracks) {
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath();
      ctx.arc(t.rally.x, t.rally.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, 36, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ===== Distinct Towers (Level 1 to 4) =====

function drawTower(ctx: CanvasRenderingContext2D, t: Tower): void {
  const { x, y, level, config } = t;
  const extraHeight = (level - 1) * 5;
  const towerTop = y - 32 - extraHeight;
  const towerHeight = 36 + extraHeight;

  ctx.save();

  // Base stone foundation
  ctx.fillStyle = '#4a5568';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tower body
  ctx.fillStyle = config.color;
  ctx.fillRect(x - 16, towerTop, 32, towerHeight);
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 16, towerTop, 32, towerHeight);

  // Tower Specifics by type & level
  switch (config.id) {
    case 'archer': {
      // Wood plank lines
      ctx.strokeStyle = '#5a3d28';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 14, towerTop + (towerHeight / 3) * i);
        ctx.lineTo(x + 14, towerTop + (towerHeight / 3) * i);
        ctx.stroke();
      }
      // Roof
      ctx.fillStyle = level >= 3 ? '#22543d' : '#276749';
      ctx.beginPath();
      ctx.moveTo(x - 20, towerTop);
      ctx.lineTo(x + 20, towerTop);
      ctx.lineTo(x, towerTop - 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Level 4 golden flag
      if (level === 4) {
        ctx.fillStyle = '#ecc94b';
        ctx.fillRect(x, towerTop - 28, 10, 7);
      }
      break;
    }
    case 'barracks': {
      // Stone battlement crenels
      ctx.fillStyle = '#718096';
      ctx.fillRect(x - 18, towerTop - 8, 36, 8);
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(x - 8, towerTop - 8, 16, 4);
      // Red emblem
      ctx.fillStyle = level >= 3 ? '#9b2c2c' : '#c53030';
      ctx.beginPath();
      ctx.arc(x, towerTop + 14, 6 + level, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mage': {
      // Spire roof
      ctx.fillStyle = level >= 3 ? '#44337a' : '#553c9a';
      ctx.beginPath();
      ctx.moveTo(x - 18, towerTop);
      ctx.lineTo(x + 18, towerTop);
      ctx.lineTo(x, towerTop - 24);
      ctx.closePath();
      ctx.fill();
      // Floating glowing crystal orb
      const orbPulse = Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = level === 4 ? '#faf089' : '#d6bcfa';
      ctx.beginPath();
      ctx.arc(x, towerTop - 30 + orbPulse, 5 + level, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'artillery': {
      // Reinforced iron armor
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(x - 18, towerTop - 4, 36, 10);
      // Cannon barrel
      ctx.fillStyle = level >= 3 ? '#1a202c' : '#4a5568';
      ctx.fillRect(x - 4, towerTop - 14, 8, 14);
      if (level === 4) {
        // Double barrels
        ctx.fillRect(x - 10, towerTop - 12, 6, 12);
        ctx.fillRect(x + 4, towerTop - 12, 6, 12);
      }
      break;
    }
  }

  // Level indicator stars/dots
  for (let i = 0; i < level; i++) {
    ctx.fillStyle = '#ecc94b';
    ctx.beginPath();
    ctx.arc(x - ((level - 1) * 7) / 2 + i * 7, y + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ===== Distinct Procedural Units =====

function drawSoldier(ctx: CanvasRenderingContext2D, s: Soldier): void {
  const pose = getSoldierPose(s.state, performance.now() / 1000);

  ctx.save();
  ctx.translate(s.x + pose.offsetX, s.y + pose.offsetY);
  ctx.scale(pose.scaleX, pose.scaleY);
  ctx.rotate(pose.tilt);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, s.radius * 0.8, s.radius, s.radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Armor Body
  ctx.fillStyle = pose.flash ? '#ffffff' : '#3182ce';
  ctx.beginPath();
  ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a365d';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Helmet Visor
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-s.radius * 0.5, -s.radius * 0.3, s.radius, 3);

  // Sword
  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(s.radius * 0.7, -s.radius * 0.2);
  ctx.lineTo(s.radius * 1.3, -s.radius * 0.9);
  ctx.stroke();

  ctx.restore();

  // HP Bar only if damaged
  if (s.hp < s.maxHp) {
    drawHpBar(ctx, s.x, s.y - s.radius - 8, 22, s.hp / s.maxHp, '#3182ce');
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const visual = ENEMY_VISUALS[e.config.id] || {
    bodyColor: e.config.color,
    accentColor: '#1a202c',
    radius: e.config.radius,
    features: 'goblin',
  };

  const isFlying = Boolean(e.config.flying);
  const isBoss = e.config.type === 'boss';
  const drawY = isFlying ? e.y - 12 : e.y;
  const pose = getEnemyPose(e.blocked ? 'idle' : 'walk', e.distanceTravelled);

  ctx.save();
  ctx.translate(e.x + pose.offsetX, drawY + pose.offsetY);
  ctx.scale(pose.scaleX, pose.scaleY);
  ctx.rotate(pose.tilt);

  // 1. Ground Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, isFlying ? 16 : visual.radius * 0.8, visual.radius, visual.radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Procedural Shapes by Enemy Type
  switch (visual.features) {
    case 'goblin': {
      // Pointy ears
      ctx.fillStyle = visual.accentColor;
      ctx.beginPath();
      ctx.moveTo(-visual.radius * 1.3, -visual.radius * 0.6);
      ctx.lineTo(-visual.radius * 0.3, -visual.radius * 0.2);
      ctx.lineTo(-visual.radius * 0.5, visual.radius * 0.3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(visual.radius * 1.3, -visual.radius * 0.6);
      ctx.lineTo(visual.radius * 0.3, -visual.radius * 0.2);
      ctx.lineTo(visual.radius * 0.5, visual.radius * 0.3);
      ctx.fill();
      // Body
      ctx.fillStyle = visual.bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, visual.radius, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-4, -3, 2, 2);
      ctx.fillRect(2, -3, 2, 2);
      break;
    }
    case 'wolf': {
      // Elongated body with snout
      ctx.fillStyle = visual.bodyColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, visual.radius * 1.2, visual.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Snout
      ctx.fillStyle = visual.accentColor;
      ctx.beginPath();
      ctx.moveTo(visual.radius * 0.6, -2);
      ctx.lineTo(visual.radius * 1.4, 0);
      ctx.lineTo(visual.radius * 0.6, 3);
      ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.moveTo(-visual.radius * 0.3, -visual.radius);
      ctx.lineTo(0, -visual.radius * 0.4);
      ctx.lineTo(-visual.radius * 0.6, -visual.radius * 0.4);
      ctx.fill();
      break;
    }
    case 'orc': {
      // Sturdy broad body
      ctx.fillStyle = visual.bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, visual.radius, 0, Math.PI * 2);
      ctx.fill();
      // Upward tusks
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-6, 2);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-2, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 2);
      ctx.lineTo(4, -4);
      ctx.lineTo(6, 2);
      ctx.fill();
      break;
    }
    case 'knight': {
      // Armor and shield
      ctx.fillStyle = visual.bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, visual.radius, 0, Math.PI * 2);
      ctx.fill();
      // Silver visor
      ctx.fillStyle = '#edf2f7';
      ctx.fillRect(-visual.radius * 0.6, -3, visual.radius * 1.2, 3);
      // Shield
      ctx.fillStyle = '#2b6cb0';
      ctx.beginPath();
      ctx.arc(-visual.radius * 0.8, 0, visual.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mage': {
      // Hooded cloak
      ctx.fillStyle = visual.bodyColor;
      ctx.beginPath();
      ctx.moveTo(0, -visual.radius * 1.2);
      ctx.lineTo(visual.radius, visual.radius);
      ctx.lineTo(-visual.radius, visual.radius);
      ctx.closePath();
      ctx.fill();
      // Glowing orb staff
      ctx.fillStyle = '#d6bcfa';
      ctx.beginPath();
      ctx.arc(visual.radius * 0.9, -visual.radius * 0.5, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'healer': {
      // White/gold robe
      ctx.fillStyle = visual.bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, visual.radius, 0, Math.PI * 2);
      ctx.fill();
      // Green cross
      ctx.fillStyle = '#38a169';
      ctx.fillRect(-2, -visual.radius * 0.5, 4, visual.radius);
      ctx.fillRect(-visual.radius * 0.5, -2, visual.radius, 4);
      break;
    }
    case 'bat': {
      // Flapping wings
      const flap = Math.sin(performance.now() / 80) * 8;
      ctx.fillStyle = visual.bodyColor;
      // Left wing
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-visual.radius * 1.5, -flap);
      ctx.lineTo(-visual.radius * 0.5, 4);
      ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(visual.radius * 1.5, -flap);
      ctx.lineTo(visual.radius * 0.5, 4);
      ctx.fill();
      // Head
      ctx.fillStyle = '#2d3748';
      ctx.beginPath();
      ctx.arc(0, 0, visual.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'boss': {
      // Stone Lord: massive jagged rock body
      ctx.fillStyle = '#4a5568';
      ctx.beginPath();
      ctx.moveTo(-24, -18);
      ctx.lineTo(0, -32);
      ctx.lineTo(26, -16);
      ctx.lineTo(28, 20);
      ctx.lineTo(8, 30);
      ctx.lineTo(-20, 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glowing magma eyes
      ctx.fillStyle = '#dd6b20';
      ctx.fillRect(-12, -8, 6, 4);
      ctx.fillRect(6, -8, 6, 4);

      // Phase cracks
      const hpRatio = e.hp / e.maxHp;
      if (hpRatio < 0.7) {
        ctx.strokeStyle = '#ed8936';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-2, 18);
        ctx.stroke();
      }
      if (hpRatio < 0.4) {
        ctx.strokeStyle = '#f56565';
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(16, 12);
        ctx.stroke();
      }
      break;
    }
  }

  // Blocked ring
  if (e.blocked) {
    ctx.strokeStyle = '#ecc94b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, visual.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // 3. HP Bar only if damaged (Phase 7 rule)
  if (e.hp < e.maxHp) {
    const bw = isBoss ? 52 : 28;
    const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
    drawHpBar(ctx, e.x, drawY - visual.radius - 8, bw, ratio, isBoss ? '#e53e3e' : '#48bb78');
  }

  // 4. Status Indicator dots
  if (e.statusEffects && e.statusEffects.length > 0) {
    drawStatusDots(ctx, e.x, drawY - visual.radius - 14, e.statusEffects);
  }
}

function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  ratio: number,
  color: string,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width * ratio, 3);
}

const STATIC_EFFECT_TYPES: string[] = [];

function drawStatusDots(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  effects: readonly { type: string }[],
): void {
  if (!effects || effects.length === 0) return;
  STATIC_EFFECT_TYPES.length = 0;
  for (let i = 0; i < effects.length; i++) {
    const t = effects[i].type;
    if (STATIC_EFFECT_TYPES.indexOf(t) === -1) {
      STATIC_EFFECT_TYPES.push(t);
    }
  }
  const dotCount = STATIC_EFFECT_TYPES.length;
  if (dotCount === 0) return;
  const spacing = 6;
  const startX = x - ((dotCount - 1) * spacing) / 2;

  for (let idx = 0; idx < dotCount; idx++) {
    const t = STATIC_EFFECT_TYPES[idx];
    switch (t) {
      case 'burn': ctx.fillStyle = '#ed8936'; break;
      case 'poison': ctx.fillStyle = '#48bb78'; break;
      case 'freeze':
      case 'slow': ctx.fillStyle = '#63b3ed'; break;
      case 'stun': ctx.fillStyle = '#ecc94b'; break;
      default: ctx.fillStyle = '#ffffff'; break;
    }
    ctx.beginPath();
    ctx.arc(startX + idx * spacing, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
  const { x, y, kind } = p;
  ctx.save();
  switch (kind) {
    case 'arrow': {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'magicBolt': {
      ctx.fillStyle = '#b794f4';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cannonShell': {
      ctx.fillStyle = '#2d3748';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}
