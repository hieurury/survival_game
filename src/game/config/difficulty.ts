/**
 * Difficulty Configuration API
 * Provides the public API for accessing game difficulty settings
 * This file bridges the game mode configurations with the rest of the application
 */

import type { 
  GameModeConfig, 
  GameModeId,
  MapConfig,
  MonsterModeConfig,
  PlayerModeConfig,
  HealingPointModeConfig,
  SpawnZoneConfig,
  HealingPointNestConfig,
  EconomyModeConfig,
  TimingConfig
} from './gameModes'
import { 
  GAME_MODES, 
  GAME_MODE_LIST, 
  getGameModeConfig,
  EASY_MODE 
} from './gameModes'

// =============================================================================
// TYPE ALIASES FOR BACKWARD COMPATIBILITY
// =============================================================================

/** Difficulty level type - alias for GameModeId */
export type DifficultyLevel = GameModeId

/** Difficulty configuration - alias for GameModeConfig */
export type DifficultyConfig = GameModeConfig

// Re-export sub-config types
export type {
  MapConfig,
  MonsterModeConfig,
  PlayerModeConfig,
  HealingPointModeConfig,
  SpawnZoneConfig,
  HealingPointNestConfig,
  EconomyModeConfig,
  TimingConfig
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/** Default difficulty level */
export const DEFAULT_DIFFICULTY: DifficultyLevel = 'easy'

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get difficulty configuration by level
 */
export function getDifficultyConfig(level: DifficultyLevel): DifficultyConfig {
  return getGameModeConfig(level)
}

/**
 * Get all available difficulty levels
 */
export const DIFFICULTY_LIST: DifficultyLevel[] = GAME_MODE_LIST

/**
 * Get difficulty display info for UI
 */
export interface DifficultyDisplayInfo {
  id: DifficultyLevel
  name: string
  description: string
  monsterCount: number
  playerCount: number
  roomCount: number
}

/**
 * Get display information for all difficulties
 */
export function getDifficultyDisplayList(): DifficultyDisplayInfo[] {
  return DIFFICULTY_LIST.map(id => {
    const config = getDifficultyConfig(id)
    return {
      id,
      name: config.name,
      description: config.description,
      monsterCount: config.monster.count,
      playerCount: config.player.totalCount,
      roomCount: config.map.roomCount,
    }
  })
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate healing point nest positions based on difficulty config
 */
export function generateHealingPointNests(config: DifficultyConfig): HealingPointNestConfig[] {
  return config.healingPointNests
}

/**
 * Get spawn zone configuration
 */
export function getSpawnZone(config: DifficultyConfig): SpawnZoneConfig {
  return config.spawnZone
}

/**
 * Get effective room count (ensures room count > player count)
 */
export function getEffectiveRoomCount(config: DifficultyConfig): number {
  const minRequired = config.player.totalCount + 1
  return Math.max(config.map.roomCount, minRequired)
}

/**
 * Calculate world dimensions from map config
 */
export function getWorldDimensions(config: DifficultyConfig): { width: number; height: number } {
  return {
    width: config.map.gridCols * config.map.cellSize,
    height: config.map.gridRows * config.map.cellSize,
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a difficulty configuration
 * Returns array of error messages (empty if valid)
 */
export function validateDifficultyConfig(config: DifficultyConfig): string[] {
  const errors: string[] = []
  
  // Validate room count
  if (config.map.roomCount < config.player.totalCount) {
    errors.push(`Room count (${config.map.roomCount}) must be >= player count (${config.player.totalCount})`)
  }
  
  // Validate healing points match nests
  if (config.healingPoints.count !== config.healingPointNests.length) {
    errors.push(`Healing point count (${config.healingPoints.count}) must match nest positions (${config.healingPointNests.length})`)
  }
  
  // Validate player counts
  if (config.player.humanCount + config.player.botCount !== config.player.totalCount) {
    errors.push(`Human (${config.player.humanCount}) + Bot (${config.player.botCount}) must equal total (${config.player.totalCount})`)
  }
  
  // Validate spawn zone is within map bounds
  const sz = config.spawnZone
  if (sz.gridX + sz.width > config.map.gridCols || sz.gridY + sz.height > config.map.gridRows) {
    errors.push('Spawn zone extends beyond map boundaries')
  }
  
  // Validate healing point nests are within map bounds
  for (const nest of config.healingPointNests) {
    if (nest.gridX + nest.width > config.map.gridCols || nest.gridY + nest.height > config.map.gridRows) {
      errors.push(`Healing point nest at (${nest.gridX}, ${nest.gridY}) extends beyond map boundaries`)
    }
  }
  
  return errors
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export game modes for direct access if needed
export { GAME_MODES, EASY_MODE }
