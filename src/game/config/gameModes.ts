/**
 * Game Modes Configuration
 * Data-driven configuration for different game difficulties
 * 
 * CONFIGURATION RULES:
 * - Game modes can ONLY affect: entity counts, entity types, map composition
 * - Game modes MUST NOT modify: stats, upgrade values, costs, scaling formulas
 * - All stats are pulled from entities (entityConfigs.ts)
 */

import { GRID_CONSTANTS } from './constants'
import { 
  DEFAULT_MONSTER_CONFIG,
  DEFAULT_PLAYER_CONFIG,
  DEFAULT_BED_CONFIG,
} from './entityConfigs'

// =============================================================================
// GAME MODE TYPES
// =============================================================================

export type GameModeId = 'easy' | 'normal' | 'hard'

export interface RoomSizeConfig {
  width: number
  height: number
}

export interface MapConfig {
  /** Number of grid columns */
  gridCols: number
  /** Number of grid rows */
  gridRows: number
  /** Cell size in pixels */
  cellSize: number
  /** Total number of shelter rooms */
  roomCount: number
  /** Minimum room width */
  roomMinWidth: number
  /** Maximum room width */
  roomMaxWidth: number
  /** Minimum room height */
  roomMinHeight: number
  /** Maximum room height */
  roomMaxHeight: number
  /** Available room sizes for this mode */
  roomSizes: RoomSizeConfig[]
}

export interface MonsterModeConfig {
  /** Number of monsters to spawn */
  count: number
  /** Monster variant (basic, elite, etc.) */
  variant: 'basic' | 'elite' | 'boss'
  // Stats are pulled from entities (DEFAULT_MONSTER_CONFIG)
  maxHp: number
  baseDamage: number
  speed: number
  attackRange: number
  /** Attack cooldown in seconds */
  attackCooldown: number
  /** HP threshold to trigger retreat (0-1) */
  healThreshold: number
  /** HP percent per second when healing */
  healRate: number
  /** Speed multiplier when retreating */
  retreatSpeedBonus: number
  /** Max seconds to attack same target */
  targetTimeout: number
  /** Damage multiplier per level */
  damageScale: number
  /** HP multiplier per level */
  hpScale: number
  /** Base seconds for first level up */
  baseLevelTime: number
  /** Additional seconds per level */
  levelTimeIncrement: number
}

export interface PlayerModeConfig {
  /** Total number of players */
  totalCount: number
  /** Number of human players */
  humanCount: number
  /** Number of bot players */
  botCount: number
  /** Starting gold for all players */
  startingGold: number
  // Stats are pulled from entities (DEFAULT_PLAYER_CONFIG)
  hp: number
  speed: number
  damage: number
  attackRange: number
}

export interface HealingPointModeConfig {
  /** Number of healing points (monster nests) */
  count: number
  /** Mana capacity per healing point */
  maxMana: number
  /** Mana regeneration rate per second */
  manaRegenRate: number
  /** Minimum mana percent to allow healing */
  minManaPercent: number
}

export interface SpawnZoneConfig {
  gridX: number
  gridY: number
  width: number
  height: number
}

export interface HealingPointNestConfig {
  gridX: number
  gridY: number
  width: number
  height: number
}

export interface EconomyModeConfig {
  /** Multiplier for building costs */
  buildingCostMultiplier: number
  /** Multiplier for upgrade costs */
  upgradeCostMultiplier: number
  /** Bed base income (from gameModeConfig) */
  bedBaseIncome: number
  /** Bed upgrade cost scale */
  bedUpgradeCostScale: number
}

export interface TimingConfig {
  /** Countdown time before monster activates */
  countdownTime: number
  /** Vanguard respawn time in seconds */
  vanguardRespawnTime: number
}

