export type GamePhase = 'countdown' | 'playing' | 'paused' | 'ended'

export interface Vector2 {
  x: number
  y: number
}

// Cell types for the grid map
export type CellType = 'empty' | 'room' | 'corridor' | 'build_spot' | 'heal_zone' | 'wall' | 'door'

export interface GridCell {
  x: number
  y: number
  type: CellType
  roomId?: number // if type is 'room' or 'door'
  buildingId?: number // if has a defense building
  walkable: boolean
}

export interface Room {
  id: number
  gridX: number // grid position
  gridY: number
  width: number // in grid cells
  height: number
  centerX: number // pixel position
  centerY: number
  doorHp: number
  doorMaxHp: number
  doorLevel: number
  doorUpgradeCost: number // Cost to upgrade door (increases 20% each level)
  doorRepairCooldown: number // Repair cooldown timer
  doorIsRepairing: boolean // Is door currently being repaired
  doorRepairTimer: number // Current repair progress (0-7s)
  ownerId: number | null // player who owns this room
  roomType: 'normal' | 'armory' | 'storage' | 'bunker'
  bedPosition: Vector2 // position of bed in room
  bedLevel: number // bed level for gold generation
  bedUpgradeCost: number // Cost to upgrade bed (doubles each level)
  bedIncome: number // Current gold per second from bed
  buildSpots: Vector2[] // positions where buildings can be placed inside room
  doorPosition: Vector2 // position of the door in pixels
  doorGridX: number // door grid position X
  doorGridY: number // door grid position Y
}

export interface DefenseBuilding {
  id: number
  type: 'turret' | 'atm' | 'soul_collector' | 'vanguard' // 4 structure types
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
  upgradeCost: number // Current upgrade cost (doubles each level)
  goldRate?: number // For ATM - gold per second
  soulRate?: number // For Soul Collector - souls per second
}

export type EntityState = 'idle' | 'walking' | 'attacking' | 'dying' | 'healing' | 'sleeping'

export interface Player {
  id: number
  name: string
  isHuman: boolean
  roomId: number | null
  alive: boolean
  gold: number
  souls: number // New resource for high-level upgrades
  hp: number
  maxHp: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[] // A* path
  speed: number
  state: EntityState
  animationFrame: number
  animationTimer: number
  color: string
  attackCooldown: number
  attackRange: number
  damage: number
  facingRight: boolean
  isSleeping: boolean // sleeping state
  sleepTimer: number // time spent sleeping
  smoothX: number // for smooth interpolation
  smoothY: number
}

export type MonsterState = 'search' | 'attack' | 'disengage' | 'retreat' | 'heal' | 're-engage'

// Healing Point - monster healing zone with mana resource
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
  hp: number
  maxHp: number
  damage: number
  baseDamage: number
  level: number
  levelTimer: number
  targetRoomId: number | null
  targetPlayerId: number | null
  targetVanguardId: number | null // Priority target when attacked by vanguard
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  baseSpeed: number
  state: EntityState
  monsterState: MonsterState // State machine for monster behavior
  attackCooldown: number
  attackRange: number
  animationFrame: number
  animationTimer: number
  healZone: Vector2 // position of heal zone
  healZones: Vector2[] // 4 corner nests
  isRetreating: boolean
  isFullyHealing: boolean // Committed to full heal before re-engaging
  healIdleTimer: number // Idle delay timer after full heal (~5s)
  facingRight: boolean
  targetTimer: number // Time spent attacking current target (30s max)
  lastTargets: number[] // Track recent targets to avoid re-targeting immediately
}

// Vanguard Unit - autonomous frontline defender
export type VanguardState = 'idle' | 'roaming' | 'chasing' | 'attacking' | 'dead'

export interface VanguardUnit {
  id: number
  buildingId: number // Reference to parent building
  ownerId: number
  hp: number
  maxHp: number
  damage: number
  speed: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  state: VanguardState
  targetMonsterId: boolean // Is currently targeting monster
  attackCooldown: number
  respawnTimer: number // 30s respawn cooldown when dead
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
  isHoming?: boolean // If true, tracks monster's current position
}

export interface GameSettings {
  musicVolume: number
  sfxVolume: number
  musicEnabled: boolean
  sfxEnabled: boolean
}

