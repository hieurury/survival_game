/**
 * Game Types & Constants
 * 
 * Types: Interfaces cho game state
 * Constants: Import từ entities và gameModeConfig
 */

import { 
  getBuildingConfig, 
  BUILDING_CONFIGS,
  DEFAULT_TURRET_CONFIG,
  DEFAULT_SMG_CONFIG,
  DEFAULT_VANGUARD_CONFIG,
  DEFAULT_ATM_CONFIG,
  DEFAULT_SOUL_COLLECTOR_CONFIG,
  DEFAULT_MONSTER_CONFIG,
  DEFAULT_PLAYER_CONFIG,
  DEFAULT_DOOR_CONFIG,
  DEFAULT_BED_CONFIG,
} from '../game/config/entityConfigs'

import {
  ECONOMY_CONFIG,
  PURCHASE_COSTS,
  SOUL_PURCHASE_COSTS,
  SOUL_COSTS_LV5,
  MAP_CONFIG,
  SPAWN_ZONE_CONFIG,
  MONSTER_NEST_CONFIG,
  VIEWPORT_CONFIG,
  ANIMATION_CONFIG,
} from '../game/config/gameModeConfig'

// =============================================================================
// TYPES
// =============================================================================
export type GamePhase = 'countdown' | 'playing' | 'paused' | 'ended'

export interface Vector2 {
  x: number
  y: number
}

export type CellType = 'empty' | 'room' | 'corridor' | 'build_spot' | 'heal_zone' | 'wall' | 'door'

export interface GridCell {
  x: number
  y: number
  type: CellType
  roomId?: number
  buildingId?: number
  walkable: boolean
}

export interface Room {
  id: number
  gridX: number
  gridY: number
  width: number
  height: number
  centerX: number
  centerY: number
  doorHp: number
  doorMaxHp: number
  doorLevel: number
  doorUpgradeCost: number
  doorSoulCost: number
  doorRepairCooldown: number
  doorIsRepairing: boolean
  doorRepairTimer: number
  ownerId: number | null
  bedPosition: Vector2
  bedLevel: number
  bedUpgradeCost: number
  bedSoulCost: number
  bedIncome: number
  buildSpots: Vector2[]
  doorPosition: Vector2
  doorGridX: number
  doorGridY: number
  // Shape data for diverse room rendering
  shapeCells: Vector2[]  // All cells of the room (relative to gridX, gridY)
  interiorCells: Vector2[]  // Interior cells (walkable area)
}

export interface DefenseBuilding {
  id: number
  type: 'turret' | 'atm' | 'soul_collector' | 'vanguard' | 'smg'
  level: number
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  damage: number
  baseDamage: number
  range: number
  baseRange: number
  cooldown: number
  currentCooldown: number
  ownerId: number
  animationFrame: number
  rotation: number
  upgradeCost: number
  soulCost?: number
  goldRate?: number
  soulRate?: number
  burstCount?: number
  burstIndex?: number
  burstCooldown?: number
}

export type EntityState = 'idle' | 'walking' | 'attacking' | 'dying' | 'healing' | 'sleeping'

export interface Player {
  id: number
  name: string
  isHuman: boolean
  roomId: number | null
  alive: boolean
  gold: number
  souls: number
  hp: number
  maxHp: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  state: EntityState
  animationFrame: number
  animationTimer: number
  color: string
  attackCooldown: number
  attackRange: number
  damage: number
  facingRight: boolean
  isSleeping: boolean
  sleepTimer: number
  smoothX: number
  smoothY: number
}

export type MonsterState = 'search' | 'attack' | 'disengage' | 'retreat' | 'heal' | 're-engage'

export interface HealingPoint {
  id: number
  position: Vector2
  gridX: number
  gridY: number
  width: number
  height: number
  manaPower: number
  maxManaPower: number
  manaRegenRate: number
}

export interface Monster {
  id: number
  hp: number
  maxHp: number
  damage: number
  baseDamage: number
  level: number
  levelTimer: number
  targetRoomId: number | null
  targetPlayerId: number | null
  targetVanguardId: number | null
  targetHealingPointId: number | null
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  baseSpeed: number
  state: EntityState
  monsterState: MonsterState
  attackCooldown: number
  attackRange: number
  animationFrame: number
  animationTimer: number
  healZone: Vector2
  healZones: Vector2[]
  isRetreating: boolean
  isFullyHealing: boolean
  healingInterrupted: boolean
  healIdleTimer: number
  facingRight: boolean
  targetTimer: number
  lastTargets: number[]
}

