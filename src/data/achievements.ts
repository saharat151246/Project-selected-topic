/**
 * data/achievements.ts — Definitions of achievements in the game.
 */

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_win',
    title: 'First Victory',
    description: 'Complete all 10 waves on any map',
    icon: '🏆',
  },
  {
    id: 'flawless',
    title: 'Flawless Defender',
    description: 'Win a map without losing any castle life (20/20)',
    icon: '🛡️',
  },
  {
    id: 'boss_slayer',
    title: 'Stone Lord Slayer',
    description: 'Defeat the Stone Lord boss on Wave 10',
    icon: '⚔️',
  },
  {
    id: 'tower_architect',
    title: 'Tower Architect',
    description: 'Fill all 8 tower spots on the battlefield',
    icon: '🏰',
  },
  {
    id: 'high_scorer',
    title: 'High Scorer',
    description: 'Reach a total score of 6,000 or higher',
    icon: '⭐',
  },
];
