import { useState } from 'react';
import { globalAudio } from '../../game/AudioSystem';
import { SaveSystem } from '../../systems/SaveSystem';
import type { EffectsLevel, SettingsData } from '../../types/save';

interface Props {
  initialSettings: SettingsData;
  onUpdateSettings: (settings: SettingsData) => void;
  onClose: () => void;
}

export default function SettingsScreen({ initialSettings, onUpdateSettings, onClose }: Props) {
  const [settings, setSettings] = useState<SettingsData>(initialSettings);

  const update = (patch: Partial<SettingsData>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    onUpdateSettings(updated);

    // Save to disk
    const cur = SaveSystem.load();
    cur.settings = updated;
    SaveSystem.saveDebounced(cur);
  };

  const handleSfxChangeEnd = () => {
    globalAudio.play('arrowShot');
  };

  return (
    <div
      className="settings-modal-backdrop"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="settings-card"
        style={{
          backgroundColor: '#1a202c',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          border: '1px solid #4a5568',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ecc94b', margin: 0 }}>
            SETTINGS
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a0aec0',
              fontSize: '24px',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Audio Mute */}
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label htmlFor="settings-mute" style={{ fontSize: '15px', cursor: 'pointer' }}>
            Mute All Audio
          </label>
          <input
            id="settings-mute"
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => update({ muted: e.target.checked })}
            style={{ width: '22px', height: '22px', cursor: 'pointer' }}
          />
        </div>

        {/* Music Volume */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label htmlFor="settings-music-volume" style={{ fontSize: '14px', color: '#cbd5e0' }}>
              Music Volume: {settings.musicVolume}%
            </label>
          </div>
          <input
            id="settings-music-volume"
            type="range"
            min="0"
            max="100"
            value={settings.musicVolume}
            disabled={settings.muted}
            onChange={(e) => update({ musicVolume: Number(e.target.value) })}
            style={{ width: '100%', height: '8px', cursor: 'pointer' }}
          />
        </div>

        {/* SFX Volume */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label htmlFor="settings-sfx-volume" style={{ fontSize: '14px', color: '#cbd5e0' }}>
              SFX Volume: {settings.sfxVolume}%
            </label>
          </div>
          <input
            id="settings-sfx-volume"
            type="range"
            min="0"
            max="100"
            value={settings.sfxVolume}
            disabled={settings.muted}
            onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
            onPointerUp={handleSfxChangeEnd}
            style={{ width: '100%', height: '8px', cursor: 'pointer' }}
          />
        </div>

        {/* Music Track Menu / Preview */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ display: 'block', fontSize: '14px', color: '#cbd5e0', marginBottom: '8px' }}>
            Music Track
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['battle', 'boss', 'menu'] as const).map((track) => {
              const isCurrent = globalAudio.getCurrentTrack() === track;
              return (
                <button
                  key={track}
                  type="button"
                  onClick={() => {
                    globalAudio.init();
                    globalAudio.playMusic(track);
                    // Force state update to highlight selected track
                    setSettings({ ...settings });
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    backgroundColor: isCurrent ? '#3182ce' : '#2d3748',
                    color: '#ffffff',
                    border: `1px solid ${isCurrent ? '#63b3ed' : '#4a5568'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {track}
                </button>
              );
            })}
          </div>
        </div>

        {/* Effects Level Radio Group */}
        <div style={{ marginBottom: '24px' }}>
          <span style={{ display: 'block', fontSize: '14px', color: '#cbd5e0', marginBottom: '8px' }}>
            Visual Effects Quality
          </span>
          <div role="radiogroup" aria-label="Visual Effects Level" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(
              [
                { level: 'high', label: 'High', desc: 'Full particles, projectile trails & floating damage numbers' },
                { level: 'low', label: 'Low', desc: 'Reduced particles, no trails, only large/crit damage' },
                { level: 'off', label: 'Off', desc: 'No particles or damage numbers (maximum performance)' },
              ] as const
            ).map(({ level, label, desc }) => (
              <label
                key={level}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '8px 12px',
                  backgroundColor: settings.effects === level ? '#2d3748' : '#171923',
                  borderRadius: '6px',
                  border: `1px solid ${settings.effects === level ? '#4299e1' : '#2d3748'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="effects-level"
                  value={level}
                  checked={settings.effects === level}
                  onChange={() => update({ effects: level as EffectsLevel })}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#edf2f7' }}>{label}</div>
                  <div style={{ fontSize: '12px', color: '#a0aec0' }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            height: '44px',
            backgroundColor: '#3182ce',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          DONE
        </button>
      </div>
    </div>
  );
}
