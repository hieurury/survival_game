/**
 * Entity Base System
 * Extensible base classes and interfaces for all game entities
 * Designed for future expansion with new entity types
 */

import type { Vector2, EntityState } from './index'

// =============================================================================
// BASE ENTITY INTERFACE
// =============================================================================

/**
 * Base interface for all game entities
 * Contains common properties shared by players, monsters, and NPCs
 */
export interface EntityBase {
  id: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  baseSpeed: number
  state: EntityState
  animationFrame: number
  animationTimer: number
  facingRight: boolean
  hp: number
  maxHp: number
}

// =============================================================================
// PLAYER BASE INTERFACES
// =============================================================================

export type PlayerRole = 'survivor' | 'defender' | 'builder' | 'scout'

/**
 * Base interface for all player types (human and bot)
 */
export interface PlayerBase extends EntityBase {
  name: string
  isHuman: boolean
  roomId: number | null
  alive: boolean
  gold: number
  souls: number
  color: string
  attackCooldown: number
  attackRange: number
  damage: number
  isSleeping: boolean
  sleepTimer: number
  smoothX: number
  smoothY: number
  role: PlayerRole
}

/**
 * Bot player with AI-specific properties
 */
export interface BotPlayer extends PlayerBase {
  isHuman: false
  aiState: BotAIState
  aiPersonality: BotPersonality
  aiTargetRoomId: number | null
  aiLastDecisionTime: number
  aiDecisionCooldown: number
}

export type BotAIState = 
  | 'idle'
  | 'seeking_room'
  | 'going_to_bed'
  | 'sleeping'
  | 'building'
  | 'repairing'
  | 'fleeing'
  | 'defending'

export type BotPersonality = 
  | 'aggressive'  // Prioritizes combat and turrets
  | 'defensive'   // Prioritizes door upgrades and repairs
  | 'economic'    // Prioritizes gold generation
  | 'balanced'    // Mix of all strategies

// =============================================================================
// MONSTER BASE INTERFACES
// =============================================================================

export type MonsterArchetype = 
  | 'standard'    // Balanced stats
  | 'tank'        // High HP, slow, low damage
  | 'fast'        // Low HP, fast, medium damage
  | 'ranged'      // Medium HP, attacks from distance
  | 'boss'        // Very high stats, special abilities

export type MonsterBehavior =
  | 'search'      // Looking for targets
  | 'attack'      // Engaging target
  | 'disengage'   // Breaking off attack
  | 'retreat'     // Going to heal
  | 'heal'        // Healing at nest
  | 're-engage'   // Returning to combat

/**
 * Base interface for all monster types
 */
export interface MonsterBase extends EntityBase {
  monsterId: number
  archetype: MonsterArchetype
  damage: number
  baseDamage: number
  level: number
  levelTimer: number
  behavior: MonsterBehavior
  attackCooldown: number
  attackRange: number
  
  // Targeting
  targetRoomId: number | null
  targetPlayerId: number | null
  targetVanguardId: number | null
  targetTimer: number
  lastTargets: number[]
  
  // Healing
  healZones: Vector2[]
  isRetreating: boolean
  isFullyHealing: boolean
  healingInterrupted: boolean // Healing was interrupted due to low mana
  healIdleTimer: number
  
  // Aggression (0-1)
  aggressiveness: number
}

/**
 * Standard monster implementation
 */
export interface StandardMonster extends MonsterBase {
  archetype: 'standard'
}

/**
 * Tank monster - high HP, slow movement
 */
export interface TankMonster extends MonsterBase {
  archetype: 'tank'
  armorValue: number // Damage reduction percentage
}

/**
 * Fast monster - low HP, high speed
 */
export interface FastMonster extends MonsterBase {
  archetype: 'fast'
  dashCooldown: number
  canDash: boolean
}

/**
 * Ranged monster - attacks from distance
 */
export interface RangedMonster extends MonsterBase {
  archetype: 'ranged'
  projectileSpeed: number
  projectileDamage: number
}

/**
 * Boss monster - special abilities
 */
export interface BossMonster extends MonsterBase {
  archetype: 'boss'
  abilities: BossAbility[]
  currentAbility: BossAbility | null
  abilityCooldown: number
}

export interface BossAbility {
  id: string
  name: string
  cooldown: number
  duration: number
  effect: 'aoe_damage' | 'spawn_minions' | 'buff_self' | 'debuff_players'
}

// =============================================================================
// BUILDING BASE INTERFACES
// =============================================================================

export type BuildingCategory = 'defense' | 'economy' | 'utility' | 'special'

/**
 * Base interface for all building types
 */
export interface BuildingBase {
  id: number
  type: string
  category: BuildingCategory
  level: number
  maxLevel: number
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  ownerId: number
  animationFrame: number
  buildCost: number
  upgradeCost: number
  upgradeScale: number
}

/**
 * Defense building - deals damage to monsters
 */
export interface DefenseBuildingBase extends BuildingBase {
  category: 'defense'
  damage: number
  baseDamage: number
  range: number
  baseRange: number
  cooldown: number
  currentCooldown: number
  rotation: number
  damageScale: number
  rangeScale: number
}

