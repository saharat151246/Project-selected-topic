/**
 * Uniform Spatial Grid (80px cells) for O(1) area queries.
 * Used for splash damage, targeting in range, and particle culling.
 * Pre-allocates fixed bucket arrays to achieve zero allocation per frame during rebuild.
 */

export interface Positioned {
  x: number;
  y: number;
}

const CELL_SIZE = 80;

export class SpatialGrid<T extends Positioned> {
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: T[][];

  constructor(mapWidth: number, mapHeight = 720) {
    this.cols = Math.max(1, Math.ceil(mapWidth / CELL_SIZE));
    this.rows = Math.max(1, Math.ceil(mapHeight / CELL_SIZE));
    const totalCells = this.cols * this.rows;
    this.buckets = Array.from({ length: totalCells }, () => []);
  }

  private cellCoordX(v: number): number {
    return Math.min(this.cols - 1, Math.max(0, (v / CELL_SIZE) | 0));
  }

  private cellCoordY(v: number): number {
    return Math.min(this.rows - 1, Math.max(0, (v / CELL_SIZE) | 0));
  }

  clear(): void {
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i].length = 0;
    }
  }

  /** Rebuild grid in-place without allocating new maps or arrays */
  rebuild(items: readonly T[]): void {
    this.clear();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cx = this.cellCoordX(item.x);
      const cy = this.cellCoordY(item.y);
      this.buckets[cy * this.cols + cx].push(item);
    }
  }

  /** Query all items within radius of (x,y) */
  queryRadius(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const r2 = radius * radius;

    const minCx = this.cellCoordX(x - radius);
    const maxCx = this.cellCoordX(x + radius);
    const minCy = this.cellCoordY(y - radius);
    const maxCy = this.cellCoordY(y + radius);

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.buckets[rowOffset + cx];
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= r2) {
            results.push(item);
          }
        }
      }
    }
    return results;
  }

  /** Query items within an AABB */
  queryRect(x1: number, y1: number, x2: number, y2: number): T[] {
    const results: T[] = [];
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    const minCx = this.cellCoordX(left);
    const maxCx = this.cellCoordX(right);
    const minCy = this.cellCoordY(top);
    const maxCy = this.cellCoordY(bottom);

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.buckets[rowOffset + cx];
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          if (item.x >= left && item.x <= right && item.y >= top && item.y <= bottom) {
            results.push(item);
          }
        }
      }
    }
    return results;
  }
}
