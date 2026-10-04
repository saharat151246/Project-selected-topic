import { TOWERS, TOWER_ORDER } from '../../data/towers';
import type { TowerTypeId } from '../../types/game';
import { popupPlacement } from './popup';

interface Props {
  x: number;
  y: number;
  mapWidth: number;
  mapHeight: number;
  gold: number;
  onBuild: (typeId: TowerTypeId) => void;
}

export default function BuildMenu({ x, y, mapWidth, mapHeight, gold, onBuild }: Props) {
  const { left, top, below } = popupPlacement(x, y, mapWidth, mapHeight);

  return (
    <div className={`build-menu${below ? ' below' : ''}`} style={{ left, top }} role="menu" aria-label="Build tower">
      <div className="popup-title">Build Tower</div>
      <div className="build-grid">
        {TOWER_ORDER.map((id) => {
          const t = TOWERS[id];
          const poor = gold < t.cost;
          return (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={`build-btn${poor ? ' poor' : ''}`}
              disabled={poor}
              onClick={() => onBuild(id)}
            >
              <span className="build-icon">{t.symbol}</span>
              <span className="build-name">{t.name}</span>
              <span className="build-cost">💰 {t.cost}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
