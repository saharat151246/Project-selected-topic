import type { WavePhase } from '../../types/game';

interface Props {
  wavePhase: WavePhase;
  waveRemaining: number;
  waveTotal: number;
  onStartWave: () => void;
}

export default function WaveControl({
  wavePhase,
  waveRemaining,
  waveTotal,
  onStartWave,
}: Props) {
  if (wavePhase === 'ACTIVE') {
    return (
      <div className="wave-control active" role="status">
        <span className="wave-active-info">
          Enemies: {waveRemaining} / {waveTotal}
        </span>
      </div>
    );
  }

  return (
    <div className="wave-control ready">
      <button
        type="button"
        className="start-wave-btn"
        onClick={onStartWave}
        aria-label="Start Wave"
      >
        START WAVE
      </button>
    </div>
  );
}
