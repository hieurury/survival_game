/**
 * Game Type Definitions
 * All interfaces and type definitions for the game
 */

// =============================================================================
// BASIC TYPES
// =============================================================================
export type GamePhase = 'countdown' | 'playing' | 'paused' | 'ended'

export interface Vector2 {
  x: number
  y: number
}

// =============================================================================
// GRID & MAP TYPES
// =============================================================================
export type CellType = 'empty' | 'room' | 'corridor' | 'build_spot' | 'heal_zone' | 'wall' | 'door'

export interface GridCell {
  x: number
  y: number
  type: CellType
  roomId?: number
  buildingId?: number
  walkable: boolean
}

// =============================================================================
// ROOM TYPES
// =============================================================================
export type RoomType = 'normal' | 'armory' | 'storage' | 'bunker'
export type DoorSide = 'top' | 'bottom' | 'left' | 'right'

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
  doorRepairCooldown: number
  doorIsRepairing: boolean
  doorRepairTimer: number
  ownerId: number | null
  roomType: RoomType
  bedPosition: Vector2
  bedLevel: number
  bedUpgradeCost: number
  bedIncome: number
  buildSpots: Vector2[]
  doorPosition: Vector2
  doorGridX: number
  doorGridY: number
}

// =============================================================================
// ENTITY TYPES
// =============================================================================
export type EntityState = 'idle' | 'walking' | 'attacking' | 'dying' | 'healing' | 'sleeping'

export interface BaseEntity {
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  state: EntityState
  animationFrame: number
  animationTimer: number
  facingRight: boolean
}

// =============================================================================
// PLAYER TYPES
// =============================================================================
export interface Player extends BaseEntity {
  id: number
  name: string
  isHuman: boolean
  roomId: number | null
  alive: boolean
  gold: number
  souls: number
  hp: number
  maxHp: number
  color: string
  attackCooldown: number
  attackRange: number
  damage: number
  isSleeping: boolean
  sleepTimer: number
  smoothX: number
  smoothY: number
}

// =============================================================================
// MONSTER TYPES
// =============================================================================
export type MonsterState = 'search' | 'attack' | 'disengage' | 'retreat' | 'heal' | 're-engage'

export interface Monster extends BaseEntity {
  hp: number
  maxHp: number
  damage: number
  baseDamage: number
  level: number
  levelTimer: number
  targetRoomId: number | null
  targetPlayerId: number | null
  targetVanguardId: number | null
  baseSpeed: number
  monsterState: MonsterState
  attackCooldown: number
  attackRange: number
  healZone: Vector2
  healZones: Vector2[]
  isRetreating: boolean
  isFullyHealing: boolean
  healIdleTimer: number
  targetTimer: number
  lastTargets: number[]
}

// =============================================================================
// BUILDING TYPES
// =============================================================================
export type BuildingType = 'turret' | 'atm' | 'soul_collector' | 'vanguard'

export interface DefenseBuilding {
  id: number
  type: BuildingType
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
  goldRate?: number
  soulRate?: number
}

// =============================================================================
// VANGUARD TYPES
// =============================================================================
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

// =============================================================================
// VISUAL EFFECT TYPES
// =============================================================================
export type ParticleType = 'spark' | 'blood' | 'heal' | 'build' | 'explosion'

export interface Particle {
  position: Vector2
  velocity: Vector2
  life: number
  maxLife: number
  color: string
  size: number
  type: ParticleType
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

// =============================================================================
// GAME STATE TYPES
// =============================================================================
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
// INPUT TYPES
// =============================================================================
export interface MoveInput {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export interface DragState {
  isDragging: boolean
  hasDragged: boolean
  startX: number
  startY: number
}
