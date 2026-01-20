/**
 * Base Entity System
 * Foundation for all game entities with common properties and behaviors
 */

import type { Vector2, EntityState } from '../../../types/game'

// =============================================================================
// BASE ENTITY INTERFACE
// =============================================================================
export interface IEntity {
  id: number
  position: Vector2
  state: EntityState
  animationFrame: number
  facingRight: boolean
}

// =============================================================================
// DAMAGEABLE ENTITY INTERFACE
// =============================================================================
export interface IDamageable {
  hp: number
  maxHp: number
  takeDamage(amount: number): void
  heal(amount: number): void
  isAlive(): boolean
}

// =============================================================================
// MOVEABLE ENTITY INTERFACE
// =============================================================================
export interface IMoveable {
  speed: number
  targetPosition: Vector2 | null
  path: Vector2[]
  moveTo(target: Vector2): void
  stopMoving(): void
}

// =============================================================================
// COMBAT ENTITY INTERFACE
// =============================================================================
export interface ICombatant {
  damage: number
  attackRange: number
  attackCooldown: number
  currentAttackCooldown: number
  canAttack(): boolean
  attack(target: IDamageable): void
}

// =============================================================================
// UPGRADEABLE INTERFACE
// =============================================================================
export interface IUpgradeable {
  level: number
  upgradeCost: number
  maxLevel: number
  canUpgrade(): boolean
  upgrade(): void
  getUpgradeCost(): number
}

// =============================================================================
// BASE ENTITY CONFIG
// =============================================================================
export interface BaseEntityConfig {
  hp: number
  speed: number
  damage: number
  attackRange: number
  attackCooldown: number
}

// =============================================================================
// ENTITY FACTORY TYPE
// =============================================================================
export type EntityFactory<T, C> = (id: number, config: C, position: Vector2) => T
