/**
 * Generic Object Pool — Reuse objects to reduce GC pressure.
 * Used for Particles, FloatingText, and Projectiles.
 * Enforces a maximum active ceiling to prevent unbounded growth.
 */

export class ObjectPool<T> {
  private pool: T[] = [];
  private active: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly reset: (obj: T) => void,
    initialSize = 0,
    private readonly maxActive = 500,
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  acquire(): T {
    if (this.active.length >= this.maxActive) {
      // Reached ceiling: reuse oldest active item to guarantee bounded memory
      const oldest = this.active.shift()!;
      this.reset(oldest);
      this.active.push(oldest);
      return oldest;
    }
    const obj = this.pool.length > 0 ? this.pool.pop()! : this.factory();
    this.active.push(obj);
    return obj;
  }

  release(obj: T): void {
    const idx = this.active.indexOf(obj);
    if (idx !== -1) {
      this.active[idx] = this.active[this.active.length - 1];
      this.active.pop();
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  releaseAll(): void {
    for (const obj of this.active) {
      this.reset(obj);
      this.pool.push(obj);
    }
    this.active.length = 0;
  }

  /** Iterate active items. Callback returns false → release that item. */
  updateActive(fn: (obj: T) => boolean): void {
    let i = 0;
    while (i < this.active.length) {
      if (!fn(this.active[i])) {
        this.reset(this.active[i]);
        this.pool.push(this.active[i]);
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
      } else {
        i++;
      }
    }
  }

  get activeItems(): readonly T[] {
    return this.active;
  }

  get activeCount(): number {
    return this.active.length;
  }

  get poolSize(): number {
    return this.pool.length;
  }
}
