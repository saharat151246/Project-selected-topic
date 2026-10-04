/**
 * AudioSynth — Low-level synthesizer helpers and WebAudio backend interface.
 * Can be mocked in headless or test environments.
 */

export interface AudioBackend {
  readonly currentTime: number;
  readonly state: AudioContextState;
  readonly destination: AudioNode;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  createBufferSource(): AudioBufferSourceNode;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer;
  createDynamicsCompressor(): DynamicsCompressorNode;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

export function createDefaultAudioBackend(): AudioBackend | null {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}

/** Pre-generate a 1-second white noise buffer for explosion / impacts to avoid repeated allocations */
export function createStaticNoiseBuffer(ctx: AudioBackend): AudioBuffer {
  const length = Math.floor(44100 * 1.0);
  const buffer = ctx.createBuffer(1, length, 44100);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}
