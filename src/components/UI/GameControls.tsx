import type { GameSpeed, GameStatus } from '../../types/game';

interface Props {
  status: GameStatus;
  speed: GameSpeed;
  onTogglePause: () => void;
  onSetSpeed: (speed: GameSpeed) => void;
}

export default function GameControls({
  status,
  speed,
  onTogglePause,
  onSetSpeed,
}: Props) {
  const canPause = status === 'PLAYING' || status === 'PAUSED';
  const isPaused = status === 'PAUSED';

  return (
    <div className="game-controls">
      {canPause && (
        <button
          type="button"
          className={`control-btn pause-btn ${isPaused ? 'active' : ''}`}
          onClick={onTogglePause}
          aria-label={isPaused ? 'Resume Game' : 'Pause Game'}
          title="Pause / Resume (Key: P)"
        >
          {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
      )}

      <div className="speed-buttons" role="group" aria-label="Game Speed">
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`control-btn speed-btn ${speed === s ? 'active' : ''}`}
            onClick={() => onSetSpeed(s)}
            aria-label={`Speed ${s}x`}
          >
            x{s}
          </button>
        ))}
      </div>
    </div>
  );
}
