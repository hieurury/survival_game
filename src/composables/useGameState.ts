/**
 * Game State Composable
 * Manages global game state including difficulty selection
 */

import { ref, computed, readonly } from 'vue'
import type { DifficultyLevel, DifficultyConfig } from '../game/config/difficulty.ts'
import { 
  getDifficultyConfig, 
  DEFAULT_DIFFICULTY, 
  DIFFICULTY_LIST,
  generateHealingPointNests,
  getSpawnZone,
  getEffectiveRoomCount
} from '../game/config/difficulty.ts'

// =============================================================================
// STATE
// =============================================================================

const selectedDifficulty = ref<DifficultyLevel>(DEFAULT_DIFFICULTY)
const currentConfig = ref<DifficultyConfig>(getDifficultyConfig(DEFAULT_DIFFICULTY))

// =============================================================================
// AVAILABLE DIFFICULTIES (full config objects for UI)
// =============================================================================
const availableDifficultyConfigs = DIFFICULTY_LIST.map(id => getDifficultyConfig(id))

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Set the game difficulty
 */
function setDifficulty(level: DifficultyLevel): void {
  selectedDifficulty.value = level
  currentConfig.value = getDifficultyConfig(level)
}

/**
 * Reset to default difficulty
 */
function resetDifficulty(): void {
  setDifficulty(DEFAULT_DIFFICULTY)
}

// =============================================================================
// COMPUTED HELPERS
// =============================================================================

const difficultyName = computed(() => currentConfig.value.name)
const difficultyDescription = computed(() => currentConfig.value.description)

const mapConfig = computed(() => {
  const config = currentConfig.value.map
  // Ensure room count is always > player count
  const effectiveRoomCount = getEffectiveRoomCount(currentConfig.value)
  return {
    ...config,
    roomCount: effectiveRoomCount
  }
})
const monsterConfig = computed(() => currentConfig.value.monster)
const playerConfig = computed(() => currentConfig.value.player)
const economyConfig = computed(() => currentConfig.value.economy)
const healingPointConfig = computed(() => currentConfig.value.healingPoints)
const timingConfig = computed(() => currentConfig.value.timing)

const worldWidth = computed(() => currentConfig.value.map.gridCols * currentConfig.value.map.cellSize)
const worldHeight = computed(() => currentConfig.value.map.gridRows * currentConfig.value.map.cellSize)

const healingPointNests = computed(() => generateHealingPointNests(currentConfig.value))
const spawnZone = computed(() => getSpawnZone(currentConfig.value))

// =============================================================================
// COMPOSABLE EXPORT
// =============================================================================

export function useGameState() {
  return {
    // State (readonly to prevent direct mutation)
    selectedDifficulty: readonly(selectedDifficulty),
    currentConfig: readonly(currentConfig),
    
    // Actions
    setDifficulty,
    resetDifficulty,
    
    // Computed
    difficultyName,
    difficultyDescription,
    mapConfig,
    monsterConfig,
    playerConfig,
    economyConfig,
    healingPointConfig,
    timingConfig,
    worldWidth,
    worldHeight,
    healingPointNests,
    spawnZone,
    
    // Static data - full config objects for UI display
    availableDifficulties: availableDifficultyConfigs,
  }
}

// Export singleton for direct import
export const gameState = {
  selectedDifficulty,
  currentConfig,
  setDifficulty,
  resetDifficulty,
}
