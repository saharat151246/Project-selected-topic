import type { Enemy } from '../entities/Enemy';

export class EnemyAbilitySystem {
  update(dt: number, enemies: readonly Enemy[]): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    for (const enemy of enemies) {
      if (!enemy.isActive || enemy.isStunned) continue;

      const abilities = enemy.config.abilities;
      if (!abilities || abilities.length === 0) continue;

      for (let index = 0; index < abilities.length; index += 1) {
        const ability = abilities[index];
        if (ability.kind === 'heal') {
          if (
            !Number.isFinite(ability.interval) ||
            ability.interval <= 0 ||
            !Number.isFinite(ability.amount) ||
            ability.amount <= 0 ||
            !Number.isFinite(ability.radius) ||
            ability.radius <= 0
          ) {
            console.warn(`[Game Warning] Invalid heal ability config for enemy ${enemy.config.id}`);
            continue;
          }

          const cooldown = enemy.abilityCooldowns[index] ?? ability.interval;
          enemy.abilityCooldowns[index] = cooldown - dt;
          if (enemy.abilityCooldowns[index] <= 0) {
            enemy.abilityCooldowns[index] = ability.interval;
            this.executeHeal(enemy, ability.amount, ability.radius, enemies);
          }
        }
      }
    }
  }

  private executeHeal(
    source: Enemy,
    amount: number,
    radius: number,
    enemies: readonly Enemy[],
  ): void {
    for (const target of enemies) {
      // ห้ามฟื้นตัวเอง, ห้ามฟื้น Enemy ที่ตายหรือถูก Remove
      if (target === source || !target.isActive) continue;

      const dist = Math.hypot(target.x - source.x, target.y - source.y);
      if (dist <= radius) {
        target.hp = Math.min(target.maxHp, target.hp + amount);
      }
    }
  }
}