export type VanguardState = 'idle' | 'roaming' | 'chasing' | 'attacking' | 'dead'

export interface VanguardUnit {
  id: number
  buildingId: number
  ownerId: number
  hp: number
  maxHp: number
  damage: number
  speed: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  state: VanguardState
  targetMonsterId: boolean
  attackCooldown: number
  respawnTimer: number
  animationFrame: number
  facingRight: boolean
}

export interface FloatingText {
  id: number
  position: Vector2
  text: string
  color: string
  life: number
  maxLife: number
  velocity: Vector2
  size: number
}

export interface Particle {
  position: Vector2
  velocity: Vector2
  life: number
  maxLife: number
  color: string
  size: number
  type: 'spark' | 'blood' | 'heal' | 'build' | 'explosion'
}

export interface Projectile {
  position: Vector2
  target: Vector2
  speed: number
  damage: number
  ownerId: number
  color: string
  size: number
  isHoming?: boolean
  targetMonsterId?: number
}

export interface GameSettings {
  musicVolume: number
  sfxVolume: number
  musicEnabled: boolean
  sfxEnabled: boolean
}

export interface GameState {
  phase: GamePhase
  countdown: number
  tick: number
  nightCount: number
  result: 'win' | 'lose' | null
  selectedRoom: number | null
  logs: string[]
  players: Player[]
  monster: Monster
  rooms: Room[]
  grid: GridCell[][]
  buildings: DefenseBuilding[]
  particles: Particle[]
  projectiles: Projectile[]
  settings: GameSettings
}

