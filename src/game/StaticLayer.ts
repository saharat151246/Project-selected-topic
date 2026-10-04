/**
 * StaticLayer — Pre-renders static map features (background, path, spawn, castle, spots)
 * to an OffscreenCanvas to drastically reduce draw calls per frame.
 */

import type { MapData } from '../types/game';

const TREES: ReadonlyArray<readonly [number, number, number]> = [
  [90, 110, 26],
  [170, 230, 22],
  [60, 360, 24],
  [540, 600, 26],
  [380, 640, 22],
  [700, 90, 24],
  [860, 120, 26],
  [1000, 640, 24],
  [1120, 560, 22],
  [1200, 420, 26],
  [1180, 110, 24],
];

export class StaticLayer {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private lastMapId = '';
  private lastDpr = 1;

  render(map: MapData, dpr = 1): HTMLCanvasElement | OffscreenCanvas | null {
    if (this.canvas && this.lastMapId === map.id && this.lastDpr === dpr) {
      return this.canvas;
    }

    this.lastMapId = map.id;
    this.lastDpr = dpr;

    try {
      const w = Math.round(map.width * dpr);
      const h = Math.round(map.height * dpr);
      if (typeof OffscreenCanvas !== 'undefined') {
        this.canvas = new OffscreenCanvas(w, h);
        this.ctx = this.canvas.getContext('2d');
      } else {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        this.canvas = c;
        this.ctx = c.getContext('2d');
      }
    } catch {
      return null;
    }

    if (!this.ctx) return null;
    const ctx = this.ctx as CanvasRenderingContext2D;

    // Scale to logical coords so all drawing uses logical sizes
    ctx.save();
    ctx.scale(dpr, dpr);

    // Draw background
    ctx.fillStyle = '#2f855a';
    ctx.fillRect(0, 0, map.width, map.height);

    // Decor trees
    for (const [x, y, r] of TREES) {
      ctx.fillStyle = '#22543d';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#276749';
      ctx.beginPath();
      ctx.arc(x - 3, y - 4, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Path
    if (map.path.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Path border
      ctx.strokeStyle = '#b7791f';
      ctx.lineWidth = 64;
      ctx.beginPath();
      ctx.moveTo(map.path[0].x, map.path[0].y);
      for (let i = 1; i < map.path.length; i++) {
        ctx.lineTo(map.path[i].x, map.path[i].y);
      }
      ctx.stroke();

      // Path center
      ctx.strokeStyle = '#d69e2e';
      ctx.lineWidth = 54;
      ctx.beginPath();
      ctx.moveTo(map.path[0].x, map.path[0].y);
      for (let i = 1; i < map.path.length; i++) {
        ctx.lineTo(map.path[i].x, map.path[i].y);
      }
      ctx.stroke();

      ctx.restore();
    }

    // Spawn Portal
    const sp = map.spawnPoint;
    if (sp) {
      ctx.fillStyle = '#742a2a';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e53e3e';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Castle
    const ep = map.basePoint;
    if (ep) {
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(ep.x - 22, ep.y - 22, 44, 44);
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(ep.x - 16, ep.y - 16, 32, 32);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(ep.x - 6, ep.y - 4, 12, 20);
    }

    // Tower Spots
    for (const spot of map.towerSpots) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y + 4, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4a5568';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#718096';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // pop DPR scale

    return this.canvas;
  }

  invalidate(): void {
    this.canvas = null;
    this.ctx = null;
  }
}
