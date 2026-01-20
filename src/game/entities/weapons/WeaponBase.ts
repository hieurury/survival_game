/**
 * Abstract Weapon Base Class
 * Foundation for all weapon types in the game
 * 
 * All weapons share common behaviors:
 * - Damage dealing
 * - Range checking
 * - Cooldown management
 * - Upgrade system
 * - Target acquisition
 */

import type { Vector2 } from '../../../types/game'
import type { ICombatant, IUpgradeable, IDamageable } from '../base/Entity'

// =============================================================================
// WEAPON CATEGORY
// =============================================================================
export type WeaponCategory = 'stationary' | 'mobile' | 'handheld'

// =============================================================================
// WEAPON STATE
// =============================================================================
export type WeaponState = 'idle' | 'targeting' | 'attacking' | 'cooldown' | 'disabled' | 'destroyed'

// =============================================================================
// BASE WEAPON CONFIG
// =============================================================================
export interface WeaponConfigBase {
  /** Unique weapon type identifier */
  weaponType: string
  /** Category of weapon */
  category: WeaponCategory
  /** Display name */
  name: string
  /** Maximum HP (for destructible weapons) */
  maxHp: number
  /** Base damage per attack */
  baseDamage: number
  /** Base attack range */
  baseRange: number
  /** Cooldown between attacks in seconds */
  attackCooldown: number
  /** Base cost to build/acquire */
  baseCost: number
  /** Currency type for purchase */
  costCurrency: 'gold' | 'souls'
  /** Cost to upgrade */
  upgradeCost: number
  /** Cost scaling per level */
  upgradeCostScale: number
  /** Maximum upgrade level */
  maxLevel: number
  /** Damage multiplier per level */
  damageScale: number
  /** Range multiplier per level */
  rangeScale: number
}

// =============================================================================
// ABSTRACT WEAPON CLASS
// =============================================================================
/**
 * Abstract base class for all weapons
 * Implements common weapon functionality
 */
export abstract class Weapon implements ICombatant, IUpgradeable {
  // Identity
  public readonly id: number
  public readonly weaponType: string
  public readonly category: WeaponCategory
  public readonly name: string
  public readonly ownerId: number
  
  // Combat stats
  public damage: number
  public baseDamage: number
  public attackRange: number
  public baseRange: number
  public attackCooldown: number
  public currentAttackCooldown: number
  
  // Health (for destructible weapons)
  public hp: number
  public maxHp: number
  
  // Upgrade system
  public level: number
  public upgradeCost: number
  public maxLevel: number
  
  // State
  public state: WeaponState
  public animationFrame: number
  
  // Scaling factors (from config)
  protected damageScale: number
  protected rangeScale: number
  protected upgradeCostScale: number
  
  constructor(
    id: number,
    ownerId: number,
    config: WeaponConfigBase
  ) {
    this.id = id
    this.ownerId = ownerId
    this.weaponType = config.weaponType
    this.category = config.category
    this.name = config.name
    
    // Combat stats
    this.damage = config.baseDamage
    this.baseDamage = config.baseDamage
    this.attackRange = config.baseRange
    this.baseRange = config.baseRange
    this.attackCooldown = config.attackCooldown
    this.currentAttackCooldown = 0
    
    // Health
    this.hp = config.maxHp
    this.maxHp = config.maxHp
    
    // Upgrade
    this.level = 1
    this.upgradeCost = config.upgradeCost
    this.maxLevel = config.maxLevel
    
    // State
    this.state = 'idle'
    this.animationFrame = 0
    
    // Scaling
    this.damageScale = config.damageScale
    this.rangeScale = config.rangeScale
    this.upgradeCostScale = config.upgradeCostScale
  }
  
  // =========================================================================
  // COMBAT INTERFACE IMPLEMENTATION
  // =========================================================================
  
  /**
   * Check if weapon can attack (cooldown ready)
   */
  public canAttack(): boolean {
    return this.currentAttackCooldown <= 0 && 
           this.state !== 'disabled' && 
           this.state !== 'destroyed' &&
           this.hp > 0
  }
  
  /**
   * Execute attack on target
   * Can be overridden by subclasses for custom attack behavior
   */
  public attack(target: IDamageable): void {
    if (!this.canAttack()) return
    
    target.takeDamage(this.damage)
    this.currentAttackCooldown = this.attackCooldown
    this.state = 'attacking'
  }
  