// =============================================================================
// GAME CONSTANTS - Single Source of Truth from Entities
// =============================================================================
export const GAME_CONSTANTS = {
  // Map dimensions
  GRID_COLS: MAP_CONFIG.GRID_COLS,
  GRID_ROWS: MAP_CONFIG.GRID_ROWS,
  CELL_SIZE: MAP_CONFIG.CELL_SIZE,
  WORLD_WIDTH: MAP_CONFIG.GRID_COLS * MAP_CONFIG.CELL_SIZE,
  WORLD_HEIGHT: MAP_CONFIG.GRID_ROWS * MAP_CONFIG.CELL_SIZE,
  
  // Central Spawn Zone
  SPAWN_ZONE: SPAWN_ZONE_CONFIG,
  
  // Monster Nests
  MONSTER_NESTS: MONSTER_NEST_CONFIG.POSITIONS,
  
  // Healing Point Mana System
  HEALING_POINT_MAX_MANA: MONSTER_NEST_CONFIG.MAX_MANA,
  HEALING_POINT_MANA_REGEN: MONSTER_NEST_CONFIG.MANA_REGEN,
  HEALING_POINT_MIN_MANA_PERCENT: MONSTER_NEST_CONFIG.MIN_MANA_PERCENT,
  
  // Viewport
  VIEWPORT_WIDTH: VIEWPORT_CONFIG.WIDTH,
  VIEWPORT_HEIGHT: VIEWPORT_CONFIG.HEIGHT,
  CAMERA_PADDING: VIEWPORT_CONFIG.CAMERA_PADDING,
  CAMERA_BOTTOM_PADDING: VIEWPORT_CONFIG.CAMERA_BOTTOM_PADDING,
  
  // Game settings
  AI_COUNT: 4,
  COUNTDOWN_TIME: 30,
  ROOMS_COUNT: MAP_CONFIG.ROOMS_COUNT,
  
  // Player stats (from entities)
  PLAYER_SPEED: DEFAULT_PLAYER_CONFIG.speed,
  PLAYER_HP: DEFAULT_PLAYER_CONFIG.maxHp,
  PLAYER_DAMAGE: DEFAULT_PLAYER_CONFIG.damage,
  PLAYER_ATTACK_RANGE: DEFAULT_PLAYER_CONFIG.attackRange,
  
  // Monster stats (from entities)
  MONSTER_SPEED: DEFAULT_MONSTER_CONFIG.speed,
  MONSTER_RETREAT_SPEED_BONUS: DEFAULT_MONSTER_CONFIG.retreatSpeedBonus,
  MONSTER_MAX_HP: DEFAULT_MONSTER_CONFIG.maxHp,
  MONSTER_BASE_DAMAGE: DEFAULT_MONSTER_CONFIG.baseDamage,
  MONSTER_DAMAGE_SCALE: DEFAULT_MONSTER_CONFIG.damageScale,
  MONSTER_HP_SCALE: DEFAULT_MONSTER_CONFIG.hpScale,
  MONSTER_ATTACK_RANGE: DEFAULT_MONSTER_CONFIG.attackRange,
  MONSTER_ATTACK_SPEED: DEFAULT_MONSTER_CONFIG.attackCooldown,
  MONSTER_HEAL_THRESHOLD: DEFAULT_MONSTER_CONFIG.healThreshold,
  MONSTER_HEAL_RATE: DEFAULT_MONSTER_CONFIG.healRate,
  MONSTER_HEAL_IDLE_DELAY: 5,
  MONSTER_BASE_LEVEL_TIME: DEFAULT_MONSTER_CONFIG.baseLevelTime,
  MONSTER_LEVEL_TIME_INCREMENT: DEFAULT_MONSTER_CONFIG.levelTimeIncrement,
  MONSTER_TARGET_TIMEOUT: DEFAULT_MONSTER_CONFIG.targetTimeout,
  
  // Door settings (from entities)
  BASE_DOOR_HP: DEFAULT_DOOR_CONFIG.baseHp,
  DOOR_HP_SCALE: DEFAULT_DOOR_CONFIG.hpScale,
  DOOR_UPGRADE_COST_SCALE: DEFAULT_DOOR_CONFIG.upgradeCostScale,
  DOOR_REPAIR_DURATION: DEFAULT_DOOR_CONFIG.repairDuration,
  DOOR_REPAIR_COOLDOWN: DEFAULT_DOOR_CONFIG.repairCooldown,
  DOOR_REPAIR_PERCENT: DEFAULT_DOOR_CONFIG.repairPercent,
  DOOR_BASE_UPGRADE_COST: DEFAULT_DOOR_CONFIG.baseUpgradeCost,
  DOOR_SOUL_REQUIRED_LEVEL: DEFAULT_DOOR_CONFIG.soulRequiredLevel,
  DOOR_SOUL_COST: DEFAULT_DOOR_CONFIG.soulCost,
  
  // Bed settings (from entities)
  BED_BASE_INCOME: DEFAULT_BED_CONFIG.baseIncome,
  BED_INCOME_SCALE: DEFAULT_BED_CONFIG.incomeScale,
  BED_BASE_UPGRADE_COST: DEFAULT_BED_CONFIG.baseUpgradeCost,
  BED_UPGRADE_COST_SCALE: DEFAULT_BED_CONFIG.upgradeCostScale,
  BED_INTERACT_RANGE: DEFAULT_BED_CONFIG.interactRange,
  BED_SOUL_REQUIRED_LEVEL: DEFAULT_BED_CONFIG.soulRequiredLevel,
  BED_SOUL_COST: DEFAULT_BED_CONFIG.soulCost,
  
  // Economy
  STARTING_GOLD: ECONOMY_CONFIG.STARTING_GOLD,
  GOLD_PER_SECOND: ECONOMY_CONFIG.GOLD_PER_SECOND,
  
  // Purchase costs (gold) - ATM không nằm ở đây vì dùng souls
  COSTS: PURCHASE_COSTS,
  
  // Soul purchase costs (ATM mua bằng souls)
  SOUL_COSTS: SOUL_PURCHASE_COSTS,
  
  // Soul costs for level 5+ upgrades
  SOUL_COSTS_LV5: SOUL_COSTS_LV5,
  
  // Building stats from entities (single source of truth)
  STRUCTURE_BASE_HP: 50,
  BUILDINGS: {
    turret: {
      hp: DEFAULT_TURRET_CONFIG.maxHp,
      damage: DEFAULT_TURRET_CONFIG.baseDamage,
      range: DEFAULT_TURRET_CONFIG.baseRange,
      cooldown: DEFAULT_TURRET_CONFIG.attackCooldown,
      upgradeCost: DEFAULT_TURRET_CONFIG.upgradeCost,
    },
    atm: {
      hp: DEFAULT_ATM_CONFIG.hp,
      damage: 0,
      range: 0,
      cooldown: 0,
      upgradeCost: DEFAULT_ATM_CONFIG.upgradeCost,
      goldRate: DEFAULT_ATM_CONFIG.baseGoldRate,
    },
    soul_collector: {
      hp: DEFAULT_SOUL_COLLECTOR_CONFIG.hp,
      damage: 0,
      range: 0,
      cooldown: 0,
      upgradeCost: DEFAULT_SOUL_COLLECTOR_CONFIG.upgradeCost,
      soulRate: DEFAULT_SOUL_COLLECTOR_CONFIG.baseSoulRate,
    },
    vanguard: {
      hp: DEFAULT_VANGUARD_CONFIG.maxHp,
      damage: 0,
      range: 0,
      cooldown: 0,
      upgradeCost: DEFAULT_VANGUARD_CONFIG.upgradeCost,
    },
    smg: {
      hp: DEFAULT_SMG_CONFIG.maxHp,
      damage: DEFAULT_SMG_CONFIG.baseDamage,
      range: DEFAULT_SMG_CONFIG.baseRange,
      cooldown: 7.0, // Burst cooldown
      upgradeCost: DEFAULT_SMG_CONFIG.upgradeCost,
      burstCount: 10,
    },
  },
  
  // SMG specific (from entities)
  SMG: {
    BURST_COUNT: 10,
    BURST_INTERVAL: 0.1,
    DAMAGE_SCALE: DEFAULT_SMG_CONFIG.damageScale,
    RANGE_SCALE: DEFAULT_SMG_CONFIG.rangeScale,
    SOUL_REQUIRED_LEVEL: 5,
    SOUL_COST: SOUL_COSTS_LV5.smg,
  },
  
  // ATM/Soul Collector levels
  ATM_GOLD_LEVELS: DEFAULT_ATM_CONFIG.goldRatePerLevel,
  SOUL_COLLECTOR_LEVELS: DEFAULT_SOUL_COLLECTOR_CONFIG.soulRatePerLevel,
  SOUL_UPGRADE_COST: 50,
  
  // Vanguard unit (from entities)
  VANGUARD: {
    GOLD_COST: DEFAULT_VANGUARD_CONFIG.baseCost,
    SOUL_COST: SOUL_COSTS_LV5.vanguard,
    BASE_HP: DEFAULT_VANGUARD_CONFIG.maxHp,
    BASE_DAMAGE: DEFAULT_VANGUARD_CONFIG.baseDamage,
    HP_SCALE: DEFAULT_VANGUARD_CONFIG.hpScale,
    DAMAGE_SCALE: DEFAULT_VANGUARD_CONFIG.damageScale,
    RESPAWN_TIME: DEFAULT_VANGUARD_CONFIG.respawnTime,
    ATTACK_RANGE: DEFAULT_VANGUARD_CONFIG.baseRange,
    ATTACK_COOLDOWN: DEFAULT_VANGUARD_CONFIG.attackCooldown,
    DETECTION_RANGE: DEFAULT_VANGUARD_CONFIG.detectionRange,
    UPGRADE_COST: DEFAULT_VANGUARD_CONFIG.upgradeCost,
  },
  
  // NOTE: damageScale and rangeScale are now per-building-type
  // Use getBuildingConfig(type).damageScale/rangeScale instead
  // BUILDING_DAMAGE_SCALE and BUILDING_RANGE_SCALE have been removed
  // to avoid confusion - each entity has its own scale in entityConfigs.ts
  
  // Animation
  ANIMATION_SPEED: ANIMATION_CONFIG.SPEED,
  ATTACK_COOLDOWN: 1.0,
  SMOOTH_FACTOR: ANIMATION_CONFIG.SMOOTH_FACTOR,
}

// Re-export for convenience
export { getBuildingConfig, BUILDING_CONFIGS }
