import type { VictoryResult } from '../../types/game';

interface Props {
  result: VictoryResult;
  onRestart: () => void;
  onMainMenu?: () => void;
}

export default function VictoryScreen({ result, onRestart, onMainMenu }: Props) {
  const { stars, score, life, escaped, kills, difficulty } = result;

  return (
    <div className="overlay victory-screen" role="dialog" aria-modal="true" aria-label="Victory">
      <div className="panel victory-panel">
        <h2 className="victory-title">VICTORY!</h2>

        <div className="stars-row" aria-label={`${stars} stars`}>
          {[1, 2, 3].map((starIndex) => (
            <span
              key={starIndex}
              className={`star-icon ${starIndex <= stars ? 'earned' : 'unearned'}`}
            >
              ★
            </span>
          ))}
        </div>

        <div className="victory-stats">
          <div className="stat-row highlight">
            <span>Score:</span>
            <strong>{score}</strong>
          </div>
          <div className="stat-row">
            <span>Remaining Life:</span>
            <span>❤️ {life}</span>
          </div>
          <div className="stat-row">
            <span>Enemies Escaped:</span>
            <span>{escaped}</span>
          </div>
          <div className="stat-row">
            <span>Total Kills:</span>
            <span>{kills}</span>
          </div>
          <div className="stat-row">
            <span>Difficulty:</span>
            <span className={`diff-badge diff-${difficulty}`}>
              {difficulty.toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button type="button" className="btn-restart" style={{ flex: 1 }} onClick={onRestart}>
            PLAY AGAIN
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