  /**
   * Update cooldown timer
   * @param deltaTime Time since last update in seconds
   */
  public updateCooldown(deltaTime: number): void {
    if (this.currentAttackCooldown > 0) {
      this.currentAttackCooldown -= deltaTime
      if (this.currentAttackCooldown <= 0) {
        this.currentAttackCooldown = 0
        if (this.state === 'cooldown') {
          this.state = 'idle'
        }
      }
    }
  }
  
  /**
   * Check if target is within attack range
   */
  public isInRange(targetPosition: Vector2, weaponPosition: Vector2): boolean {
    const dx = targetPosition.x - weaponPosition.x
    const dy = targetPosition.y - weaponPosition.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance <= this.attackRange
  }
  
  /**
   * Calculate distance to target
   */
  public getDistanceTo(targetPosition: Vector2, weaponPosition: Vector2): number {
    const dx = targetPosition.x - weaponPosition.x
    const dy = targetPosition.y - weaponPosition.y
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  // =========================================================================
  // UPGRADE INTERFACE IMPLEMENTATION
  // =========================================================================
  
  /**
   * Check if weapon can be upgraded
   */
  public canUpgrade(): boolean {
    return this.level < this.maxLevel
  }
  
  /**
   * Get current upgrade cost
   */
  public getUpgradeCost(): number {
    return this.upgradeCost
  }
  
  /**
   * Upgrade the weapon to next level
   * @returns true if upgrade was successful
   */
  public upgrade(): boolean {
    if (!this.canUpgrade()) return false
    
    this.level++
    this.applyLevelScaling()
    this.calculateNextUpgradeCost()
    this.onUpgrade()
    
    return true
  }
  
  /**
   * Apply damage and range scaling based on level
   */
  protected applyLevelScaling(): void {
    this.damage = Math.floor(this.baseDamage * Math.pow(this.damageScale, this.level - 1))
    this.attackRange = Math.floor(this.baseRange * Math.pow(this.rangeScale, this.level - 1))
  }
  
  /**
   * Calculate upgrade cost for next level
   */
  protected calculateNextUpgradeCost(): void {
    this.upgradeCost = Math.floor(this.upgradeCost * this.upgradeCostScale)
  }
  
  /**
   * Hook for subclasses to add custom upgrade behavior
   */
  protected onUpgrade(): void {
    // Override in subclasses for custom behavior
  }
  
  // =========================================================================
  // DAMAGE & DESTRUCTION
  // =========================================================================
  
  /**
   * Take damage from an attack
   */
  public takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) {
      this.onDestroyed()
    }
  }
  
  /**
   * Heal/repair the weapon
   */
  public heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }
  
  /**
   * Check if weapon is still functional
   */
  public isAlive(): boolean {
    return this.hp > 0 && this.state !== 'destroyed'
  }
  
  /**
   * Called when weapon is destroyed
   */
  protected onDestroyed(): void {
    this.state = 'destroyed'
  }
  
  // =========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // =========================================================================
  
  /**
   * Find the best target within range
   * Each weapon type has different targeting priorities
   */
  abstract findTarget(potentialTargets: IDamageable[]): IDamageable | null
  
  /**
   * Get the weapon's current position
   * Stationary weapons return grid position, mobile weapons return world position
   */
  abstract getPosition(): Vector2
  
  /**
   * Update weapon state
   * @param deltaTime Time since last update in seconds
   */
  abstract update(deltaTime: number): void
  
  /**
   * Serialize weapon state for saving/networking
   */
  abstract toJSON(): Record<string, unknown>
}

// =============================================================================
// WEAPON RUNTIME TYPE
// Type that matches the old functional approach for compatibility
// =============================================================================
export interface WeaponRuntime {
  id: number
  weaponType: string
  category: WeaponCategory
  ownerId: number
  level: number
  hp: number
  maxHp: number
  damage: number
  baseDamage: number
  attackRange: number
  baseRange: number
  attackCooldown: number
  currentAttackCooldown: number
  state: WeaponState
  animationFrame: number
  upgradeCost: number
  maxLevel: number
}
