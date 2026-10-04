import type { BossSnapshot } from '../../types/game';

interface Props {
  boss: BossSnapshot;
}

export default function BossBar({ boss }: Props) {
  return (
    <div className="boss-bar-container" role="status" aria-label="Boss Status">
      <div className="boss-bar-header">
        <span className="boss-name">👑 {boss.name}</span>
        <span className="boss-phase-badge">
          Phase {boss.phase} / {boss.phaseCount}: {boss.phaseName}
        </span>
      </div>
      <div className="boss-hp-track">
        <div
          className={`boss-hp-fill phase-${boss.phase}`}
          style={{ width: `${boss.hpPercent}%` }}
        />
        <span className="boss-hp-text">{boss.hpPercent}%</span>
      </div>
    </div>
  );
}