export interface GameState {
  phase: GamePhase
  countdown: number // 30s countdown
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

export const GAME_CONSTANTS = {
  // Map dimensions - LARGER map for more space
  GRID_COLS: 50,
  GRID_ROWS: 30,
  CELL_SIZE: 48, // cell size
  WORLD_WIDTH: 2400, // 50 * 48
  WORLD_HEIGHT: 1440, // 30 * 48
  
  // Central Spawn Zone (no building allowed here)
  SPAWN_ZONE: {
    gridX: 21, // Center of 50-col map
    gridY: 12, // Center of 30-row map
    width: 8,  // 8 cells wide
    height: 6, // 6 cells tall
  },
  
  // Monster Nest Zones (2 opposite corners for healing with mana system)
  MONSTER_NESTS: [
    { gridX: 0, gridY: 0, width: 4, height: 4 },       // Top-left
    { gridX: 46, gridY: 26, width: 4, height: 4 },     // Bottom-right
  ],
  
  // Healing Point Mana System
  HEALING_POINT_MAX_MANA: 5000,
  HEALING_POINT_MANA_REGEN: 50, // mana per second
  HEALING_POINT_MIN_MANA_PERCENT: 0.10, // 10% minimum to allow healing
  
  // Viewport (what player sees) - optimized for mobile
  VIEWPORT_WIDTH: 960,
  VIEWPORT_HEIGHT: 540,
  CAMERA_PADDING: 200, // Extra padding to view map edges/corners
  
  // Game settings
  AI_COUNT: 4,
  COUNTDOWN_TIME: 30,
  PLAYER_SPEED: 180,
  MONSTER_SPEED: 120, // Base speed (can increase when retreating)
  MONSTER_RETREAT_SPEED_BONUS: 1.5, // +50% speed when retreating
  PLAYER_HP: 100,
  PLAYER_DAMAGE: 15,
  PLAYER_ATTACK_RANGE: 50,
  
  // Monster - INTELLIGENT AI & PROGRESSIVE SCALING
  MONSTER_MAX_HP: 800,
  MONSTER_BASE_DAMAGE: 10, // Base damage at level 1
  MONSTER_DAMAGE_SCALE: 1.4, // +10% damage per level
  MONSTER_HP_SCALE: 1.3, // +10% max HP per level
  MONSTER_ATTACK_RANGE: 55,
  MONSTER_ATTACK_SPEED: 1.0, // 1 attack per second
  MONSTER_HEAL_THRESHOLD: 0.2, // Retreat at 20% HP
  MONSTER_HEAL_RATE: 0.2, // 20% max HP per second when healing at nest
  MONSTER_HEAL_IDLE_DELAY: 5, // Idle delay after full heal before re-engaging (~5 seconds)
  MONSTER_BASE_LEVEL_TIME: 30, // Base seconds per level
  MONSTER_LEVEL_TIME_INCREMENT: 10, // +10 seconds per level
  MONSTER_TARGET_TIMEOUT: 30, // Max 30 seconds attacking same target
  
  // Rooms & Doors - NEW SCALING
  BASE_DOOR_HP: 350, // Level 1 = 150 HP
  DOOR_HP_SCALE: 1.5, // Each level = previous * 1.5
  DOOR_UPGRADE_COST_SCALE: 2, // Cost increases 20% each level
  DOOR_REPAIR_DURATION: 5, // Seconds to repair
  DOOR_REPAIR_COOLDOWN: 30, // Cooldown between repairs
  DOOR_REPAIR_PERCENT: 0.35, // Heals 35% of max HP
  ROOMS_COUNT: 7, // 7 rooms now
  
  // Bed & Sleeping - DOUBLING GOLD/COST SCALING (NO WAKE UP)
  BED_BASE_INCOME: 1, // Base gold per second at level 1
  BED_BASE_UPGRADE_COST: 40, // Initial upgrade cost (was 12)
  BED_INTERACT_RANGE: 60,
  
  // Economy
  STARTING_GOLD: 20,
  GOLD_PER_SECOND: 0,
  
  // Costs - 4 structure types now
  COSTS: {
    upgradeDoor: 20, // Base cost
    turret: 10, // Turret cost in gold
    atm: 200, // ATM costs SOULS, not gold!
    soulCollector: 440, // Soul collector cost in gold
    vanguard: 150, // Vanguard cost in gold
    moveRoom: 6,
  },
  
  // Building stats - 4 types now
  STRUCTURE_BASE_HP: 50, // Default HP for all structures
  BUILDINGS: {
    turret: { hp: 50, damage: 10, range: 160, cooldown: 1.0, upgradeCost: 10 },
    atm: { hp: 50, damage: 0, range: 0, cooldown: 0, upgradeCost: 100, goldRate: 4 }, // 4 gold/s base, costs souls
    soul_collector: { hp: 50, damage: 0, range: 0, cooldown: 0, upgradeCost: 440, soulRate: 1 },
    vanguard: { hp: 200, damage: 0, range: 0, cooldown: 0, upgradeCost: 150 }, // Spawner building
  },
  
  // ATM gold scaling: 4, 8, 16, 32, 64... per level (starts at 4)
  ATM_GOLD_LEVELS: [4, 8, 16, 32, 64, 128],
  // Soul collector scaling: 1, 2, 4, 8, 16... per level
  SOUL_COLLECTOR_LEVELS: [1, 2, 4, 8, 16, 32],
  // Souls required for upgrades at level 5+
  SOUL_UPGRADE_COST: 50, // Base souls needed at level 5
  
  // Vanguard Unit constants
  VANGUARD: {
    GOLD_COST: 250,
    SOUL_COST: 80, // Required from level 5+
    BASE_HP: 100,
    BASE_DAMAGE: 20,
    HP_SCALE: 1.3, // +30% HP per level
    DAMAGE_SCALE: 1.2, // +20% damage per level
    RESPAWN_TIME: 30, // 30 seconds respawn
    ATTACK_RANGE: 45, // Melee attack range
    ATTACK_COOLDOWN: 1.0, // 1 attack per second
    DETECTION_RANGE: 300, // Range to detect monsters
    UPGRADE_COST: 250, // Base upgrade cost (doubles each level)
  },
  
  // Building upgrade scaling
  BUILDING_DAMAGE_SCALE: 1.1, // +10% damage per level (was 1.2)
  BUILDING_RANGE_SCALE: 1.2, // +20% range per level (was 1.1)
  
  // Animation
  ANIMATION_SPEED: 0.1,
  ATTACK_COOLDOWN: 1.0, // 1 attack per second base
  SMOOTH_FACTOR: 0.25,
}
