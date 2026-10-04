import { useEffect, useRef, useState } from 'react';
import type { GameEngine } from '../../game/GameEngine';

interface PerfOverlayProps {
  engine: GameEngine;
}

export default function PerfOverlay({ engine }: PerfOverlayProps) {
  const [visible, setVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('debug') === '1';
    }
    return false;
  });

  const fpsRef = useRef<HTMLSpanElement>(null);
  const msRef = useRef<HTMLSpanElement>(null);
  const p99Ref = useRef<HTMLSpanElement>(null);
  const countsRef = useRef<HTMLDivElement>(null);
  const effectsRef = useRef<HTMLSpanElement>(null);

  // Toggle with F3
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update text directly on DOM at ~2Hz (500ms interval) to avoid React re-renders
  useEffect(() => {
    if (!visible) return;

    const interval = window.setInterval(() => {
      const perf = engine.perfMonitor;
      const vfxCounts = engine.presentation.vfx.getCounts();
      const snap = engine.getSnapshot();

      if (fpsRef.current) fpsRef.current.textContent = `${perf.getAverageFps()}`;
      if (msRef.current) msRef.current.textContent = `${perf.getAverageFrameMs()} ms`;
      if (p99Ref.current) p99Ref.current.textContent = `${perf.getP99FrameMs()} ms`;
      if (effectsRef.current) effectsRef.current.textContent = engine.presentation.getEffectsLevel().toUpperCase();

      if (countsRef.current) {
        countsRef.current.textContent = `Enemies: ${snap.enemyCount} | Proj: ${engine.projectileCount} | Particles: ${vfxCounts.particles} | Text: ${vfxCounts.texts}`;
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [visible, engine]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        color: '#48bb78',
        fontFamily: 'monospace',
        fontSize: '12px',
        padding: '8px 12px',
        borderRadius: '6px',
        pointerEvents: 'none',
        zIndex: 9999,
        lineHeight: '1.5',
        border: '1px solid rgba(72, 187, 120, 0.4)',
      }}
    >
      <div style={{ fontWeight: 'bold', color: '#ecc94b', marginBottom: '2px' }}>
        PERF MONITOR (F3 to hide)
      </div>
      <div>
        FPS: <span ref={fpsRef}>60</span> | Avg: <span ref={msRef}>16.6 ms</span> | P99: <span ref={p99Ref}>16.6 ms</span>
      </div>
      <div>
        Effects Level: <span ref={effectsRef} style={{ color: '#63b3ed', fontWeight: 'bold' }}>HIGH</span>
      </div>
      <div ref={countsRef} style={{ color: '#edf2f7', fontSize: '11px', marginTop: '2px' }}>
        Enemies: 0 | Proj: 0 | Particles: 0 | Text: 0
      </div>
    </div>
  );
}
