/**
 * Game Constants & Configuration
 * All game balance values in one place for easy tuning
 */

// =============================================================================
// MAP CONFIGURATION
// =============================================================================
export const MAP_CONFIG = {
  GRID_COLS: 50,
  GRID_ROWS: 30,
  CELL_SIZE: 48,
  get WORLD_WIDTH() { return this.GRID_COLS * this.CELL_SIZE }, // 2400
  get WORLD_HEIGHT() { return this.GRID_ROWS * this.CELL_SIZE }, // 1440
  
  SPAWN_ZONE: {
    gridX: 21,
    gridY: 12,
    width: 8,
    height: 6,
  },
  
  MONSTER_NESTS: [
    { gridX: 0, gridY: 0, width: 4, height: 4 },
    { gridX: 46, gridY: 0, width: 4, height: 4 },
    { gridX: 0, gridY: 26, width: 4, height: 4 },
    { gridX: 46, gridY: 26, width: 4, height: 4 },
  ],
  
  ROOMS_COUNT: 7,
} as const

// =============================================================================
// VIEWPORT & CAMERA
// =============================================================================
export const VIEWPORT_CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,
  CAMERA_PADDING: 200,
} as const

// =============================================================================
// PLAYER CONFIGURATION
// =============================================================================
export const PLAYER_CONFIG = {
  SPEED: 180,
  HP: 100,
  DAMAGE: 15,
  ATTACK_RANGE: 50,
  ATTACK_COOLDOWN: 1.0,
  STARTING_GOLD: 20,
  AI_COUNT: 4,
} as const

// =============================================================================
// MONSTER CONFIGURATION
// =============================================================================
export const MONSTER_CONFIG = {
  // Base stats
  MAX_HP: 800,
  BASE_DAMAGE: 10,
  SPEED: 120,
  ATTACK_RANGE: 55,
  ATTACK_COOLDOWN: 1.0,
  
  // Scaling
  DAMAGE_SCALE: 1.4,
  HP_SCALE: 1.3,
  RETREAT_SPEED_BONUS: 1.5,
  
  // AI behavior
  HEAL_THRESHOLD: 0.2,
  HEAL_RATE: 0.2,
  HEAL_IDLE_DELAY: 5,
  TARGET_TIMEOUT: 30,
  
  // Leveling
  BASE_LEVEL_TIME: 30,
  LEVEL_TIME_INCREMENT: 10,
} as const

// =============================================================================
// ROOM & DOOR CONFIGURATION
// =============================================================================
export const ROOM_CONFIG = {
  BASE_DOOR_HP: 350,
  DOOR_HP_SCALE: 1.5,
  DOOR_UPGRADE_COST_SCALE: 2,
  DOOR_REPAIR_DURATION: 5,
  DOOR_REPAIR_COOLDOWN: 30,
  DOOR_REPAIR_PERCENT: 0.35,
  
  // Room sizes
  MIN_WIDTH: 8,
  MAX_WIDTH: 10,
  MIN_HEIGHT: 8,
  MAX_HEIGHT: 10,
} as const

// =============================================================================
// BED & ECONOMY CONFIGURATION
// =============================================================================
export const ECONOMY_CONFIG = {
  BED_BASE_INCOME: 1,
  BED_BASE_UPGRADE_COST: 40,
  BED_INTERACT_RANGE: 60,
  
  GOLD_PER_SECOND: 0,
  STARTING_GOLD: 20,
} as const

// =============================================================================
// BUILDING COSTS
// =============================================================================
export const BUILDING_COSTS = {
  upgradeDoor: 20,
  turret: 10,
  atm: 200, // Costs SOULS
  soulCollector: 440,
  vanguard: 150,
  moveRoom: 6,
} as const

// =============================================================================
// BUILDING STATS
// =============================================================================
export const BUILDING_STATS = {
  turret: {
    hp: 50,
    damage: 10,
    range: 160,
    cooldown: 1.0,
    upgradeCost: 10,
  },
  atm: {
    hp: 50,
    damage: 0,
    range: 0,
    cooldown: 0,
    upgradeCost: 100,
    goldRate: 4,
  },
  soul_collector: {
    hp: 50,
    damage: 0,
    range: 0,
    cooldown: 0,
    upgradeCost: 440,
    soulRate: 1,
  },
  vanguard: {
    hp: 200,
    damage: 0,
    range: 0,
    cooldown: 0,
    upgradeCost: 150,
  },
} as const

export const BUILDING_SCALING = {
  DAMAGE_SCALE: 1.1,
  RANGE_SCALE: 1.2,
  ATM_GOLD_LEVELS: [4, 8, 16, 32, 64, 128],
  SOUL_COLLECTOR_LEVELS: [1, 2, 4, 8, 16, 32],
  SOUL_UPGRADE_COST: 50,
} as const

// =============================================================================
// VANGUARD UNIT CONFIGURATION
// =============================================================================
export const VANGUARD_CONFIG = {
  GOLD_COST: 250,
  SOUL_COST: 80,
  BASE_HP: 100,
  BASE_DAMAGE: 20,
  HP_SCALE: 1.3,
  DAMAGE_SCALE: 1.2,
  RESPAWN_TIME: 30,
  ATTACK_RANGE: 45,
  ATTACK_COOLDOWN: 1.0,
  DETECTION_RANGE: 300,
  UPGRADE_COST: 250,
} as const

