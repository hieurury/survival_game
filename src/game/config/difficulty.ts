/**
 * Difficulty Configuration System
 * Defines Easy, Normal, and Hard difficulty presets with all game parameters
 */

// =============================================================================
// DIFFICULTY TYPES
// =============================================================================
export type DifficultyLevel = 'easy' | 'normal' | 'hard'

export interface MapConfig {
  gridCols: number
  gridRows: number
  cellSize: number
  roomCount: number
  roomMinWidth: number
  roomMaxWidth: number
  roomMinHeight: number
  roomMaxHeight: number
}

export interface HealingPointConfig {
  count: number
  maxMana: number
  manaRegenRate: number
  minManaPercent: number
}

export interface MonsterConfig {
  count: number
  maxHp: number
  baseDamage: number
  speed: number
  attackRange: number
  attackCooldown: number
  healThreshold: number
  healRate: number
  damageScale: number
  hpScale: number
  retreatSpeedBonus: number
  baseLevelTime: number
  levelTimeIncrement: number
  targetTimeout: number
  aggressiveness: number // 0-1, affects target selection and persistence
}

export interface PlayerConfig {
  totalCount: number
  humanCount: number
  botCount: number
  hp: number
  speed: number
  damage: number
  attackRange: number
  startingGold: number
}

export interface EconomyConfig {
  bedBaseIncome: number
  bedUpgradeCostScale: number
  buildingCostMultiplier: number
  upgradeCostMultiplier: number
}

export interface GameTimingConfig {
  countdownTime: number
  doorRepairCooldown: number
  doorRepairDuration: number
  vanguardRespawnTime: number
}

export interface DifficultyConfig {
  id: DifficultyLevel
  name: string
  description: string
  map: MapConfig
  healingPoints: HealingPointConfig
  monster: MonsterConfig
  player: PlayerConfig
  economy: EconomyConfig
  timing: GameTimingConfig
}

// =============================================================================
// DIFFICULTY PRESETS
// =============================================================================

export const DIFFICULTY_EASY: DifficultyConfig = {
  id: 'easy',
  name: 'Dễ',
  description: 'Phù hợp cho người mới bắt đầu. Nhiều tài nguyên, ít áp lực.',
  map: {
    gridCols: 50,
    gridRows: 30,
    cellSize: 48,
    roomCount: 10,
    roomMinWidth: 8,
    roomMaxWidth: 10,
    roomMinHeight: 8,
    roomMaxHeight: 10,
  },
  healingPoints: {
    count: 2,
    maxMana: 2000, // Lower mana = monster heals less
    manaRegenRate: 30,
    minManaPercent: 0.10,
  },
  monster: {
    count: 1,
    maxHp: 600,
    baseDamage: 8,
    speed: 100,
    attackRange: 55,
    attackCooldown: 1.2,
    healThreshold: 0.25,
    healRate: 0.15,
    damageScale: 1.3,
    hpScale: 1.2,
    retreatSpeedBonus: 1.3,
    baseLevelTime: 45, // Slower leveling
    levelTimeIncrement: 15,
    targetTimeout: 25,
    aggressiveness: 0.5,
  },
  player: {
    totalCount: 4,
    humanCount: 1,
    botCount: 3,
    hp: 120,
    speed: 180,
    damage: 18,
    attackRange: 50,
    startingGold: 100,
  },
  economy: {
    bedBaseIncome: 2,
    bedUpgradeCostScale: 1.8,
    buildingCostMultiplier: 0.8,
    upgradeCostMultiplier: 0.8,
  },
  timing: {
    countdownTime: 45,
    doorRepairCooldown: 20,
    doorRepairDuration: 4,
    vanguardRespawnTime: 20,
  },
}

export const DIFFICULTY_NORMAL: DifficultyConfig = {
  id: 'normal',
  name: 'Thường',
  description: 'Cân bằng giữa thử thách và vui chơi. Đây là trải nghiệm chuẩn.',
  map: {
    gridCols: 50,
    gridRows: 30,
    cellSize: 48,
    roomCount: 7,
    roomMinWidth: 8,
    roomMaxWidth: 10,
    roomMinHeight: 8,
    roomMaxHeight: 10,
  },
  healingPoints: {
    count: 2,
    maxMana: 5000,
    manaRegenRate: 50,
    minManaPercent: 0.10,
  },
  monster: {
    count: 1,
    maxHp: 800,
    baseDamage: 10,
    speed: 120,
    attackRange: 55,
    attackCooldown: 1.0,
    healThreshold: 0.2,
    healRate: 0.2,
    damageScale: 1.4,
    hpScale: 1.3,
    retreatSpeedBonus: 1.5,
    baseLevelTime: 30,
    levelTimeIncrement: 10,
    targetTimeout: 30,
    aggressiveness: 0.7,
  },
  player: {
    totalCount: 5,
    humanCount: 1,
    botCount: 4,
    hp: 100,
    speed: 180,
    damage: 15,
    attackRange: 50,
    startingGold: 20,
  },
  economy: {
    bedBaseIncome: 1,
    bedUpgradeCostScale: 2.0,
    buildingCostMultiplier: 1.0,
    upgradeCostMultiplier: 1.0,
  },
  timing: {
    countdownTime: 30,
    doorRepairCooldown: 30,
    doorRepairDuration: 5,
    vanguardRespawnTime: 30,
  },
}

