import type { FC } from 'react';

interface Props {
  onStartGame: () => void;
  onOpenMapSelect: () => void;
  onOpenAchievements: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: FC<Props> = ({
  onStartGame,
  onOpenMapSelect,
  onOpenAchievements,
  onOpenSettings,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 29, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '480px',
          width: '90%',
          padding: '32px',
          backgroundColor: '#1a202c',
          borderRadius: '16px',
          border: '1px solid #4a5568',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ fontSize: '42px', marginBottom: '8px' }}>🏰</div>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '900',
            letterSpacing: '2px',
            color: '#ecc94b',
            margin: '0 0 8px 0',
            textShadow: '0 2px 10px rgba(236,201,75,0.3)',
          }}
        >
          TOWER DEFENSE
        </h1>
        <p style={{ color: '#a0aec0', fontSize: '15px', margin: '0 0 28px 0' }}>
          Tactical Kingdom Defense
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={onStartGame}
            style={{
              padding: '14px',
              backgroundColor: '#38a169',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '17px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(56,161,105,0.4)',
              transition: 'transform 0.1s ease',
            }}
          >
            ▶ QUICK PLAY
          </button>

          <button
            type="button"
            onClick={onOpenMapSelect}
            style={{
              padding: '12px',
              backgroundColor: '#3182ce',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(49,130,206,0.3)',
            }}
          >
            🗺️ SELECT MAP
          </button>

          <button
            type="button"
            onClick={onOpenAchievements}
            style={{
              padding: '12px',
              backgroundColor: '#4a5568',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            🏆 ACHIEVEMENTS
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              padding: '12px',
              backgroundColor: '#2d3748',
              color: '#cbd5e0',
              border: '1px solid #4a5568',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            ⚙️ SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
};
export default MainMenu;