/**
 * Economy building - generates resources
 */
export interface EconomyBuildingBase extends BuildingBase {
  category: 'economy'
  resourceType: 'gold' | 'souls'
  baseRate: number
  currentRate: number
  rateScale: number
}

/**
 * Utility building - provides special effects
 */
export interface UtilityBuildingBase extends BuildingBase {
  category: 'utility'
  effectType: string
  effectRadius: number
  effectStrength: number
}

// =============================================================================
// WEAPON BASE INTERFACES
// =============================================================================

export type WeaponType = 'melee' | 'ranged' | 'area' | 'support'
export type DamageType = 'physical' | 'fire' | 'ice' | 'lightning' | 'poison'

/**
 * Base interface for all weapon types
 */
export interface WeaponBase {
  id: string
  name: string
  type: WeaponType
  damageType: DamageType
  baseDamage: number
  attackSpeed: number
  range: number
  level: number
  upgradeCost: number
}

/**
 * Melee weapon - close range attacks
 */
export interface MeleeWeapon extends WeaponBase {
  type: 'melee'
  swingArc: number // degrees
  knockback: number
}

/**
 * Ranged weapon - projectile attacks
 */
export interface RangedWeapon extends WeaponBase {
  type: 'ranged'
  projectileSpeed: number
  accuracy: number // 0-1
  ammoCapacity: number
  reloadTime: number
}

/**
 * Area weapon - affects multiple targets
 */
export interface AreaWeapon extends WeaponBase {
  type: 'area'
  areaRadius: number
  maxTargets: number
  falloffPercent: number // Damage reduction at edge
}

/**
 * Support weapon - buffs/debuffs
 */
export interface SupportWeapon extends WeaponBase {
  type: 'support'
  effectType: 'heal' | 'buff' | 'debuff' | 'shield'
  effectDuration: number
  effectStrength: number
}

// =============================================================================
// PROJECTILE BASE
// =============================================================================

export interface ProjectileBase {
  id: number
  position: Vector2
  target: Vector2
  targetEntityId?: number
  speed: number
  damage: number
  damageType: DamageType
  ownerId: number
  color: string
  size: number
  isHoming: boolean
  lifeTime: number
  maxLifeTime: number
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a new player with default values
 */
export function createPlayerBase(
  id: number,
  name: string,
  isHuman: boolean,
  color: string,
  config: {
    hp: number
    speed: number
    damage: number
    attackRange: number
    startingGold: number
  }
): PlayerBase {
  return {
    id,
    name,
    isHuman,
    color,
    role: 'survivor',
    position: { x: 0, y: 0 },
    targetPosition: null,
    path: [],
    speed: config.speed,
    baseSpeed: config.speed,
    state: 'idle',
    animationFrame: 0,
    animationTimer: 0,
    facingRight: true,
    hp: config.hp,
    maxHp: config.hp,
    roomId: null,
    alive: true,
    gold: config.startingGold,
    souls: 0,
    attackCooldown: 0,
    attackRange: config.attackRange,
    damage: config.damage,
    isSleeping: false,
    sleepTimer: 0,
    smoothX: 0,
    smoothY: 0,
  }
}

/**
 * Create a new monster with default values
 */
export function createMonsterBase(
  id: number,
  archetype: MonsterArchetype,
  config: {
    maxHp: number
    damage: number
    speed: number
    attackRange: number
    aggressiveness: number
  }
): MonsterBase {
  return {
    id,
    monsterId: id,
    archetype,
    position: { x: 0, y: 0 },
    targetPosition: null,
    path: [],
    speed: config.speed,
    baseSpeed: config.speed,
    state: 'idle',
    animationFrame: 0,
    animationTimer: 0,
    facingRight: false,
    hp: config.maxHp,
    maxHp: config.maxHp,
    damage: config.damage,
    baseDamage: config.damage,
    level: 1,
    levelTimer: 0,
    behavior: 'search',
    attackCooldown: 0,
    attackRange: config.attackRange,
    targetRoomId: null,
    targetPlayerId: null,
    targetVanguardId: null,
    targetTimer: 0,
    lastTargets: [],
    healZones: [],
    isRetreating: false,
    isFullyHealing: false,
    healingInterrupted: false,
    healIdleTimer: 0,
    aggressiveness: config.aggressiveness,
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isPlayerBase(entity: EntityBase): entity is PlayerBase {
  return 'isHuman' in entity && 'gold' in entity
}

export function isBotPlayer(entity: EntityBase): entity is BotPlayer {
  return isPlayerBase(entity) && entity.isHuman === false && 'aiState' in entity
}

export function isMonsterBase(entity: EntityBase): entity is MonsterBase {
  return 'archetype' in entity && 'behavior' in entity
}

export function isDefenseBuilding(building: BuildingBase): building is DefenseBuildingBase {
  return building.category === 'defense'
}

export function isEconomyBuilding(building: BuildingBase): building is EconomyBuildingBase {
  return building.category === 'economy'
}
