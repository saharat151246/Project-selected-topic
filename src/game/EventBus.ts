/**
 * EventBus — Decouples Simulation from Presentation.
 * Engine emits events with primitive/simple arguments.
 * Presentation layer subscribes to react visually.
 * No simulation state should flow back through EventBus.
 */

export type GameEventMap = {
  // Combat / Damage
  'enemy:hit': { enemyId: number; x: number; y: number; damage: number; crit: boolean; damageType: 'physical' | 'magic' };
  'enemy:kill': { enemyId: number; x: number; y: number; reward: number; isBoss: boolean };
  'enemy:reached': { enemyId: number; x: number; y: number };
  'soldier:hit': { x: number; y: number; damage: number; damageType: 'physical' | 'magic' };
  'soldier:death': { x: number; y: number };

  // Tower
  'tower:build': { x: number; y: number; typeId: string };
  'tower:upgrade': { x: number; y: number; level: number };
  'tower:sell': { x: number; y: number; refund: number };
  'tower:fire': { fromX: number; fromY: number; kind: string };

  // Projectile
  'projectile:impact': { x: number; y: number; kind: string; splash: boolean };

  // Boss
  'boss:spawn': { name: string };
  'boss:phase': { phase: number; name: string };
  'boss:area-attack': { x: number; y: number; radius: number };
  'boss:death': { x: number; y: number; name: string };

  // Wave
  'wave:start': { wave: number };
  'wave:complete': { wave: number; reward: number };

  // Game State
  'game:victory': {};
  'game:over': {};

  // Status Effect visual
  'status:apply': { x: number; y: number; type: 'burn' | 'poison' | 'slow' | 'freeze' | 'stun' };
};

type EventHandler<T> = (data: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();

  on<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  emit<K extends keyof GameEventMap>(event: K, data: GameEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(data);
      } catch (err) {
        // Presentation errors must never crash simulation, but log for debugging
        console.warn(`[EventBus] Handler error for "${event}":`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

// Singleton shared between Engine and PresentationLayer
export const eventBus = new EventBus();
