import { useEffect, useState } from 'react';

interface RotateOverlayProps {
  onPauseGame?: () => void;
  isPlaying?: boolean;
}

export default function RotateOverlay({ onPauseGame, isPlaying }: RotateOverlayProps) {
  const [isPortraitTouch, setIsPortraitTouch] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isTouch = window.matchMedia('(pointer: coarse)').matches;
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      const shouldShow = isTouch && isPortrait;
      setIsPortraitTouch(shouldShow);

      if (shouldShow && isPlaying && onPauseGame) {
        onPauseGame();
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [isPlaying, onPauseGame]);

  if (!isPortraitTouch) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 25, 0.95)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱 ➔ 🔄</div>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#ecc94b' }}>
        Rotate Your Device
      </h2>
      <p style={{ fontSize: '14px', color: '#cbd5e0', maxWidth: '280px', lineHeight: '1.4' }}>
        Please rotate your screen to landscape mode to play the game properly.
      </p>
    </div>
  );
}
