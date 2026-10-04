/**
 * AudioSystem — Procedural Web Audio API synthesizer for SFX and dynamic music.
 * Complies with Phase 7:
 * - Polyphony <= 16 with priority & minInterval throttle
 * - Volume conversion: v^2 (0..100 -> 0..1)
 * - Mute: master gain 0 with 30ms ramp
 * - Lookahead scheduler (~25ms interval, schedules ~120ms ahead)
 * - Generative music tracks: 'menu', 'battle', 'boss' with ~1.5s crossfade
 * - Ducking to 50% when paused
 * - Disconnect nodes after playback to prevent memory leaks
 */

import {
  DEFAULT_SOUND_META,
  MUSIC_PATTERNS,
  type MusicTrackId,
  SOUND_META,
} from '../data/audio';
import {
  type AudioBackend,
  createDefaultAudioBackend,
  createStaticNoiseBuffer,
} from '../systems/AudioSynth';
import type { SettingsData } from '../types/save';

export type SfxName =
  | 'uiClick'
  | 'towerBuild'
  | 'towerUpgrade'
  | 'towerSell'
  | 'arrowShot'
  | 'magicShot'
  | 'cannonShot'
  | 'impactHit'
  | 'explosion'
  | 'enemyDeath'
  | 'soldierHit'
  | 'soldierDeath'
  | 'lifeLost'
  | 'waveStart'
  | 'waveComplete'
  | 'bossWarning'
  | 'bossPhase'
  | 'bossDeath'
  | 'bossAreaTelegraph'
  | 'bossAreaImpact'
  | 'victory'
  | 'defeat'
  | 'notEnoughGold';

interface ActiveVoice {
  priority: number;
  startTime: number;
  stop: () => void;
}

export class AudioSystem {
  private backend: AudioBackend | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private activeVoices: ActiveVoice[] = [];
  private lastPlayedTime = new Map<string, number>();

  private initialized = false;
  private warnedNoAudio = false;

  private settings: SettingsData = {
    musicVolume: 50,
    sfxVolume: 70,
    muted: false,
    effects: 'high',
  };

  // Music state
  private currentTrack: MusicTrackId | null = null;
  private musicTimer: number | null = null;
  private isDucked = false;
  private activeMusicChannels: Array<{
    track: MusicTrackId;
    channelGain: GainNode;
    step: number;
    nextNoteTime: number;
    isFadingOut: boolean;
    fadeEndTime: number;
  }> = [];

  constructor(backend?: AudioBackend) {
    if (backend) {
      this.initBackend(backend);
    }
  }

  /**
   * Initialize upon user gesture (pointerdown/keydown)
   */
  init(backend?: AudioBackend): void {
    if (this.initialized) {
      if (this.backend && this.backend.state === 'suspended') {
        this.backend.resume().catch(() => {});
      }
      return;
    }
    const b = backend || createDefaultAudioBackend();
    if (!b) {
      if (!this.warnedNoAudio) {
        console.warn('Web Audio not supported or unavailable in this environment.');
        this.warnedNoAudio = true;
      }
      return;
    }
    this.initBackend(b);
  }

