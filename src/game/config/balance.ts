/**
 * Balance Configuration
 * Entity stats and scaling values that MUST NOT be modified by game modes
 * These define the core balance of the game
 */

// =============================================================================
// PLAYER/HERO STATS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const HERO_BALANCE = {
  /** Player HP */
  HP: 100,
  /** Player movement speed */
  SPEED: 180,
  /** Player base damage */
  DAMAGE: 15,
  /** Player attack range */
  ATTACK_RANGE: 50,
  /** Player attack cooldown */
  ATTACK_COOLDOWN: 1.0,
} as const

// =============================================================================
// MONSTER STATS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const MONSTER_BALANCE = {
  /** Monster max HP */
  MAX_HP: 800,
  /** Monster base damage at level 1 */
  BASE_DAMAGE: 10,
  /** Monster base movement speed */
  SPEED: 120,
  /** Monster attack range */
  ATTACK_RANGE: 55,
  /** Monster attack speed (attacks per second) */
  ATTACK_SPEED: 1.0,
  /** HP threshold to trigger retreat (0.2 = 20%) */
  HEAL_THRESHOLD: 0.2,
  /** HP percent per second when healing at nest */
  HEAL_RATE: 0.2,
  /** Speed multiplier when retreating */
  RETREAT_SPEED_BONUS: 1.5,
  /** Damage multiplier per level */
  DAMAGE_SCALE: 1.4,
  /** HP multiplier per level */
  HP_SCALE: 1.3,
  /** Base seconds for first level up */
  BASE_LEVEL_TIME: 30,
  /** Additional seconds per level */
  LEVEL_TIME_INCREMENT: 10,
} as const

// =============================================================================
// DOOR STATS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const DOOR_BALANCE = {
  /** Base door HP at level 1 */
  BASE_HP: 400,
  /** HP multiplier per level */
  HP_SCALE: 1.5,
  /** Base upgrade cost (gold) */
  BASE_UPGRADE_COST: 40,
  /** Cost multiplier per level (doubles each level) */
  UPGRADE_COST_SCALE: 2,
  /** Level at which souls are required */
  SOUL_REQUIRED_LEVEL: 5,
  /** Soul cost starting at level 5 */
  SOUL_COST: 215,
  /** Repair duration in seconds */
  REPAIR_DURATION: 5,
  /** Repair cooldown in seconds */
  REPAIR_COOLDOWN: 30,
  /** Percent of max HP restored per repair */
  REPAIR_PERCENT: 0.45,
} as const

// =============================================================================
// BED STATS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const BED_BALANCE = {
  /** Base gold per second at level 1 */
  BASE_INCOME: 1,
  /** Base upgrade cost (gold) */
  BASE_UPGRADE_COST: 25,
  /** Cost multiplier per level (doubles each level) */
  UPGRADE_COST_SCALE: 2,
  /** Income multiplier per level (doubling) */
  INCOME_SCALE: 2,
  /** Level at which souls are required */
  SOUL_REQUIRED_LEVEL: 5,
  /** Soul cost starting at level 5 */
  SOUL_COST: 200,
} as const

// =============================================================================
// BUILDING COSTS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const BUILDING_COSTS = {
  /** Turret cost in gold */
  TURRET: 10,
  /** ATM cost in souls */
  ATM: 200,
  /** Soul collector cost in gold */
  SOUL_COLLECTOR: 440,
  /** Vanguard spawner cost in gold */
  VANGUARD: 250,
  /** SMG cost in gold */
  SMG: 100,
  /** Base door upgrade cost */
  UPGRADE_DOOR: 20,
} as const

// =============================================================================
// BUILDING STATS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const BUILDING_BALANCE = {
  /** Default HP for structures */
  STRUCTURE_BASE_HP: 50,
  
  TURRET: {
    hp: 50,
    damage: 10,
    range: 160,
    cooldown: 1.0,
    upgradeCost: 10,
  },
  
  ATM: {
    hp: 50,
    damage: 0,
    range: 0,
    cooldown: 0,
    upgradeCost: 100,
    goldRate: 4,
  },
  
  SOUL_COLLECTOR: {
    hp: 50,
    damage: 0,
    range: 0,
    cooldown: 0,
    upgradeCost: 440,
    soulRate: 1,
  },
  
  VANGUARD_SPAWNER: {
    hp: 200,
    damage: 0,
    range: 0,
    cooldown: 0,
    upgradeCost: 150,
  },
  
  /** SMG - Submachine Gun (Súng tiểu liên) */
  SMG: {
    hp: 50,
    damage: 5, // Base damage per bullet
    range: 200, // Base range
    cooldown: 7.0, // 7 seconds between bursts
    upgradeCost: 100, // Base upgrade cost in gold
    burstCount: 10, // Bullets per burst
    burstInterval: 0.1, // 0.1s between each bullet in burst
    /** Damage scale per level (+10%) */
    damageScale: 1.1,
    /** Range scale per level (+20%) */
    rangeScale: 1.2,
    /** Soul cost from level 5 */
    soulCost: 200,
    /** Level at which souls are required */
    soulRequiredLevel: 5,
  },
  
  /** ATM gold per level: 4, 8, 16, 32, 64, 128 */
  ATM_GOLD_LEVELS: [4, 8, 16, 32, 64, 128],
  
  /** Soul collector souls per level: 1, 2, 4, 8, 16, 32 */
  SOUL_COLLECTOR_LEVELS: [1, 2, 4, 8, 16, 32],
  
  /** Damage scale per building level */
  DAMAGE_SCALE: 1.1,
  
  /** Range scale per building level */
  RANGE_SCALE: 1.2,
} as const

// =============================================================================
// VANGUARD UNIT STATS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const VANGUARD_BALANCE = {
  /** Gold cost to build */
  GOLD_COST: 250,
  /** Soul cost (required from level 5+) */
  SOUL_COST: 80,
  /** Base HP */
  BASE_HP: 100,
  /** Base damage */
  BASE_DAMAGE: 20,
  /** HP multiplier per level */
  HP_SCALE: 1.3,
  /** Damage multiplier per level */
  DAMAGE_SCALE: 1.2,
  /** Base upgrade cost (doubles each level) */
  UPGRADE_COST: 250,
} as const

// =============================================================================
// TRAP STATS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const TRAP_BALANCE = {
  SPIKE: {
    damage: 25,
    damageScale: 1.2,
    cooldown: 3,
    maxCharges: 5,
    baseCost: 30,
    upgradeCost: 20,
    maxLevel: 5,
  },
  
  SLOWDOWN: {
    damage: 0,
    effectDuration: 3,
    cooldown: 5,
    maxCharges: -1,
    baseCost: 50,
    upgradeCost: 35,
    maxLevel: 5,
  },
  
  POISON: {
    damage: 5,
    damageScale: 1.3,
    effectDuration: 5,
    cooldown: 8,
    maxCharges: 3,
    baseCost: 75,
    upgradeCost: 50,
    maxLevel: 5,
  },
} as const

// =============================================================================
// UPGRADE COSTS (DO NOT MODIFY IN GAME MODES)
// =============================================================================
export const UPGRADE_BALANCE = {
  /** Souls required for upgrades at level 5+ */
  SOUL_UPGRADE_COST: 50,
} as const
