/**
 * Weapon System
 * Base class for offensive entities (Turret, Vanguard Unit)
 */

import type { Vector2, VanguardState } from '../../../types/game'
import type { ICombatant, IUpgradeable } from '../base/Entity'

// =============================================================================
// WEAPON TYPE
// =============================================================================
export type WeaponType = 'turret' | 'vanguard'

// =============================================================================
// WEAPON CONFIG BASE
// =============================================================================
export interface WeaponConfig {
  type: WeaponType
  hp: number
  baseDamage: number
  baseRange: number
  attackCooldown: number
  baseCost: number
  costCurrency: 'gold' | 'souls'
  upgradeCost: number
  maxLevel: number
  // Scaling
  damageScale: number
  rangeScale: number
}

// =============================================================================
// TURRET CONFIG
// =============================================================================
export interface TurretConfig extends WeaponConfig {
  type: 'turret'
  projectileSpeed: number
  projectileColor: string
  isHoming: boolean
}

// =============================================================================
// VANGUARD CONFIG
// =============================================================================
export interface VanguardConfig extends WeaponConfig {
  type: 'vanguard'
  speed: number
  detectionRange: number
  respawnTime: number
  hpScale: number
}

// =============================================================================
// TURRET INTERFACE
// =============================================================================
export interface ITurret extends ICombatant, IUpgradeable {
  id: number
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  ownerId: number
  rotation: number
}

// =============================================================================
// TURRET RUNTIME STATE
// =============================================================================
export interface TurretRuntime {
  id: number
  type: 'turret'
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
}

// =============================================================================
// VANGUARD UNIT RUNTIME STATE
// =============================================================================
export interface VanguardRuntime {
  id: number
  buildingId: number // Reference to spawner building
  ownerId: number
  level: number
  hp: number
  maxHp: number
  damage: number
  baseDamage: number
  speed: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  state: VanguardState
  targetMonsterId: boolean
  attackCooldown: number
  currentAttackCooldown: number
  attackRange: number
  detectionRange: number
  respawnTimer: number
  animationFrame: number
  facingRight: boolean
}

// =============================================================================
// TURRET FACTORY
// =============================================================================
export const createTurret = (
  id: number,
  ownerId: number,
  gridX: number,
  gridY: number,
  config: TurretConfig
): TurretRuntime => {
  return {
    id,
    type: 'turret',
    level: 1,
    gridX,
    gridY,
    hp: config.hp,
    maxHp: config.hp,
    damage: config.baseDamage,
    baseDamage: config.baseDamage,
    range: config.baseRange,
    baseRange: config.baseRange,
    cooldown: config.attackCooldown,
    currentCooldown: 0,
    ownerId,
    animationFrame: 0,
    rotation: 0,
    upgradeCost: config.upgradeCost,
  }
}

// =============================================================================
// VANGUARD FACTORY
// =============================================================================
export const createVanguard = (
  id: number,
  buildingId: number,
  ownerId: number,
  position: Vector2,
  config: VanguardConfig
): VanguardRuntime => {
  return {
    id,
    buildingId,
    ownerId,
    level: 1,
    hp: config.hp,
    maxHp: config.hp,
    damage: config.baseDamage,
    baseDamage: config.baseDamage,
    speed: config.speed,
    position: { ...position },
    targetPosition: null,
    path: [],
    state: 'roaming',
    targetMonsterId: false,
    attackCooldown: config.attackCooldown,
    currentAttackCooldown: 0,
    attackRange: config.baseRange,
    detectionRange: config.detectionRange,
    respawnTimer: 0,
    animationFrame: 0,
    facingRight: true,
  }
}

// =============================================================================
// WEAPON UPGRADE
// =============================================================================
export const upgradeTurret = (turret: TurretRuntime, config: TurretConfig): boolean => {
  if (turret.level >= config.maxLevel) return false
  
  turret.level++
  turret.damage = Math.floor(turret.baseDamage * Math.pow(config.damageScale, turret.level - 1))
  turret.range = Math.floor(turret.baseRange * Math.pow(config.rangeScale, turret.level - 1))
  turret.upgradeCost = Math.floor(config.upgradeCost * Math.pow(2, turret.level - 1))
  
  return true
}

export const upgradeVanguard = (vanguard: VanguardRuntime, config: VanguardConfig): boolean => {
  if (vanguard.level >= config.maxLevel) return false
  
  vanguard.level++
  vanguard.maxHp = Math.floor(config.hp * Math.pow(config.hpScale, vanguard.level - 1))
  vanguard.hp = vanguard.maxHp
  vanguard.damage = Math.floor(vanguard.baseDamage * Math.pow(config.damageScale, vanguard.level - 1))
  
  return true
}

// =============================================================================
// DEFAULT CONFIGS
// =============================================================================
export const DEFAULT_TURRET_CONFIG: TurretConfig = {
  type: 'turret',
  hp: 50,
  baseDamage: 10,
  baseRange: 160,
  attackCooldown: 1.0,
  baseCost: 10,
  costCurrency: 'gold',
  upgradeCost: 10,
  maxLevel: 10,
  damageScale: 1.1,
  rangeScale: 1.2,
  projectileSpeed: 500,
  projectileColor: '#3b82f6',
  isHoming: true,
}

export const DEFAULT_VANGUARD_CONFIG: VanguardConfig = {
  type: 'vanguard',
  hp: 100,
  baseDamage: 20,
  baseRange: 45,
  attackCooldown: 1.0,
  baseCost: 150,
  costCurrency: 'gold',
  upgradeCost: 250,
  maxLevel: 10,
  damageScale: 1.2,
  rangeScale: 1.0,
  speed: 150,
  detectionRange: 300,
  respawnTime: 30,
  hpScale: 1.3,
}
