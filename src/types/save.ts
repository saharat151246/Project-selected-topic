export type EffectsLevel = 'high' | 'low' | 'off';

export interface SettingsData {
  musicVolume: number; // 0 - 100
  sfxVolume: number;   // 0 - 100
  muted: boolean;
  effects: EffectsLevel;
}

export interface SaveData {
  version: number;
  settings: SettingsData;
  lastPlayedMap?: string;
  unlockedMaps?: string[];
  achievements?: string[];
  bestScores?: Record<string, number>;
}
