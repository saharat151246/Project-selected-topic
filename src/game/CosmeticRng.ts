/**
 * CosmeticRng — Deterministic seed-based xorshift RNG for presentation.
 * Keeps cosmetic randomness repeatable without affecting game logic.
 */
export class CosmeticRng {
  private state: number;

  constructor(seed = 42) {
    this.state = seed | 0 || 1;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let s = this.state;
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    this.state = s;
    return (s >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Pick random item from array */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}