export interface GameModeConfig {
  /** Unique identifier for this mode */
  id: GameModeId
  /** Display name */
  name: string
  /** Description for UI */
  description: string
  /** Map configuration */
  map: MapConfig
  /** Monster configuration */
  monster: MonsterModeConfig
  /** Player configuration */
  player: PlayerModeConfig
  /** Healing point configuration */
  healingPoints: HealingPointModeConfig
  /** Spawn zone configuration */
  spawnZone: SpawnZoneConfig
  /** Healing point nest positions */
  healingPointNests: HealingPointNestConfig[]
  /** Economy multipliers */
  economy: EconomyModeConfig
  /** Timing settings */
  timing: TimingConfig
}

// =============================================================================
// EASY MODE CONFIGURATION
// =============================================================================

export const EASY_MODE: GameModeConfig = {
  id: 'easy',
  name: 'Dễ',
  description: 'Chế độ nhập môn - 1 quái vật, 4 người chơi, 5 phòng',
  
  map: {
    gridCols: 50,
    gridRows: 40, // Map for 5 rooms with margin
    cellSize: GRID_CONSTANTS.CELL_SIZE,
    roomCount: 5,
    roomMinWidth: 7,
    roomMaxWidth: 10,
    roomMinHeight: 7,
    roomMaxHeight: 10,
    roomSizes: [
      { width: 7, height: 7 },   // Small
      { width: 8, height: 8 },   // Medium
      { width: 10, height: 8 },  // Wide
      { width: 8, height: 10 },  // Tall
      { width: 10, height: 10 }, // Large
    ],
  },
  
  monster: {
    count: 1,
    variant: 'basic',
    // Stats from entities (DEFAULT_MONSTER_CONFIG)
    maxHp: DEFAULT_MONSTER_CONFIG.maxHp,
    baseDamage: DEFAULT_MONSTER_CONFIG.baseDamage,
    speed: DEFAULT_MONSTER_CONFIG.speed,
    attackRange: DEFAULT_MONSTER_CONFIG.attackRange,
    attackCooldown: DEFAULT_MONSTER_CONFIG.attackCooldown,
    healThreshold: DEFAULT_MONSTER_CONFIG.healThreshold,
    healRate: DEFAULT_MONSTER_CONFIG.healRate,
    retreatSpeedBonus: DEFAULT_MONSTER_CONFIG.retreatSpeedBonus,
    targetTimeout: DEFAULT_MONSTER_CONFIG.targetTimeout,
    damageScale: DEFAULT_MONSTER_CONFIG.damageScale,
    hpScale: DEFAULT_MONSTER_CONFIG.hpScale,
    baseLevelTime: DEFAULT_MONSTER_CONFIG.baseLevelTime,
    levelTimeIncrement: DEFAULT_MONSTER_CONFIG.levelTimeIncrement,
  },
  
  player: {
    totalCount: 4,
    humanCount: 1,
    botCount: 3,
    startingGold: 100,
    // Stats from entities (DEFAULT_PLAYER_CONFIG)
    hp: DEFAULT_PLAYER_CONFIG.maxHp,
    speed: DEFAULT_PLAYER_CONFIG.speed,
    damage: DEFAULT_PLAYER_CONFIG.damage,
    attackRange: DEFAULT_PLAYER_CONFIG.attackRange,
  },
  
  healingPoints: {
    count: 2, // 2 corners only
    maxMana: 2000,
    manaRegenRate: 30,
    minManaPercent: 0.10, // 10% - minimum mana to START healing
  },
  
  // Spawn zone at center of map
  spawnZone: {
    gridX: 21,
    gridY: 17,
    width: 8,
    height: 6,
  },
  
  // Healing nests at 2 opposite corners (will be randomized at runtime)
  healingPointNests: [
    { gridX: 3, gridY: 3, width: 4, height: 4 },       // Top-left
    { gridX: 43, gridY: 33, width: 4, height: 4 },     // Bottom-right
  ],
  
  economy: {
    buildingCostMultiplier: 1.0,
    upgradeCostMultiplier: 1.0,
    bedBaseIncome: DEFAULT_BED_CONFIG.baseIncome,
    bedUpgradeCostScale: 1.0,
  },
  
  timing: {
    countdownTime: 30,
    vanguardRespawnTime: 30,
  },
}

