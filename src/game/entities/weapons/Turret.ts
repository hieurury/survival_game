/**
 * Turret Weapon Class
 * Stationary defense weapon that fires projectiles at enemies
 * 
 * Characteristics:
 * - Fixed position on grid
 * - Ranged attacks with projectiles
 * - Can have homing or straight projectiles
 * - Rotates to track targets
 */

import type { Vector2 } from '../../../types/game'
import type { IDamageable } from '../base/Entity'
import { Weapon } from './WeaponBase'
import type { WeaponConfigBase, WeaponRuntime } from './WeaponBase'

// =============================================================================
// TURRET CONFIG
// =============================================================================
export interface TurretConfig extends WeaponConfigBase {
  weaponType: 'turret'
  category: 'stationary'
  /** Projectile travel speed */
  projectileSpeed: number
  /** Projectile color for rendering */
  projectileColor: string
  /** Whether projectiles home in on targets */
  isHoming: boolean
}

// =============================================================================
// TURRET PROJECTILE DATA
// =============================================================================
export interface TurretProjectile {
  id: number
  position: Vector2
  target: Vector2
  targetMonsterId?: number
  speed: number
  damage: number
  color: string
  isHoming: boolean
}

// =============================================================================
// TURRET CLASS
// =============================================================================
export class Turret extends Weapon {
  // Grid position (stationary)
  public readonly gridX: number
  public readonly gridY: number
  private worldPosition: Vector2
  
  // Turret-specific properties
  public rotation: number
  public projectileSpeed: number
  public projectileColor: string
  public isHoming: boolean
  
  // Current target
  private currentTargetId: number | null = null
  
  constructor(
    id: number,
    ownerId: number,
    gridX: number,
    gridY: number,
    cellSize: number,
    config: TurretConfig
  ) {
    super(id, ownerId, config)
    
    this.gridX = gridX
    this.gridY = gridY
    this.worldPosition = {
      x: (gridX + 0.5) * cellSize,
      y: (gridY + 0.5) * cellSize
    }
    
    this.rotation = 0
    this.projectileSpeed = config.projectileSpeed
    this.projectileColor = config.projectileColor
    this.isHoming = config.isHoming
  }
  
  // =========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =========================================================================
  
  /**
   * Find nearest valid target within range
   * Turrets prioritize closest enemies
   */
  public findTarget(potentialTargets: IDamageable[]): IDamageable | null {
    if (potentialTargets.length === 0) return null
    
    let nearest: IDamageable | null = null
    let nearestDist = Infinity
    
    for (const target of potentialTargets) {
      if (!target.isAlive()) continue
      
      // Get target position (assuming targets have position property)
      const targetWithPos = target as IDamageable & { position: Vector2 }
      if (!targetWithPos.position) continue
      
      const dist = this.getDistanceTo(targetWithPos.position, this.worldPosition)
      if (dist <= this.attackRange && dist < nearestDist) {
        nearest = target
        nearestDist = dist
      }
    }
    
    return nearest
  }
  
  /**
   * Get turret's world position
   */
  public getPosition(): Vector2 {
    return { ...this.worldPosition }
  }
  
  /**
   * Update turret state
   */
  public update(deltaTime: number): void {
    this.updateCooldown(deltaTime)
    
    // Animation update
    if (this.state === 'attacking') {
      this.animationFrame++
      if (this.animationFrame > 3) {
        this.animationFrame = 0
        this.state = 'cooldown'
      }
    }
  }
  
  /**
   * Serialize turret state
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      weaponType: this.weaponType,
      category: this.category,
      ownerId: this.ownerId,
      gridX: this.gridX,
      gridY: this.gridY,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      damage: this.damage,
      baseDamage: this.baseDamage,
      attackRange: this.attackRange,
      baseRange: this.baseRange,
      attackCooldown: this.attackCooldown,
      currentAttackCooldown: this.currentAttackCooldown,
      rotation: this.rotation,
      state: this.state,
      animationFrame: this.animationFrame,
      upgradeCost: this.upgradeCost,
      projectileSpeed: this.projectileSpeed,
      projectileColor: this.projectileColor,
      isHoming: this.isHoming
    }
  }
  
  // =========================================================================
  // TURRET-SPECIFIC METHODS
  // =========================================================================
  
  /**
   * Rotate turret to face a target position
   */
  public rotateTowards(targetPosition: Vector2): void {
    const dx = targetPosition.x - this.worldPosition.x
    const dy = targetPosition.y - this.worldPosition.y
    this.rotation = Math.atan2(dy, dx)
  }
  
