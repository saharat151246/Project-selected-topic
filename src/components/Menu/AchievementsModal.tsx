import type { FC } from 'react';
import { ACHIEVEMENTS } from '../../data/achievements';
import { SaveSystem } from '../../systems/SaveSystem';

interface Props {
  onClose: () => void;
}

export const AchievementsModal: FC<Props> = ({ onClose }) => {
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
        padding: '20px',
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          backgroundColor: '#1a202c',
          borderRadius: '16px',
          border: '1px solid #4a5568',
          padding: '28px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#ecc94b', margin: 0 }}>
            🏆 ACHIEVEMENTS
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a0aec0',
              fontSize: '22px',
              cursor: 'pointer',
              padding: '6px 12px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', marginBottom: '20px' }}>
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = SaveSystem.isAchievementUnlocked(ach.id);
            return (
              <div
                key={ach.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px',
                  backgroundColor: unlocked ? '#2d3748' : '#171923',
                  borderRadius: '10px',
                  border: `1px solid ${unlocked ? '#ecc94b' : '#2d3748'}`,
                  opacity: unlocked ? 1 : 0.6,
                }}
              >
                <div style={{ fontSize: '32px' }}>{ach.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: unlocked ? '#ecc94b' : '#cbd5e0' }}>
                      {ach.title}
                    </span>
                    {unlocked && (
                      <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#38a169', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>
                        UNLOCKED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#a0aec0', marginTop: '2px' }}>
                    {ach.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
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
          CLOSE
        </button>
      </div>
    </div>
  );
};
export default AchievementsModal;