// =============================================================================
// NORMAL MODE CONFIGURATION (for future use)
// =============================================================================

export const NORMAL_MODE: GameModeConfig = {
  id: 'normal',
  name: 'Trung bình',
  description: 'Chế độ cân bằng - 1 quái vật, 5 người chơi, 7 phòng',
  
  map: {
    gridCols: 65,
    gridRows: 50, // Map for 7 rooms with margin - increased for better room placement
    cellSize: GRID_CONSTANTS.CELL_SIZE,
    roomCount: 7,
    roomMinWidth: 7,
    roomMaxWidth: 10,
    roomMinHeight: 7,
    roomMaxHeight: 10,
    roomSizes: [
      { width: 7, height: 7 },   // Small
      { width: 8, height: 8 },   // Medium
      { width: 10, height: 8 },  // Wide
      { width: 8, height: 10 },  // Tall
      { width: 10, height: 10 }, // Large
    ],
  },
  
  monster: {
    count: 1,
    variant: 'basic',
    maxHp: DEFAULT_MONSTER_CONFIG.maxHp,
    baseDamage: DEFAULT_MONSTER_CONFIG.baseDamage,
    speed: DEFAULT_MONSTER_CONFIG.speed,
    attackRange: DEFAULT_MONSTER_CONFIG.attackRange,
    attackCooldown: DEFAULT_MONSTER_CONFIG.attackCooldown,
    healThreshold: DEFAULT_MONSTER_CONFIG.healThreshold,
    healRate: DEFAULT_MONSTER_CONFIG.healRate,
    retreatSpeedBonus: DEFAULT_MONSTER_CONFIG.retreatSpeedBonus,
    targetTimeout: DEFAULT_MONSTER_CONFIG.targetTimeout,
    damageScale: DEFAULT_MONSTER_CONFIG.damageScale,
    hpScale: DEFAULT_MONSTER_CONFIG.hpScale,
    baseLevelTime: DEFAULT_MONSTER_CONFIG.baseLevelTime,
    levelTimeIncrement: DEFAULT_MONSTER_CONFIG.levelTimeIncrement,
  },
  
  player: {
    totalCount: 5,
    humanCount: 1,
    botCount: 4,
    startingGold: 50,
    hp: DEFAULT_PLAYER_CONFIG.maxHp,
    speed: DEFAULT_PLAYER_CONFIG.speed,
    damage: DEFAULT_PLAYER_CONFIG.damage,
    attackRange: DEFAULT_PLAYER_CONFIG.attackRange,
  },
  
  healingPoints: {
    count: 4, // 4 corners
    maxMana: 2500,
    manaRegenRate: 50,
    minManaPercent: 0.10, // 10% - minimum mana to START healing
  },
  
  spawnZone: {
    gridX: 28,
    gridY: 22,
    width: 8,
    height: 6,
  },
  
  // Healing nests at 4 corners (will be randomized at runtime)
  healingPointNests: [
    { gridX: 3, gridY: 3, width: 4, height: 4 },       // Top-left
    { gridX: 58, gridY: 3, width: 4, height: 4 },      // Top-right
    { gridX: 3, gridY: 43, width: 4, height: 4 },      // Bottom-left
    { gridX: 58, gridY: 43, width: 4, height: 4 },     // Bottom-right
  ],
  
  economy: {
    buildingCostMultiplier: 1.0,
    upgradeCostMultiplier: 1.0,
    bedBaseIncome: DEFAULT_BED_CONFIG.baseIncome,
    bedUpgradeCostScale: 1.0,
  },
  
  timing: {
    countdownTime: 25,
    vanguardRespawnTime: 30,
  },
}

// =============================================================================
// HARD MODE CONFIGURATION (for future use)
// =============================================================================

