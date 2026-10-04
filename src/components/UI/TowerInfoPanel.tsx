import { useEffect, useState } from 'react';
import { TARGET_MODES } from '../../game/TargetingSystem';
import type { TargetMode, TowerInfo } from '../../types/game';
import { popupPlacement } from './popup';

interface Props {
  info: TowerInfo;
  x: number;
  y: number;
  mapWidth: number;
  mapHeight: number;
  gold: number;
  onTargetMode: (towerId: number, mode: TargetMode) => void;
  onUpgrade: (towerId: number) => void;
  onSell: (towerId: number) => void;
  onClose: () => void;
}

export default function TowerInfoPanel({
  info,
  x,
  y,
  mapWidth,
  mapHeight,
  gold,
  onTargetMode,
  onUpgrade,
  onSell,
  onClose,
}: Props) {
  const { left, top, below } = popupPlacement(x, y, mapWidth, mapHeight);
  const [confirmingSell, setConfirmingSell] = useState(false);

  // เปลี่ยน Selection หรือ Tower ID ให้ล้างสถานะ Confirm ทันที
  useEffect(() => {
    setConfirmingSell(false);
  }, [info.id]);

  // ตั้งเวลา 3 วินาทีเพื่อยกเลิกสถานะ Confirm Sell
  useEffect(() => {
    if (!confirmingSell) return;
    const timer = window.setTimeout(() => {
      setConfirmingSell(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [confirmingSell]);

  const isMaxLevel = info.level >= info.maxLevel;
  const cannotAffordUpgrade = !isMaxLevel && gold < info.upgradeCost;

  const handleSellClick = () => {
    if (confirmingSell) {
      onSell(info.id);
      setConfirmingSell(false);
    } else {
      setConfirmingSell(true);
    }
  };

  return (
    <div
      className={`tower-info-panel${below ? ' below' : ''}`}
      style={{ left, top }}
      role="dialog"
      aria-label={`${info.name} tower`}
    >
      <div className="tower-info-header">
        <span>
          {info.symbol} {info.name} · Level {info.level}
        </span>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <dl className="stat-list">
        {info.stats.map((s) => (
          <div key={s.label} className="stat-row">
            <dt>{s.label}</dt>
            <dd className="stat-value">
              {s.nextValue ? (
                <>
                  <span className="current-val">{s.value}</span>
                  <span className="stat-arrow"> → </span>
                  <span className="next-val">{s.nextValue}</span>
                </>
              ) : (
                s.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="tower-actions">
        <button
          type="button"
          className={`action-btn upgrade-btn${cannotAffordUpgrade ? ' poor' : ''}`}
          disabled={isMaxLevel || cannotAffordUpgrade}
          onClick={() => onUpgrade(info.id)}
        >
          {isMaxLevel ? 'MAX' : `Upgrade 💰 ${info.upgradeCost}`}
        </button>
        <button
          type="button"
          className={`action-btn sell-btn${confirmingSell ? ' confirming' : ''}`}
          onClick={handleSellClick}
        >
          {confirmingSell ? `Confirm Sell +${info.sellRefund}` : `Sell +${info.sellRefund}`}
        </button>
      </div>

      {info.hasTargeting && (
        <div className="target-box">
          <div className="target-label">Target</div>
          <div className="target-grid">
            {TARGET_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`target-btn${info.targetMode === m.id ? ' active' : ''}`}
                aria-pressed={info.targetMode === m.id}
                onClick={() => onTargetMode(info.id, m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