export const DIFFICULTY_HARD: DifficultyConfig = {
  id: 'hard',
  name: 'Khó',
  description: 'Dành cho người chơi có kinh nghiệm. Tài nguyên khan hiếm, nhiều quái vật.',
  map: {
    gridCols: 60, // Larger map
    gridRows: 40,
    cellSize: 48,
    roomCount: 5, // Fewer rooms
    roomMinWidth: 5,
    roomMaxWidth: 7,
    roomMinHeight: 5,
    roomMaxHeight: 7,
  },
  healingPoints: {
    count: 6, // More healing points = monster heals more often
    maxMana: 8000,
    manaRegenRate: 80,
    minManaPercent: 0.10,
  },
  monster: {
    count: 2, // Two monsters!
    maxHp: 1000,
    baseDamage: 12,
    speed: 140,
    attackRange: 60,
    attackCooldown: 0.8,
    healThreshold: 0.3, // Retreats earlier
    healRate: 0.25,
    damageScale: 1.5,
    hpScale: 1.4,
    retreatSpeedBonus: 1.7,
    baseLevelTime: 20, // Faster leveling
    levelTimeIncrement: 8,
    targetTimeout: 40, // More persistent
    aggressiveness: 0.9,
  },
  player: {
    totalCount: 7,
    humanCount: 1,
    botCount: 6,
    hp: 80,
    speed: 180,
    damage: 12,
    attackRange: 50,
    startingGold: 20,
  },
  economy: {
    bedBaseIncome: 1,
    bedUpgradeCostScale: 2.5,
    buildingCostMultiplier: 1.3,
    upgradeCostMultiplier: 1.3,
  },
  timing: {
    countdownTime: 20,
    doorRepairCooldown: 45,
    doorRepairDuration: 6,
    vanguardRespawnTime: 45,
  },
}

// =============================================================================
// DIFFICULTY MAP & HELPERS
// =============================================================================
export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: DIFFICULTY_EASY,
  normal: DIFFICULTY_NORMAL,
  hard: DIFFICULTY_HARD,
}

export const DIFFICULTY_LIST: DifficultyConfig[] = [
  DIFFICULTY_EASY,
  DIFFICULTY_NORMAL,
  DIFFICULTY_HARD,
]

/**
 * Get difficulty config by level
 */
export function getDifficultyConfig(level: DifficultyLevel): DifficultyConfig {
  return DIFFICULTY_CONFIGS[level]
}

/**
 * Generate healing point nest positions based on difficulty
 */
export function generateHealingPointNests(config: DifficultyConfig): Array<{
  gridX: number
  gridY: number
  width: number
  height: number
}> {
  const { gridCols, gridRows } = config.map
  const nestSize = 4
  const nests: Array<{ gridX: number; gridY: number; width: number; height: number }> = []
  
  // Define all possible corner/edge positions
  const positions = [
    { gridX: 0, gridY: 0 }, // Top-left
    { gridX: gridCols - nestSize, gridY: 0 }, // Top-right
    { gridX: 0, gridY: gridRows - nestSize }, // Bottom-left
    { gridX: gridCols - nestSize, gridY: gridRows - nestSize }, // Bottom-right
    { gridX: Math.floor(gridCols / 2) - 2, gridY: 0 }, // Top-center
    { gridX: Math.floor(gridCols / 2) - 2, gridY: gridRows - nestSize }, // Bottom-center
  ]
  
  // Select positions based on count
  for (let i = 0; i < Math.min(config.healingPoints.count, positions.length); i++) {
    const pos = positions[i]!
    nests.push({
      gridX: pos.gridX,
      gridY: pos.gridY,
      width: nestSize,
      height: nestSize,
    })
  }
  
  return nests
}

/**
 * Get spawn zone configuration based on map size
 */
export function getSpawnZone(config: DifficultyConfig): {
  gridX: number
  gridY: number
  width: number
  height: number
} {
  const { gridCols, gridRows } = config.map
  const width = 8
  const height = 6
  
  return {
    gridX: Math.floor((gridCols - width) / 2),
    gridY: Math.floor((gridRows - height) / 2),
    width,
    height,
  }
}

// Export default difficulty
export const DEFAULT_DIFFICULTY: DifficultyLevel = 'normal'
