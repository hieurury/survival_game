/**
 * Monster System
 * Base class for all enemy entities
 */

import type { Vector2, EntityState, MonsterState } from '../../../types/game'
import type { IEntity, IDamageable, IMoveable, ICombatant } from '../base/Entity'

// =============================================================================
// MONSTER CONFIG
// =============================================================================
export interface MonsterConfig {
  // Base stats
  maxHp: number
  baseDamage: number
  speed: number
  attackRange: number
  attackCooldown: number
  
  // Scaling per level
  damageScale: number // Multiplier per level
  hpScale: number // Multiplier per level
  
  // AI Behavior
  healThreshold: number // HP percent to trigger retreat (0-1)
  healRate: number // HP percent per second when healing
  retreatSpeedBonus: number // Speed multiplier when retreating
  targetTimeout: number // Max seconds to chase same target
  aggressiveness: number // 0-1, affects behavior
  
  // Leveling
  baseLevelTime: number // Seconds for first level up
  levelTimeIncrement: number // Additional seconds per level
}

// =============================================================================
// MONSTER INTERFACE
// =============================================================================
export interface IMonster extends IEntity, IDamageable, IMoveable, ICombatant {
  level: number
  monsterState: MonsterState
  targetPlayerId: number | null
  targetVanguardId: number | null
  isRetreating: boolean
  isFullyHealing: boolean
}

// =============================================================================
// MONSTER RUNTIME STATE
// =============================================================================
export interface MonsterRuntime {
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

// =============================================================================
// MONSTER FACTORY
// =============================================================================
export const createMonster = (
  id: number,
  config: MonsterConfig,
  spawnPosition: Vector2,
  healZones: Vector2[]
): MonsterRuntime => {
  return {
    id,
    hp: config.maxHp,
    maxHp: config.maxHp,
    damage: config.baseDamage,
    baseDamage: config.baseDamage,
    level: 1,
    levelTimer: 0,
    targetRoomId: null,
    targetPlayerId: null,
    targetVanguardId: null,
    position: { ...spawnPosition },
    targetPosition: null,
    path: [],
    speed: config.speed,
    baseSpeed: config.speed,
    state: 'idle',
    monsterState: 'search',
    attackCooldown: 0,
    attackRange: config.attackRange,
    animationFrame: 0,
    animationTimer: 0,
    healZone: { ...spawnPosition },
    healZones: [...healZones],
    isRetreating: false,
    isFullyHealing: false,
    healingInterrupted: false,
    healIdleTimer: 0,
    facingRight: false,
    targetTimer: 0,
    lastTargets: [],
  }
}

// =============================================================================
// MONSTER LEVEL UP
// =============================================================================
export const levelUpMonster = (monster: MonsterRuntime, config: MonsterConfig): void => {
  monster.level++
  monster.levelTimer = 0
  monster.damage = Math.floor(monster.baseDamage * Math.pow(config.damageScale, monster.level - 1))
  monster.maxHp = Math.floor(config.maxHp * Math.pow(config.hpScale, monster.level - 1))
  monster.hp = monster.maxHp // Full heal on level up
}

// =============================================================================
// MONSTER TYPE VARIANTS (for future expansion)
// =============================================================================
export type MonsterType = 'standard' | 'brute' | 'swift' | 'boss'

export interface MonsterTypeConfig extends MonsterConfig {
  type: MonsterType
  name: string
  color: string
  size: number // Size multiplier
}

// =============================================================================
// DEFAULT MONSTER CONFIG
// =============================================================================
export const DEFAULT_MONSTER_CONFIG: MonsterConfig = {
  maxHp: 800,
  baseDamage: 10,
  speed: 120,
  attackRange: 55,
  attackCooldown: 1.0,
  damageScale: 1.4,
  hpScale: 1.3,
  healThreshold: 0.2,
  healRate: 0.2,
  retreatSpeedBonus: 1.5,
  targetTimeout: 30,
  aggressiveness: 0.7,
  baseLevelTime: 30,
  levelTimeIncrement: 10,
}
