const MAX_DT = 0.1; // กัน dt กระโดดตอนสลับแท็บ

export class GameLoop {
  private rafId: number | null = null;
  private last = 0;

  constructor(private readonly onFrame: (dt: number) => void) {}

  start(): void {
    if (this.rafId !== null) return; // ป้องกัน Loop ซ้อน
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (now: number): void => {
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), MAX_DT);
    this.last = now;
    // ตั้ง frame ถัดไปก่อน เพื่อให้ stop() ใน onFrame ยกเลิกได้
    this.rafId = requestAnimationFrame(this.tick);
    this.onFrame(dt);
  };
}
