import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GameEngine } from '../../game/GameEngine';

interface Props {
  engine: GameEngine;
}

export default function GameCanvas({ engine }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[Game Warning] Canvas 2D context is not available.');
      return;
    }
    engine.attach(ctx);
    return () => engine.detach();
  }, [engine]);

  // DPR and dynamic resize keeping 16:9
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let resizeTimer = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        // DPR clamped between 1 and 2
        const rawDpr = window.devicePixelRatio || 1;
        const dpr = Math.min(2, Math.max(1, isFinite(rawDpr) ? rawDpr : 1));

        // Clamped backing width between 640 and 1920
        const cssWidth = Math.max(640, Math.min(1920, rect.width));
        const targetWidth = Math.round(cssWidth * dpr);
        const targetHeight = Math.round(targetWidth * (9 / 16));

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.setTransform(targetWidth / 1280, 0, 0, targetHeight / 720, 0, 0);
          }
        }
      }, 60);
    });

    resizeObserver.observe(canvas);
    return () => {
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, []);

  // Logical coordinate conversion from viewport click
  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    // Only accept primary pointer and ignore multi-touch conflicts
    if (!e.isPrimary) return;

    // Initialize audio context on first user gesture
    engine.presentation.init();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = ((e.clientX - rect.left) / rect.width) * 1280;
    const y = ((e.clientY - rect.top) / rect.height) * 720;
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';

    engine.handleClick(x, y, isTouch);
  };

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={1280}
      height={720}
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
