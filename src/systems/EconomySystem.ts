import { ECONOMY } from '../data/economy';

export class EconomySystem {
  private _gold: number = ECONOMY.initialGold;

  constructor(initial: number = ECONOMY.initialGold) {
    this._gold = Math.max(0, Math.floor(Number.isFinite(initial) ? initial : ECONOMY.initialGold));
  }

  get gold(): number {
    return this._gold;
  }

  canAfford(cost: number): boolean {
    if (!Number.isFinite(cost) || cost < 0) return false;
    return this._gold >= Math.floor(cost);
  }

  spend(amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) return false;
    const intAmount = Math.floor(amount);
    if (this._gold < intAmount) return false;
    this._gold -= intAmount;
    return true;
  }

  earn(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this._gold += Math.floor(amount);
  }

  reset(initial: number = ECONOMY.initialGold): void {
    this._gold = Math.max(0, Math.floor(Number.isFinite(initial) ? initial : ECONOMY.initialGold));
  }
}

