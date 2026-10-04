export interface Point {
  x: number;
  y: number;
}

export type DamageType = 'physical' | 'magic';

// ===== Status Effects =====
export type StatusType = 'burn' | 'poison' | 'freeze' | 'slow' | 'stun';

export interface StatusApplication {
  type: StatusType;
  duration: number; // วินาที
  magnitude?: number; // slow: สัดส่วนความเร็วที่ลด (0.2 = ลด 20%), burn/poison: dps
  chance?: number; // 0-1, default 1
}

export interface ActiveStatusEffect {
  type: StatusType;
  duration: number;
  remainingDuration: number;
  magnitude?: number;
  pendingDamage?: number;
  feedbackTimer?: number;
}

// ===== Enemy Ability =====
export interface HealAbility {
  kind: 'heal';
  amount: number;
  interval: number; // วินาที
  radius: number;
}

export type EnemyAbility = HealAbility;

// ===== Enemy =====
export type EnemyTypeId =
  | 'goblin'
  | 'wolf'
  | 'orc'
  | 'knight'
  | 'darkMage'
  | 'healer'
  | 'bat'
  | 'stoneLord';

export interface EnemyConfig {
  id: EnemyTypeId;
  name: string;
  hp: number;
  speed: number; // logical px / second
  armor: number; // เปอร์เซ็นต์ลด Physical Damage (0-100)
  magicResistance: number; // เปอร์เซ็นต์ลด Magic Damage (0-100)
  reward: number;
  baseDamage: number; // Life ที่เสียเมื่อถึง Castle
  meleeDamage: number; // Damage ต่อการโจมตี Soldier
  attackSpeed: number; // ครั้ง / วินาที (ตอนสู้กับ Soldier)
  type: 'ground' | 'flying' | 'boss';
  flying: boolean;
  radius: number;
  color: string;
  abilities: EnemyAbility[];
  immunities: StatusType[];
}

// ===== Boss System =====
export interface BossSummon {
  type: EnemyTypeId;
  count: number;
}

export interface BossAreaAttack {
  interval: number;
  telegraph: number;
  radius: number;
  damage: number;
  damageType: DamageType;
}

export interface BossPhase {
  name: string;
  hpThreshold: number; // 1.0 -> 0.6 -> 0.3
  speedMultiplier?: number;
  armorBonus?: number;
  summons?: BossSummon[];
  areaAttack?: BossAreaAttack;
  message: string;
}

export interface BossConfig {
  id: EnemyTypeId;
  name: string;
  phases: BossPhase[];
}

export interface BossSnapshot {
  name: string;
  hpPercent: number; // 0 - 100 integer
  phase: number; // 1-indexed
  phaseCount: number;
  phaseName: string;
}

export interface BannerNotice {
  id: number;
  text: string;
  kind: 'warning' | 'phase';
}

// ===== Difficulty =====
export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  hpMultiplier: number;
  damageMultiplier: number;
  goldMultiplier: number;
  initialGold: number;
}

// ===== Score & RunStats =====
export interface StarRules {
  threeStarMinLife: number;
  threeStarMaxEscaped: number;
  twoStarMinLife: number;
}

export interface RunStats {
  kills: number;
  bossKills: number;
  upgrades: number;
  towersBuilt: number;
  perfectWaves: number;
}

export interface VictoryResult {
  score: number;
  stars: number;
  life: number;
  escaped: number;
  kills: number;
  difficulty: DifficultyId;
}

// ===== Tower =====
export type TowerTypeId = 'archer' | 'barracks' | 'mage' | 'artillery';
export type TargetMode = 'first' | 'last' | 'strongest' | 'weakest' | 'closest';
export type ProjectileKind = 'arrow' | 'magicBolt' | 'cannonShell';

export interface SoldierConfig {
  hp: number;
  damage: number;
  armor: number;
  attackSpeed: number;
  speed: number;
  regen: number; // HP ต่อวินาที ตอนไม่ได้สู้
  radius: number;
}

export interface RangedStats {
  damage: number;
  damageType: DamageType;
  range: number;
  attackSpeed: number; // ครั้ง / วินาที
  critChance: number; // 0-1
  critMultiplier: number;
  projectileKind: ProjectileKind;
  projectileSpeed: number;
  splashRadius: number; // 0 = ไม่มี Area Damage
  magicPenetration: number; // เปอร์เซ็นต์ที่ทะลุ Magic Resistance
  targetsFlying: boolean;
  effects?: StatusApplication[];
}

export interface BarracksStats {
  soldierCount: number;
  rallyRadius: number;
  respawnDelay: number; // วินาที
  soldier: SoldierConfig;
}

export interface TowerLevelStats {
  upgradeCost: number; // Level 1 = 0
  ranged?: RangedStats;
  barracks?: BarracksStats;
}

export interface TowerConfig {
  id: TowerTypeId;
  name: string;
  symbol: string;
  cost: number;
  color: string;
  accent: string;
  levels: TowerLevelStats[];
}

export interface TowerSpot {
  id: number;
  x: number;
  y: number;
}

// ===== Wave =====
export interface WaveEnemyGroup {
  type: EnemyTypeId;
  count: number;
  interval?: number;
}

export interface WaveConfig {
  id: number;
  enemies: WaveEnemyGroup[];
  spawnInterval: number;
  reward: number;
}

export type WavePhase = 'READY' | 'ACTIVE';

// ===== Map =====
export interface MapData {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Normal' | 'Hard';
  width: number;
  height: number;
  path: Point[];
  spawnPoint: Point;
  basePoint: Point;
  towerSpots: TowerSpot[];
  totalWaves: number;
  starRules: StarRules;
}

// ===== UI bridge =====
export interface TowerStat {
  label: string;
  value: string;
  nextValue?: string;
}

export interface TowerInfo {
  id: number;
  typeId: TowerTypeId;
  name: string;
  symbol: string;
  level: number;
  maxLevel: number;
  upgradeCost: number;
  sellRefund: number;
  targetMode: TargetMode;
  hasTargeting: boolean;
  stats: TowerStat[];
}

export type Selection =
  | { kind: 'spot'; spotId: number; x: number; y: number }
  | { kind: 'tower'; towerId: number; x: number; y: number };

export interface Notice {
  id: number;
  text: string;
}

export type GameStatus = 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';
export type GameSpeed = 1 | 2 | 3;

export interface GameSnapshot {
  life: number;
  gold: number;
  wave: number;
  totalWaves: number;
  enemyCount: number;
  escaped: number;
  status: GameStatus;
  selection: Selection | null;
  selectedTower: TowerInfo | null;
  notice: Notice | null;
  wavePhase: WavePhase;
  waveRemaining: number;
  waveTotal: number;
  score: number;
  speed: GameSpeed;
  difficulty: DifficultyId;
  canChangeDifficulty: boolean;
  boss: BossSnapshot | null;
  banner: BannerNotice | null;
  result: VictoryResult | null;
}