  private initBackend(backend: AudioBackend): void {
    try {
      this.backend = backend;
      this.compressor = backend.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, backend.currentTime);
      this.compressor.knee.setValueAtTime(20, backend.currentTime);
      this.compressor.ratio.setValueAtTime(8, backend.currentTime);
      this.compressor.attack.setValueAtTime(0.003, backend.currentTime);
      this.compressor.release.setValueAtTime(0.2, backend.currentTime);
      this.compressor.connect(backend.destination);

      this.masterGain = backend.createGain();
      this.masterGain.connect(this.compressor);

      this.sfxGain = backend.createGain();
      this.sfxGain.connect(this.masterGain);

      this.musicGain = backend.createGain();
      this.musicGain.connect(this.masterGain);

      this.noiseBuffer = createStaticNoiseBuffer(backend);
      this.initialized = true;

      this.applyVolumes(true);
      this.startMusicScheduler();

      // If a track was queued before user gesture, start it now
      if (this.currentTrack) {
        const t = this.currentTrack;
        this.currentTrack = null;
        this.playMusic(t);
      }
    } catch {
      if (!this.warnedNoAudio) {
        console.warn('Failed to initialize AudioContext');
        this.warnedNoAudio = true;
      }
    }
  }

  updateSettings(settings: Partial<SettingsData>): void {
    Object.assign(this.settings, settings);
    this.applyVolumes(false);
  }

  private applyVolumes(immediate = false): void {
    if (!this.backend || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.backend.currentTime;
    const rampTime = immediate ? 0.001 : 0.03;

    // Convert 0..100 to gain with v^2 curve
    const masterTarget = this.settings.muted ? 0 : 1;
    const sfxTarget = Math.pow(Math.max(0, Math.min(100, this.settings.sfxVolume)) / 100, 2);
    const musicTargetBase = Math.pow(Math.max(0, Math.min(100, this.settings.musicVolume)) / 100, 2);
    const musicTarget = this.isDucked ? musicTargetBase * 0.5 : musicTargetBase;

    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(masterTarget, now + rampTime);

    this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, now);
    this.sfxGain.gain.linearRampToValueAtTime(sfxTarget, now + rampTime);

    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(musicTarget, now + rampTime);
  }

  duckMusic(duck: boolean): void {
    if (this.isDucked === duck) return;
    this.isDucked = duck;
    this.applyVolumes(false);
  }

  // ===== SFX System with Throttle & Priority Polyphony =====

  play(name: SfxName): void {
    if (!this.backend || !this.initialized || this.settings.muted) return;
    if (this.backend.state === 'suspended') {
      this.backend.resume().catch(() => {});
    }

    const now = performance.now();
    const meta = SOUND_META[name] || DEFAULT_SOUND_META;
    const last = this.lastPlayedTime.get(name) || 0;
    if (now - last < meta.minIntervalMs) {
      return; // Throttled
    }
    this.lastPlayedTime.set(name, now);

    // Limit polyphony to 16
    if (this.activeVoices.length >= 16) {
      // Find lowest priority or oldest voice to drop
      let dropIndex = -1;
      let minPri = meta.priority;
      let oldestTime = Infinity;

      for (let i = 0; i < this.activeVoices.length; i++) {
        const v = this.activeVoices[i];
        if (v.priority < minPri || (v.priority === minPri && v.startTime < oldestTime)) {
          minPri = v.priority;
          oldestTime = v.startTime;
          dropIndex = i;
        }
      }

      if (dropIndex !== -1) {
        const dropped = this.activeVoices.splice(dropIndex, 1)[0];
        dropped.stop();
      } else {
        return; // Current sound has lower priority than all 16 active voices
      }
    }

    this.synthesizeSfx(name, meta.priority);
  }

  private synthesizeSfx(name: SfxName, priority: number): void {
    if (!this.backend || !this.sfxGain) return;
    const ctx = this.backend;
    const dest = this.sfxGain;
    const t = ctx.currentTime;

    const stopCallbacks: Array<() => void> = [];

    const registerVoice = (duration: number) => {
      const voice: ActiveVoice = {
        priority,
        startTime: performance.now(),
        stop: () => {
          stopCallbacks.forEach((cb) => cb());
        },
      };
      this.activeVoices.push(voice);
      setTimeout(() => {
        const idx = this.activeVoices.indexOf(voice);
        if (idx !== -1) this.activeVoices.splice(idx, 1);
      }, duration * 1000);
    };

    switch (name) {
      case 'uiClick': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.04);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.04);
        break;
      }
      case 'towerBuild':
      case 'towerUpgrade': {
        const baseFreq = name === 'towerUpgrade' ? 440 : 330;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.12);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.12);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.12);
        break;
      }
      case 'towerSell': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(250, t + 0.1);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.1);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.1);
        break;
      }
      case 'arrowShot': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.06);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.06);
        break;
      }
      case 'magicShot': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, t);
        osc.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.12);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.12);
        break;
      }
      case 'cannonShot':
      case 'explosion': {
        const duration = name === 'explosion' ? 0.35 : 0.22;
        // Low pitch thud
        const osc = ctx.createOscillator();
        const g1 = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + duration);
        g1.gain.setValueAtTime(0.3, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(g1);
        g1.connect(dest);
        osc.start(t);
        osc.stop(t + duration);

        // Noise blast
        let src: AudioBufferSourceNode | null = null;
        if (this.noiseBuffer) {
          src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.25, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + duration);
          src.connect(g2);
          g2.connect(dest);
          src.start(t);
          src.stop(t + duration);
        }

        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g1.disconnect(); } catch {}
          try { src?.stop(); src?.disconnect(); } catch {}
        });
        registerVoice(duration);
        break;
      }
      case 'impactHit':
      case 'soldierHit': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.07);
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.07);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.07);
        break;
      }
      case 'enemyDeath':
      case 'soldierDeath': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.12);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.12);
        break;
      }
      case 'bossWarning': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(110, t);
        osc1.frequency.exponentialRampToValueAtTime(65, t + 0.5);
        osc2.frequency.setValueAtTime(82.4, t);
        osc2.frequency.exponentialRampToValueAtTime(55, t + 0.5);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc1.connect(g);
        osc2.connect(g);
        g.connect(dest);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.5);
        osc2.stop(t + 0.5);
        stopCallbacks.push(() => {
          try { osc1.stop(); osc2.stop(); osc1.disconnect(); osc2.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.5);
        break;
      }
      case 'bossPhase':
      case 'bossAreaImpact': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.4);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.4);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.4);
        break;
      }
      case 'bossDeath': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.6);
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.6);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.6);
        break;
      }
      case 'victory': {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t + i * 0.12);
          g.gain.setValueAtTime(0, t);
          g.gain.setValueAtTime(0.25, t + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.35);
          osc.connect(g);
          g.connect(dest);
          osc.start(t + i * 0.12);
          osc.stop(t + i * 0.12 + 0.35);
          stopCallbacks.push(() => {
            try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
          });
        });
        registerVoice(0.8);
        break;
      }
      case 'defeat': {
        [220, 196, 174.61, 146.83].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t + i * 0.18);
          g.gain.setValueAtTime(0, t);
          g.gain.setValueAtTime(0.2, t + i * 0.18);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.4);
          osc.connect(g);
          g.connect(dest);
          osc.start(t + i * 0.18);
          osc.stop(t + i * 0.18 + 0.4);
          stopCallbacks.push(() => {
            try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
          });
        });
        registerVoice(1.0);
        break;
      }
      default: {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        osc.stop(t + 0.08);
        stopCallbacks.push(() => {
          try { osc.stop(); osc.disconnect(); g.disconnect(); } catch {}
        });
        registerVoice(0.08);
        break;
      }
    }
  }

  // ===== Generative Music Scheduler with 1.5s Crossfade =====

  getCurrentTrack(): MusicTrackId | null {
    return this.currentTrack;
  }

  playMusic(track: MusicTrackId): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;

    if (!this.backend || !this.musicGain) {
      // AudioContext not yet unlocked, track will be started in initBackend
      return;
    }

    const ctx = this.backend;
    const now = ctx.currentTime;
    const CROSSFADE_DURATION = 1.5;

    // Fade out currently playing channels
    for (const ch of this.activeMusicChannels) {
      if (!ch.isFadingOut) {
        ch.isFadingOut = true;
        ch.fadeEndTime = now + CROSSFADE_DURATION;
        try {
          ch.channelGain.gain.setValueAtTime(ch.channelGain.gain.value, now);
          ch.channelGain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_DURATION);
        } catch {}
      }
    }

    // Create channel gain for incoming track
    const channelGain = ctx.createGain();
    channelGain.connect(this.musicGain);

    if (this.activeMusicChannels.length > 0) {
      // Crossfade in
      channelGain.gain.setValueAtTime(0.0001, now);
      channelGain.gain.linearRampToValueAtTime(1.0, now + CROSSFADE_DURATION);
    } else {
      // Direct start
      channelGain.gain.setValueAtTime(1.0, now);
    }

    this.activeMusicChannels.push({
      track,
      channelGain,
      step: 0,
      nextNoteTime: now + 0.05,
      isFadingOut: false,
      fadeEndTime: 0,
    });
  }

  stopMusic(): void {
    this.currentTrack = null;
    if (this.backend) {
      const now = this.backend.currentTime;
      for (const ch of this.activeMusicChannels) {
        ch.isFadingOut = true;
        ch.fadeEndTime = now + 0.8;
        try {
          ch.channelGain.gain.setValueAtTime(ch.channelGain.gain.value, now);
          ch.channelGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
        } catch {}
      }
    }
  }

  private startMusicScheduler(): void {
    if (this.musicTimer !== null) return;
    this.musicTimer = window.setInterval(() => {
      this.scheduleMusicNotes();
    }, 25);
  }

  private scheduleMusicNotes(): void {
    if (!this.backend || !this.musicGain || this.settings.muted) return;
    const ctx = this.backend;
    const now = ctx.currentTime;

    // Remove finished fade-out channels
    for (let i = this.activeMusicChannels.length - 1; i >= 0; i--) {
      const ch = this.activeMusicChannels[i];
      if (ch.isFadingOut && now >= ch.fadeEndTime) {
        try {
          ch.channelGain.disconnect();
        } catch {}
        this.activeMusicChannels.splice(i, 1);
      }
    }

    for (const channel of this.activeMusicChannels) {
      const pattern = MUSIC_PATTERNS[channel.track];
      if (!pattern) continue;

      const secondsPerBeat = 60.0 / pattern.bpm;
      const stepDuration = secondsPerBeat / 2; // 8th notes

      // Schedule up to 120ms ahead
      while (channel.nextNoteTime < ctx.currentTime + 0.12) {
        const playTime = Math.max(ctx.currentTime, channel.nextNoteTime);

        // Play bassline on beat
        if (channel.step % 2 === 0) {
          const bassIdx = (channel.step / 2) % pattern.bassNotes.length;
          const bassFreq = pattern.bassNotes[bassIdx];
          this.playMusicVoice(bassFreq, 'triangle', playTime, stepDuration * 1.8, 0.12, channel.channelGain);
        }

        // Play melody
        const melIdx = pattern.melodyNotes[channel.step % pattern.melodyNotes.length];
        const melFreq = pattern.scale[melIdx % pattern.scale.length];
        this.playMusicVoice(melFreq, 'sine', playTime, stepDuration * 0.85, 0.07, channel.channelGain);

        channel.nextNoteTime += stepDuration;
        channel.step++;
      }
    }
  }

  private playMusicVoice(
    freq: number,
    type: OscillatorType,
    time: number,
    duration: number,
    volume: number,
    destGain: GainNode,
  ): void {
    if (!this.backend) return;
    const ctx = this.backend;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(volume, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(g);
    g.connect(destGain);

    osc.start(time);
    osc.stop(time + duration);

    setTimeout(() => {
      try {
        osc.disconnect();
        g.disconnect();
      } catch {}
    }, (time - ctx.currentTime + duration + 0.05) * 1000);
  }

  suspend(): void {
    if (this.backend && this.backend.state === 'running') {
      this.backend.suspend().catch(() => {});
    }
  }

  resume(): void {
    if (this.backend && this.backend.state === 'suspended' && !this.settings.muted) {
      this.backend.resume().catch(() => {});
    }
  }

  dispose(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const ch of this.activeMusicChannels) {
      try {
        ch.channelGain.disconnect();
      } catch {}
    }
    this.activeMusicChannels.length = 0;
    this.activeVoices.forEach((v) => v.stop());
    this.activeVoices.length = 0;
    if (this.backend) {
      this.backend.close().catch(() => {});
      this.backend = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.compressor = null;
    }
    this.initialized = false;
  }
}

// Global audio singleton for event delegation & UI click
export const globalAudio = new AudioSystem();
