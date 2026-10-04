/**
 * SaveSystem — Handles saving and loading settings to localStorage
 * with sanitization and validation per field.
 */

import type { EffectsLevel, SaveData, SettingsData } from '../types/save';

const STORAGE_KEY = 'tower_defense_save_v1';
const BACKUP_KEY = 'tower_defense_save_backup';
const CURRENT_VERSION = 1;

export function getDefaultEffectsLevel(): EffectsLevel {
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'low';
    }
  }
  return 'high';
}

export function getDefaultSettings(): SettingsData {
  return {
    musicVolume: 50,
    sfxVolume: 70,
    muted: false,
    effects: getDefaultEffectsLevel(),
  };
}

export function sanitizeSettings(raw: unknown): SettingsData {
  const defaults = getDefaultSettings();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const s = raw as Record<string, unknown>;

  const musicVolume =
    typeof s.musicVolume === 'number' && Number.isFinite(s.musicVolume)
      ? Math.max(0, Math.min(100, Math.round(s.musicVolume)))
      : defaults.musicVolume;

  const sfxVolume =
    typeof s.sfxVolume === 'number' && Number.isFinite(s.sfxVolume)
      ? Math.max(0, Math.min(100, Math.round(s.sfxVolume)))
      : defaults.sfxVolume;

  const muted = typeof s.muted === 'boolean' ? s.muted : defaults.muted;

  let effects: EffectsLevel = defaults.effects;
  if (s.effects === 'high' || s.effects === 'low' || s.effects === 'off') {
    effects = s.effects;
  }

  return { musicVolume, sfxVolume, muted, effects };
}

export function sanitizeSaveData(raw: unknown): SaveData {
  const defaultSave: SaveData = {
    version: 1,
    settings: getDefaultSettings(),
    unlockedMaps: ['greenValley'],
    achievements: [],
    bestScores: {},
  };

  if (!raw || typeof raw !== 'object') {
    return defaultSave;
  }

  const d = raw as Record<string, unknown>;
  const settings = sanitizeSettings(d.settings);

  const bestScores: Record<string, number> = {};
  if (d.bestScores && typeof d.bestScores === 'object') {
    for (const [k, v] of Object.entries(d.bestScores as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        bestScores[k] = Math.max(0, Math.round(v));
      }
    }
  }

  return {
    version: 1,
    settings,
    lastPlayedMap: typeof d.lastPlayedMap === 'string' ? d.lastPlayedMap : undefined,
    unlockedMaps: Array.isArray(d.unlockedMaps) ? d.unlockedMaps.filter((m) => typeof m === 'string') : ['greenValley'],
    achievements: Array.isArray(d.achievements) ? d.achievements.filter((a) => typeof a === 'string') : [],
    bestScores,
  };
}

export class SaveSystem {
  private static saveTimeout = 0;

  static load(): SaveData {
    if (typeof localStorage === 'undefined') {
      return sanitizeSaveData(null);
    }
    try {
      const item = localStorage.getItem(STORAGE_KEY);
      if (!item) return sanitizeSaveData(null);
      const parsed = JSON.parse(item);

      // Version mismatch warning
      if (parsed && typeof parsed === 'object' && parsed.version !== CURRENT_VERSION) {
        console.warn(
          `[SaveSystem] Save version mismatch: found v${parsed.version}, expected v${CURRENT_VERSION}. Data will be migrated.`,
        );
      }

      return sanitizeSaveData(parsed);
    } catch (err) {
      console.warn('[SaveSystem] Failed to load save data, using defaults:', err);
      return sanitizeSaveData(null);
    }
  }

  static save(data: SaveData): void {
    if (typeof localStorage === 'undefined') return;
    try {
      // Backup existing save before overwriting
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        try {
          localStorage.setItem(BACKUP_KEY, existing);
        } catch {
          // Backup failed (storage full), proceed with save anyway
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[SaveSystem] Failed to save data:', err);
    }
  }

  static saveDebounced(data: SaveData, delayMs = 300): void {
    if (typeof window === 'undefined') return;
    window.clearTimeout(SaveSystem.saveTimeout);
    SaveSystem.saveTimeout = window.setTimeout(() => {
      SaveSystem.save(data);
    }, delayMs);
  }

  static recordScore(mapId: string, score: number): boolean {
    const data = SaveSystem.load();
    if (!data.bestScores) data.bestScores = {};
    const prev = data.bestScores[mapId] ?? 0;
    if (score > prev) {
      data.bestScores[mapId] = score;
      SaveSystem.save(data);
      return true;
    }
    return false;
  }

  static getBestScore(mapId: string): number {
    const data = SaveSystem.load();
    return data.bestScores?.[mapId] ?? 0;
  }

  static unlockAchievement(id: string): boolean {
    const data = SaveSystem.load();
    if (!data.achievements) data.achievements = [];
    if (!data.achievements.includes(id)) {
      data.achievements.push(id);
      SaveSystem.save(data);
      return true;
    }
    return false;
  }

  static isAchievementUnlocked(id: string): boolean {
    const data = SaveSystem.load();
    return data.achievements?.includes(id) ?? false;
  }
}
