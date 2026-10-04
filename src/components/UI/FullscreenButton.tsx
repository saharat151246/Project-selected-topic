import { useEffect, useState } from 'react';

export default function FullscreenButton() {
  const [enabled, setEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.fullscreenEnabled) {
      setEnabled(true);
    }

    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  if (!enabled) return null;

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        // Try orientation lock if supported
        if ('orientation' in screen && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as { lock: (orientation: string) => Promise<void> }).lock(
              'landscape',
            );
          } catch {
            // Orientation lock not supported or allowed
          }
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen request denied or failed
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(26, 32, 44, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '20px',
        cursor: 'pointer',
        zIndex: 100,
        touchAction: 'manipulation',
      }}
    >
      {isFullscreen ? '⤓' : '⛶'}
    </button>
  );
}