  /**
   * Fire a projectile at the target
   * Returns projectile data for the game system to handle
   */
  public fireAt(targetPosition: Vector2, targetMonsterId?: number): TurretProjectile | null {
    if (!this.canAttack()) return null
    
    this.rotateTowards(targetPosition)
    this.currentAttackCooldown = this.attackCooldown
    this.state = 'attacking'
    this.animationFrame = 0
    
    return {
      id: Date.now(), // Temporary ID, should be managed by game system
      position: { ...this.worldPosition },
      target: { ...targetPosition },
      targetMonsterId,
      speed: this.projectileSpeed,
      damage: this.damage,
      color: this.projectileColor,
      isHoming: this.isHoming
    }
  }
  
  /**
   * Set current target ID for tracking
   */
  public setTarget(targetId: number | null): void {
    this.currentTargetId = targetId
    this.state = targetId !== null ? 'targeting' : 'idle'
  }
  
  /**
   * Get current target ID
   */
  public getCurrentTargetId(): number | null {
    return this.currentTargetId
  }
}

// =============================================================================
// TURRET RUNTIME TYPE (for compatibility with existing code)
// =============================================================================
export interface TurretRuntime extends WeaponRuntime {
  weaponType: 'turret'
  gridX: number
  gridY: number
  rotation: number
  projectileSpeed: number
  projectileColor: string
  isHoming: boolean
}

// =============================================================================
// TURRET FACTORY (functional approach for compatibility)
// =============================================================================
export function createTurret(
  id: number,
  ownerId: number,
  gridX: number,
  gridY: number,
  config: TurretConfig
): TurretRuntime {
  return {
    id,
    weaponType: 'turret',
    category: 'stationary',
    ownerId,
    gridX,
    gridY,
    level: 1,
    hp: config.maxHp,
    maxHp: config.maxHp,
    damage: config.baseDamage,
    baseDamage: config.baseDamage,
    attackRange: config.baseRange,
    baseRange: config.baseRange,
    attackCooldown: config.attackCooldown,
    currentAttackCooldown: 0,
    state: 'idle',
    animationFrame: 0,
    upgradeCost: config.upgradeCost,
    maxLevel: config.maxLevel,
    rotation: 0,
    projectileSpeed: config.projectileSpeed,
    projectileColor: config.projectileColor,
    isHoming: config.isHoming
  }
}

// =============================================================================
// TURRET UPGRADE FUNCTION (functional approach)
// =============================================================================
export function upgradeTurret(turret: TurretRuntime, config: TurretConfig): boolean {
  if (turret.level >= config.maxLevel) return false
  
  turret.level++
  turret.damage = Math.floor(turret.baseDamage * Math.pow(config.damageScale, turret.level - 1))
  turret.attackRange = Math.floor(turret.baseRange * Math.pow(config.rangeScale, turret.level - 1))
  turret.upgradeCost = Math.floor(config.upgradeCost * Math.pow(config.upgradeCostScale, turret.level - 1))
  
  return true
}

// =============================================================================
// DEFAULT TURRET CONFIG
// =============================================================================
export const DEFAULT_TURRET_CONFIG: TurretConfig = {
  weaponType: 'turret',
  category: 'stationary',
  name: 'Turret',
  maxHp: 100,
  baseDamage: 10,
  baseRange: 160,
  attackCooldown: 1.0,
  baseCost: 10,
  costCurrency: 'gold',
  upgradeCost: 10,
  upgradeCostScale: 2.0,
  maxLevel: 10,
  damageScale: 1.15,
  rangeScale: 1.2,
  projectileSpeed: 500,
  projectileColor: '#3b82f6',
  isHoming: true,
}
