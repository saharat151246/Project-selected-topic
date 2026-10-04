import { useEffect, useRef, useState } from 'react';
import type { GameSnapshot } from '../../types/game';

interface Props {
  snapshot: GameSnapshot;
}

export default function HUD({ snapshot }: Props) {
  const [lifePulsing, setLifePulsing] = useState(false);
  const prevLifeRef = useRef(snapshot.life);
  const waveLabel = snapshot.totalWaves > 0 ? `${snapshot.wave} / ${snapshot.totalWaves}` : 'No waves';

  useEffect(() => {
    if (snapshot.life < prevLifeRef.current) {
      setLifePulsing(true);
      const timer = setTimeout(() => setLifePulsing(false), 400);
      prevLifeRef.current = snapshot.life;
      return () => clearTimeout(timer);
    }
    prevLifeRef.current = snapshot.life;
  }, [snapshot.life]);

  return (
    <div className="hud">
      <span className={`hud-stat ${lifePulsing ? 'hud-life-pulse' : ''}`}>❤️ {snapshot.life}</span>
      <span className="hud-stat">💰 {snapshot.gold}</span>
      <span className="hud-stat">
        🌊 {waveLabel}
      </span>
      <span className="hud-stat">⭐ {snapshot.score}</span>
      <span className="hud-stat">Enemy: {snapshot.enemyCount}</span>
    </div>
  );
}
