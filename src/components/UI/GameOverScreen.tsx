import type { DifficultyId } from '../../types/game';

interface Props {
  escaped: number;
  score: number;
  difficulty: DifficultyId;
  onRestart: () => void;
  onMainMenu?: () => void;
}

export default function GameOverScreen({
  escaped,
  score,
  difficulty,
  onRestart,
  onMainMenu,
}: Props) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Game Over">
      <div className="panel game-over-panel">
        <h1>GAME OVER</h1>
        <div className="game-over-stats">
          <p>Enemies Escaped: {escaped}</p>
          <p>Score: <strong>{score}</strong></p>
          <p>Difficulty: <span className={`diff-badge diff-${difficulty}`}>{difficulty.toUpperCase()}</span></p>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button type="button" className="btn-restart" style={{ flex: 1 }} onClick={onRestart}>
            RESTART
          </button>
          {onMainMenu && (
            <button
              type="button"
              onClick={onMainMenu}
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: '#4a5568',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              MAIN MENU
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
