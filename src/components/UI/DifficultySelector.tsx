import { DIFFICULTIES } from '../../data/difficulty';
import type { DifficultyId } from '../../types/game';

interface Props {
  currentDifficulty: DifficultyId;
  onSelect: (id: DifficultyId) => void;
}

export default function DifficultySelector({ currentDifficulty, onSelect }: Props) {
  const list: DifficultyId[] = ['easy', 'normal', 'hard'];

  return (
    <div className="difficulty-selector" role="group" aria-label="Select Difficulty">
      <span className="diff-label">Difficulty:</span>
      <div className="diff-buttons">
        {list.map((id) => {
          const cfg = DIFFICULTIES[id];
          const isSelected = currentDifficulty === id;
          return (
            <button
              key={id}
              type="button"
              className={`diff-btn ${id} ${isSelected ? 'active' : ''}`}
              onClick={() => onSelect(id)}
              aria-label={`Difficulty ${cfg.name}`}
            >
              {cfg.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
