import type { FC } from 'react';
import { MAP_LIST } from '../../data/maps';
import { SaveSystem } from '../../systems/SaveSystem';
import type { MapData } from '../../types/game';

interface Props {
  onSelectMap: (map: MapData) => void;
  onBack: () => void;
}

export const MapSelectScreen: FC<Props> = ({ onSelectMap, onBack }) => {
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
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#ecc94b', margin: 0 }}>
            🗺️ SELECT MAP
          </h2>
          <button
            type="button"
            onClick={onBack}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          {MAP_LIST.map((map) => {
            const best = SaveSystem.getBestScore(map.id);
            return (
              <div
                key={map.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  backgroundColor: '#2d3748',
                  borderRadius: '10px',
                  border: '1px solid #4a5568',
                }}
              >
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#ffffff', marginBottom: '4px' }}>
                    {map.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e0', display: 'flex', gap: '12px' }}>
                    <span>Difficulty: <strong style={{ color: '#ecc94b' }}>{map.difficulty}</strong></span>
                    <span>Best Score: <strong style={{ color: '#68d391' }}>{best > 0 ? best : '-'}</strong></span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectMap(map)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#38a169',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(56,161,105,0.4)',
                  }}
                >
                  PLAY
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onBack}
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
          BACK TO MENU
        </button>
      </div>
    </div>
  );
};
export default MapSelectScreen;