export const HARD_MODE: GameModeConfig = {
  id: 'hard',
  name: 'Khó',
  description: 'Chế độ thử thách - 2 quái vật, 5 người chơi, 10 phòng',
  
  map: {
    gridCols: 70,
    gridRows: 50, // Map for 10 rooms with margin
    cellSize: GRID_CONSTANTS.CELL_SIZE,
    roomCount: 10,
    roomMinWidth: 7,
    roomMaxWidth: 10,
    roomMinHeight: 7,
    roomMaxHeight: 10,
    roomSizes: [
      { width: 7, height: 7 },   // Small
      { width: 8, height: 8 },   // Medium
      { width: 10, height: 8 },  // Wide
      { width: 8, height: 10 },  // Tall
      { width: 10, height: 10 }, // Large
    ],
  },
  
  monster: {
    count: 2,
    variant: 'basic',
    maxHp: DEFAULT_MONSTER_CONFIG.maxHp,
    baseDamage: DEFAULT_MONSTER_CONFIG.baseDamage,
    speed: DEFAULT_MONSTER_CONFIG.speed,
    attackRange: DEFAULT_MONSTER_CONFIG.attackRange,
    attackCooldown: DEFAULT_MONSTER_CONFIG.attackCooldown,
    healThreshold: DEFAULT_MONSTER_CONFIG.healThreshold,
    healRate: DEFAULT_MONSTER_CONFIG.healRate,
    retreatSpeedBonus: DEFAULT_MONSTER_CONFIG.retreatSpeedBonus,
    targetTimeout: DEFAULT_MONSTER_CONFIG.targetTimeout,
    damageScale: DEFAULT_MONSTER_CONFIG.damageScale,
    hpScale: DEFAULT_MONSTER_CONFIG.hpScale,
    baseLevelTime: DEFAULT_MONSTER_CONFIG.baseLevelTime,
    levelTimeIncrement: DEFAULT_MONSTER_CONFIG.levelTimeIncrement,
  },
  
  player: {
    totalCount: 5,
    humanCount: 1,
    botCount: 4,
    startingGold: 20,
    hp: DEFAULT_PLAYER_CONFIG.maxHp,
    speed: DEFAULT_PLAYER_CONFIG.speed,
    damage: DEFAULT_PLAYER_CONFIG.damage,
    attackRange: DEFAULT_PLAYER_CONFIG.attackRange,
  },
  
  healingPoints: {
    count: 4, // 4 corners
    maxMana: 4000,
    manaRegenRate: 100,
    minManaPercent: 0.10, // 10% - minimum mana to START healing
  },
  
  spawnZone: {
    gridX: 31,
    gridY: 22,
    width: 8,
    height: 6,
  },
  
  // Healing nests at 4 corners (will be randomized at runtime)
  healingPointNests: [
    { gridX: 3, gridY: 3, width: 4, height: 4 },       // Top-left
    { gridX: 63, gridY: 3, width: 4, height: 4 },      // Top-right
    { gridX: 3, gridY: 43, width: 4, height: 4 },      // Bottom-left
    { gridX: 63, gridY: 43, width: 4, height: 4 },     // Bottom-right
  ],
  
  economy: {
    buildingCostMultiplier: 1.0,
    upgradeCostMultiplier: 1.0,
    bedBaseIncome: DEFAULT_BED_CONFIG.baseIncome,
    bedUpgradeCostScale: 1.0,
  },
  
  timing: {
    countdownTime: 20,
    vanguardRespawnTime: 30,
  },
}

// =============================================================================
// GAME MODES REGISTRY
// =============================================================================

export const GAME_MODES: Record<GameModeId, GameModeConfig> = {
  easy: EASY_MODE,
  normal: NORMAL_MODE,
  hard: HARD_MODE,
}

/**
 * Get game mode configuration by ID
 */
export function getGameModeConfig(modeId: GameModeId): GameModeConfig {
  const config = GAME_MODES[modeId]
  if (!config) {
    console.warn(`Unknown game mode: ${modeId}, falling back to easy`)
    return EASY_MODE
  }
  return config
}

/**
 * List of all available game modes
 */
export const GAME_MODE_LIST: GameModeId[] = ['easy', 'normal', 'hard']
