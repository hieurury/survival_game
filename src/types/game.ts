export type GamePhase = 'countdown' | 'playing' | 'paused' | 'ended'

export interface Vector2 {
  x: number
  y: number
}

// Cell types for the grid map
export type CellType = 'empty' | 'room' | 'corridor' | 'build_spot' | 'heal_zone' | 'wall'

export interface GridCell {
  x: number
  y: number
  type: CellType
  roomId?: number // if type is 'room'
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
  ownerId: number | null // player who owns this room
  roomType: 'normal' | 'armory' | 'storage' | 'bunker'
  bedPosition: Vector2 // position of bed in room
  bedLevel: number // bed level for gold generation
  buildSpots: Vector2[] // positions where buildings can be placed inside room
}

export interface DefenseBuilding {
  id: number
  type: 'turret' | 'trap' | 'barrier' | 'cannon'
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  damage: number
  range: number
  cooldown: number
  currentCooldown: number
  ownerId: number
  animationFrame: number
  rotation: number
}

export type EntityState = 'idle' | 'walking' | 'attacking' | 'dying' | 'healing' | 'sleeping'

export interface Player {
  id: number
  name: string
  isHuman: boolean
  roomId: number | null
  alive: boolean
  gold: number
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
  smoothX: number // for smooth interpolation
  smoothY: number
}

export interface Monster {
  hp: number
  maxHp: number
  damage: number
  targetRoomId: number | null
  targetPlayerId: number | null
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  state: EntityState
  attackCooldown: number
  attackRange: number
  animationFrame: number
  animationTimer: number
  healZone: Vector2 // position of heal zone
  isRetreating: boolean
  facingRight: boolean
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
  // Map dimensions - LARGER for draggable viewport
  GRID_COLS: 24,
  GRID_ROWS: 16,
  CELL_SIZE: 80, // bigger cells
  WORLD_WIDTH: 1920, // 24 * 80
  WORLD_HEIGHT: 1280, // 16 * 80
  
  // Viewport (what player sees)
  VIEWPORT_WIDTH: 1280,
  VIEWPORT_HEIGHT: 720,
  
  // Game settings
  AI_COUNT: 4,
  COUNTDOWN_TIME: 30,
  PLAYER_SPEED: 150, // faster movement
  MONSTER_SPEED: 100,
  PLAYER_HP: 100,
  PLAYER_DAMAGE: 15,
  PLAYER_ATTACK_RANGE: 60,
  
  // Monster
  MONSTER_MAX_HP: 1200,
  MONSTER_DAMAGE: 30,
  MONSTER_ATTACK_RANGE: 70,
  MONSTER_HEAL_THRESHOLD: 0.2,
  MONSTER_HEAL_RATE: 8,
  
  // Rooms
  BASE_DOOR_HP: 150,
  ROOMS_COUNT: 8,
  
  // Bed & Sleeping
  BED_GOLD_BASE: 3, // base gold per second when sleeping
  BED_GOLD_PER_LEVEL: 2, // extra gold per bed level
  BED_UPGRADE_COST: 60,
  BED_INTERACT_RANGE: 50,
  
  // Economy
  STARTING_GOLD: 100,
  GOLD_PER_SECOND: 0, // only get gold from sleeping now
  
  // Costs
  COSTS: {
    repairDoor: 20,
    upgradeDoor: 50,
    upgradeBed: 60,
    turret: 80,
    trap: 40,
    barrier: 30,
    cannon: 120,
    moveRoom: 10,
  },
  
  // Building stats
  BUILDINGS: {
    turret: { hp: 80, damage: 12, range: 200, cooldown: 0.8 },
    trap: { hp: 50, damage: 40, range: 50, cooldown: 2 },
    barrier: { hp: 250, damage: 0, range: 0, cooldown: 0 },
    cannon: { hp: 120, damage: 30, range: 280, cooldown: 1.5 },
  },
  
  // Animation
  ANIMATION_SPEED: 0.12,
  ATTACK_COOLDOWN: 0.6,
  SMOOTH_FACTOR: 0.15, // for smooth movement interpolation
}