// =============================================================================
// ANIMATION & TIMING
// =============================================================================
export const ANIMATION_CONFIG = {
  ANIMATION_SPEED: 0.1,
  SMOOTH_FACTOR: 0.25,
  COUNTDOWN_TIME: 30,
} as const

// =============================================================================
// COMBINED GAME_CONSTANTS (for backward compatibility)
// =============================================================================
export const GAME_CONSTANTS = {
  // Map
  ...MAP_CONFIG,
  WORLD_WIDTH: MAP_CONFIG.GRID_COLS * MAP_CONFIG.CELL_SIZE,
  WORLD_HEIGHT: MAP_CONFIG.GRID_ROWS * MAP_CONFIG.CELL_SIZE,
  
  // Viewport
  VIEWPORT_WIDTH: VIEWPORT_CONFIG.WIDTH,
  VIEWPORT_HEIGHT: VIEWPORT_CONFIG.HEIGHT,
  CAMERA_PADDING: VIEWPORT_CONFIG.CAMERA_PADDING,
  
  // Player
  AI_COUNT: PLAYER_CONFIG.AI_COUNT,
  COUNTDOWN_TIME: ANIMATION_CONFIG.COUNTDOWN_TIME,
  PLAYER_SPEED: PLAYER_CONFIG.SPEED,
  PLAYER_HP: PLAYER_CONFIG.HP,
  PLAYER_DAMAGE: PLAYER_CONFIG.DAMAGE,
  PLAYER_ATTACK_RANGE: PLAYER_CONFIG.ATTACK_RANGE,
  STARTING_GOLD: ECONOMY_CONFIG.STARTING_GOLD,
  
  // Monster
  MONSTER_SPEED: MONSTER_CONFIG.SPEED,
  MONSTER_RETREAT_SPEED_BONUS: MONSTER_CONFIG.RETREAT_SPEED_BONUS,
  MONSTER_MAX_HP: MONSTER_CONFIG.MAX_HP,
  MONSTER_BASE_DAMAGE: MONSTER_CONFIG.BASE_DAMAGE,
  MONSTER_DAMAGE_SCALE: MONSTER_CONFIG.DAMAGE_SCALE,
  MONSTER_HP_SCALE: MONSTER_CONFIG.HP_SCALE,
  MONSTER_ATTACK_RANGE: MONSTER_CONFIG.ATTACK_RANGE,
  MONSTER_ATTACK_SPEED: MONSTER_CONFIG.ATTACK_COOLDOWN,
  MONSTER_HEAL_THRESHOLD: MONSTER_CONFIG.HEAL_THRESHOLD,
  MONSTER_HEAL_RATE: MONSTER_CONFIG.HEAL_RATE,
  MONSTER_HEAL_IDLE_DELAY: MONSTER_CONFIG.HEAL_IDLE_DELAY,
  MONSTER_BASE_LEVEL_TIME: MONSTER_CONFIG.BASE_LEVEL_TIME,
  MONSTER_LEVEL_TIME_INCREMENT: MONSTER_CONFIG.LEVEL_TIME_INCREMENT,
  MONSTER_TARGET_TIMEOUT: MONSTER_CONFIG.TARGET_TIMEOUT,
  
  // Room & Door
  BASE_DOOR_HP: ROOM_CONFIG.BASE_DOOR_HP,
  DOOR_HP_SCALE: ROOM_CONFIG.DOOR_HP_SCALE,
  DOOR_UPGRADE_COST_SCALE: ROOM_CONFIG.DOOR_UPGRADE_COST_SCALE,
  DOOR_REPAIR_DURATION: ROOM_CONFIG.DOOR_REPAIR_DURATION,
  DOOR_REPAIR_COOLDOWN: ROOM_CONFIG.DOOR_REPAIR_COOLDOWN,
  DOOR_REPAIR_PERCENT: ROOM_CONFIG.DOOR_REPAIR_PERCENT,
  ROOMS_COUNT: MAP_CONFIG.ROOMS_COUNT,
  
  // Economy
  BED_BASE_INCOME: ECONOMY_CONFIG.BED_BASE_INCOME,
  BED_BASE_UPGRADE_COST: ECONOMY_CONFIG.BED_BASE_UPGRADE_COST,
  BED_INTERACT_RANGE: ECONOMY_CONFIG.BED_INTERACT_RANGE,
  GOLD_PER_SECOND: ECONOMY_CONFIG.GOLD_PER_SECOND,
  
  // Costs
  COSTS: BUILDING_COSTS,
  
  // Buildings
  STRUCTURE_BASE_HP: 50,
  BUILDINGS: BUILDING_STATS,
  ATM_GOLD_LEVELS: BUILDING_SCALING.ATM_GOLD_LEVELS,
  SOUL_COLLECTOR_LEVELS: BUILDING_SCALING.SOUL_COLLECTOR_LEVELS,
  SOUL_UPGRADE_COST: BUILDING_SCALING.SOUL_UPGRADE_COST,
  BUILDING_DAMAGE_SCALE: BUILDING_SCALING.DAMAGE_SCALE,
  BUILDING_RANGE_SCALE: BUILDING_SCALING.RANGE_SCALE,
  
  // Vanguard
  VANGUARD: VANGUARD_CONFIG,
  
  // Animation
  ANIMATION_SPEED: ANIMATION_CONFIG.ANIMATION_SPEED,
  SMOOTH_FACTOR: ANIMATION_CONFIG.SMOOTH_FACTOR,
  ATTACK_COOLDOWN: PLAYER_CONFIG.ATTACK_COOLDOWN,
} as const

export type GameConstants = typeof GAME_CONSTANTS
