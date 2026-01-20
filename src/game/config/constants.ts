/**
 * Game Constants
 * Core constants that do NOT change between game modes
 * These define fundamental game mechanics and should not be modified
 */

// =============================================================================
// VIEWPORT & RENDERING
// =============================================================================
export const VIEWPORT_CONSTANTS = {
  /** Default viewport width */
  VIEWPORT_WIDTH: 960,
  /** Default viewport height */
  VIEWPORT_HEIGHT: 540,
  /** Extra padding to view map edges/corners */
  CAMERA_PADDING: 400,
  /** Extra bottom padding for UI elements */
  CAMERA_BOTTOM_PADDING: 200,
  /** Animation speed multiplier */
  ANIMATION_SPEED: 0.1,
  /** Smooth interpolation factor for movement */
  SMOOTH_FACTOR: 0.25,
} as const

// =============================================================================
// CELL & GRID
// =============================================================================
export const GRID_CONSTANTS = {
  /** Size of each grid cell in pixels */
  CELL_SIZE: 48,
} as const

// =============================================================================
// INTERACTION RANGES
// =============================================================================
export const INTERACTION_CONSTANTS = {
  /** Range to interact with bed */
  BED_INTERACT_RANGE: 60,
} as const

// =============================================================================
// DOOR MECHANICS
// =============================================================================
export const DOOR_CONSTANTS = {
  /** Seconds to repair a door */
  DOOR_REPAIR_DURATION: 5,
  /** Cooldown between repairs in seconds */
  DOOR_REPAIR_COOLDOWN: 30,
  /** Percent of max HP restored per repair */
  DOOR_REPAIR_PERCENT: 0.35,
} as const

// =============================================================================
// VANGUARD CONSTANTS
// =============================================================================
export const VANGUARD_CONSTANTS = {
  /** Respawn time after death in seconds */
  RESPAWN_TIME: 30,
  /** Melee attack range */
  ATTACK_RANGE: 45,
  /** Attack cooldown in seconds */
  ATTACK_COOLDOWN: 1.0,
  /** Range to detect monsters */
  DETECTION_RANGE: 300,
} as const

// =============================================================================
// MONSTER AI TIMING
// =============================================================================
export const MONSTER_AI_CONSTANTS = {
  /** Max seconds to attack same target before switching */
  TARGET_TIMEOUT: 30,
  /** Idle delay after full heal before re-engaging (seconds) */
  HEAL_IDLE_DELAY: 5,
} as const
