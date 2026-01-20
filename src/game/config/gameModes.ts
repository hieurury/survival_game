/**
 * Game Modes Configuration
 * Data-driven configuration for different game difficulties
 * 
 * CONFIGURATION RULES:
 * - Game modes can ONLY affect: entity counts, entity types, map composition
 * - Game modes MUST NOT modify: stats, upgrade values, costs, scaling formulas
 * - All balance values are defined in balance.ts and must not be duplicated here
 */

import { GRID_CONSTANTS } from './constants'
import { 
  HERO_BALANCE, 
  MONSTER_BALANCE, 
  BED_BALANCE
} from './balance'

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
  // Stats are pulled from MONSTER_BALANCE - not defined here
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
  // Stats are pulled from HERO_BALANCE - not defined here
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
  /** Bed base income (from balance) */
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
  description: 'Chế độ nhập môn - 1 quái vật, 4 người chơi, 7 phòng',
  
  map: {
    gridCols: 50,
    gridRows: 34, // 40 playable + 4 bottom padding
    cellSize: GRID_CONSTANTS.CELL_SIZE,
    roomCount: 7,
    roomMinWidth: 6,
    roomMaxWidth: 8,
    roomMinHeight: 6,
    roomMaxHeight: 8,
    roomSizes: [
      { width: 8, height: 8 },
      { width: 8, height: 8 },
      { width: 8, height: 10 },
      { width: 10, height: 8 },
    ],
  },
  
  monster: {
    count: 1,
    variant: 'basic',
    // Stats from MONSTER_BALANCE - no modifications
    maxHp: MONSTER_BALANCE.MAX_HP,
    baseDamage: MONSTER_BALANCE.BASE_DAMAGE,
    speed: MONSTER_BALANCE.SPEED,
    attackRange: MONSTER_BALANCE.ATTACK_RANGE,
    attackCooldown: MONSTER_BALANCE.ATTACK_SPEED,
    healThreshold: MONSTER_BALANCE.HEAL_THRESHOLD,
    healRate: MONSTER_BALANCE.HEAL_RATE,
    retreatSpeedBonus: MONSTER_BALANCE.RETREAT_SPEED_BONUS,
    targetTimeout: 30,
    damageScale: MONSTER_BALANCE.DAMAGE_SCALE,
    hpScale: MONSTER_BALANCE.HP_SCALE,
    baseLevelTime: MONSTER_BALANCE.BASE_LEVEL_TIME,
    levelTimeIncrement: MONSTER_BALANCE.LEVEL_TIME_INCREMENT,
  },
  
  player: {
    totalCount: 4,
    humanCount: 1,
    botCount: 3,
    startingGold: 100,
    // Stats from HERO_BALANCE - no modifications
    hp: HERO_BALANCE.HP,
    speed: HERO_BALANCE.SPEED,
    damage: HERO_BALANCE.DAMAGE,
    attackRange: HERO_BALANCE.ATTACK_RANGE,
  },
  
  healingPoints: {
    count: 2,
    maxMana: 2000,
    manaRegenRate: 20,
    minManaPercent: 0.1, // 10% - minimum mana to START healing
  },
  
  // Spawn zone at center of map: (60-8)/2 = 26, (40-6)/2 = 17
  spawnZone: {
    gridX: 26,
    gridY: 17,
    width: 8,
    height: 6,
  },
  
  // Healing nests at opposite corners
  healingPointNests: [
    { gridX: 2, gridY: 2, width: 4, height: 4 },       // Top-left
    { gridX: 24, gridY: 30, width: 4, height: 4 },    // Bottom-right
  ],
  
  economy: {
    buildingCostMultiplier: 1.0,
    upgradeCostMultiplier: 1.0,
    bedBaseIncome: BED_BALANCE.BASE_INCOME,
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
  name: 'Bình thường',
  description: 'Chế độ cân bằng - 2 quái vật, 5 người chơi, 9 phòng',
  
  map: {
    gridCols: 60,
    gridRows: 40, // 36 playable + 4 bottom padding
    cellSize: GRID_CONSTANTS.CELL_SIZE,
    roomCount: 9,
    roomMinWidth: 7,
    roomMaxWidth: 10,
    roomMinHeight: 7,
    roomMaxHeight: 10,
    roomSizes: [
      { width: 7, height: 7 },
      { width: 8, height: 10 },
      { width: 10, height: 10 },
    ],
  },
  
  monster: {
    count: 2,
    variant: 'basic',
    maxHp: MONSTER_BALANCE.MAX_HP,
    baseDamage: MONSTER_BALANCE.BASE_DAMAGE,
    speed: MONSTER_BALANCE.SPEED,
    attackRange: MONSTER_BALANCE.ATTACK_RANGE,
    attackCooldown: MONSTER_BALANCE.ATTACK_SPEED,
    healThreshold: MONSTER_BALANCE.HEAL_THRESHOLD,
    healRate: MONSTER_BALANCE.HEAL_RATE,
    retreatSpeedBonus: MONSTER_BALANCE.RETREAT_SPEED_BONUS,
    targetTimeout: 30,
    damageScale: MONSTER_BALANCE.DAMAGE_SCALE,
    hpScale: MONSTER_BALANCE.HP_SCALE,
    baseLevelTime: MONSTER_BALANCE.BASE_LEVEL_TIME,
    levelTimeIncrement: MONSTER_BALANCE.LEVEL_TIME_INCREMENT,
  },
  
  player: {
    totalCount: 5,
    humanCount: 1,
    botCount: 4,
    startingGold: 70,
    hp: HERO_BALANCE.HP,
    speed: HERO_BALANCE.SPEED,
    damage: HERO_BALANCE.DAMAGE,
    attackRange: HERO_BALANCE.ATTACK_RANGE,
  },
  
  healingPoints: {
    count: 3,
    maxMana: 4000,
    manaRegenRate: 40,
    minManaPercent: 0.10,
  },
  
  spawnZone: {
    gridX: 26,
    gridY: 15,
    width: 8,
    height: 6,
  },
  
  healingPointNests: [
    { gridX: 0, gridY: 0, width: 4, height: 4 },
    { gridX: 56, gridY: 0, width: 4, height: 4 },
    { gridX: 28, gridY: 32, width: 4, height: 4 },
  ],
  
  economy: {
    buildingCostMultiplier: 1.0,
    upgradeCostMultiplier: 1.0,
    bedBaseIncome: BED_BALANCE.BASE_INCOME,
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
  description: 'Chế độ thử thách - 3 quái vật, 6 người chơi, 12 phòng',
  
  map: {
    gridCols: 70,
    gridRows: 46, // 42 playable + 4 bottom padding
    cellSize: GRID_CONSTANTS.CELL_SIZE,
    roomCount: 12,
    roomMinWidth: 6,
    roomMaxWidth: 10,
    roomMinHeight: 6,
    roomMaxHeight: 10,
    roomSizes: [
      { width: 6, height: 6 },
      { width: 8, height: 8 },
      { width: 10, height: 10 },
    ],
  },
  
  monster: {
    count: 3,
    variant: 'basic',
    maxHp: MONSTER_BALANCE.MAX_HP,
    baseDamage: MONSTER_BALANCE.BASE_DAMAGE,
    speed: MONSTER_BALANCE.SPEED,
    attackRange: MONSTER_BALANCE.ATTACK_RANGE,
    attackCooldown: MONSTER_BALANCE.ATTACK_SPEED,
    healThreshold: MONSTER_BALANCE.HEAL_THRESHOLD,
    healRate: MONSTER_BALANCE.HEAL_RATE,
    retreatSpeedBonus: MONSTER_BALANCE.RETREAT_SPEED_BONUS,
    targetTimeout: 30,
    damageScale: MONSTER_BALANCE.DAMAGE_SCALE,
    hpScale: MONSTER_BALANCE.HP_SCALE,
    baseLevelTime: MONSTER_BALANCE.BASE_LEVEL_TIME,
    levelTimeIncrement: MONSTER_BALANCE.LEVEL_TIME_INCREMENT,
  },
  
  player: {
    totalCount: 6,
    humanCount: 1,
    botCount: 5,
    startingGold: 50,
    hp: HERO_BALANCE.HP,
    speed: HERO_BALANCE.SPEED,
    damage: HERO_BALANCE.DAMAGE,
    attackRange: HERO_BALANCE.ATTACK_RANGE,
  },
  
  healingPoints: {
    count: 4,
    maxMana: 5000,
    manaRegenRate: 50,
    minManaPercent: 0.10,
  },
  
  spawnZone: {
    gridX: 31,
    gridY: 18,
    width: 8,
    height: 6,
  },
  
  healingPointNests: [
    { gridX: 0, gridY: 0, width: 4, height: 4 },
    { gridX: 66, gridY: 0, width: 4, height: 4 },
    { gridX: 0, gridY: 38, width: 4, height: 4 },
    { gridX: 66, gridY: 38, width: 4, height: 4 },
  ],
  
  economy: {
    buildingCostMultiplier: 1.2,
    upgradeCostMultiplier: 1.2,
    bedBaseIncome: BED_BALANCE.BASE_INCOME,
    bedUpgradeCostScale: 1.2,
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
