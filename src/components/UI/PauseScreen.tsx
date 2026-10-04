interface Props {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu?: () => void;
}

export default function PauseScreen({ onResume, onRestart, onMainMenu }: Props) {
  return (
    <div className="overlay pause-screen" role="dialog" aria-modal="true" aria-label="Game Paused">
      <div className="panel pause-panel">
        <h2>GAME PAUSED</h2>
        <div className="pause-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button type="button" className="btn-resume" onClick={onResume}>
            RESUME
          </button>
          <button type="button" className="btn-restart" onClick={onRestart}>
            RESTART
          </button>
          {onMainMenu && (
            <button
              type="button"
              onClick={onMainMenu}
              style={{
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
