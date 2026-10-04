/**
 * AppController — Orchestrates application state across screens,
 * map selection, achievements, and persistent scoring.
 */

import { greenValley, MAPS } from '../data/maps';
import { SaveSystem } from '../systems/SaveSystem';
import type { MapData, VictoryResult } from '../types/game';
import { globalAudio } from './AudioSystem';
import { eventBus } from './EventBus';
import { GameEngine } from './GameEngine';

export type AppScreen = 'menu' | 'mapSelect' | 'game';

export class AppController {
  private currentScreen: AppScreen = 'menu';
  private selectedMap: MapData = greenValley;
  private engine: GameEngine | null = null;
  private unsubs: Array<() => void> = [];

  constructor() {
    this.setupAchievementsTracking();
  }

  getScreen(): AppScreen {
    return this.currentScreen;
  }

  getSelectedMap(): MapData {
    return this.selectedMap;
  }

  getAvailableMaps(): Record<string, MapData> {
    return MAPS;
  }

  getEngine(): GameEngine {
    if (!this.engine) {
      this.engine = new GameEngine(this.selectedMap);
    }
    return this.engine;
  }

  setActiveGame(map: MapData, engine: GameEngine): void {
    this.selectedMap = map;
    this.engine = engine;
  }

  clearActiveGame(engine: GameEngine): void {
    if (this.engine === engine) this.engine = null;
  }

  setScreen(screen: AppScreen): void {
    this.currentScreen = screen;
    if (screen === 'menu' || screen === 'mapSelect') {
      globalAudio.playMusic('menu');
      if (this.engine) {
        this.engine.pause();
      }
    } else if (screen === 'game') {
      globalAudio.playMusic('battle');
      if (this.engine) {
        this.engine.resume();
      }
    }
  }

  selectMap(map: MapData): void {
    this.selectedMap = map;
    if (this.engine) {
      this.engine.dispose();
    }
    this.engine = new GameEngine(map);
    this.setScreen('game');
  }

  startQuickPlay(): void {
    if (!this.engine) {
      this.engine = new GameEngine(this.selectedMap);
    }
    this.setScreen('game');
  }

  returnToMenu(): void {
    this.setScreen('menu');
  }

  handleVictory(result: VictoryResult): void {
    // Record best score
    SaveSystem.recordScore(this.selectedMap.id, result.score);

    // Check victory achievements
    SaveSystem.unlockAchievement('first_win');
    if (result.life >= 20) {
      SaveSystem.unlockAchievement('flawless');
    }
    if (result.score >= 6000) {
      SaveSystem.unlockAchievement('high_scorer');
    }
  }

  handleGameOver(score: number): void {
    SaveSystem.recordScore(this.selectedMap.id, score);
  }

  private setupAchievementsTracking(): void {
    this.unsubs.push(
      eventBus.on('boss:death', (data) => {
        if (data.name.includes('Stone Lord')) {
          SaveSystem.unlockAchievement('boss_slayer');
        }
      }),
    );

    this.unsubs.push(
      eventBus.on('tower:build', () => {
        if (this.engine && this.engine.getTowerCount() >= 8) {
          SaveSystem.unlockAchievement('tower_architect');
        }
      }),
    );
  }

  dispose(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }
  }
}

export const appController = new AppController();
