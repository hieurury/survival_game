/**
 * SMG Weapon Class
 * Handheld automatic weapon for player use
 * 
 * Characteristics:
 * - High rate of fire
 * - Medium damage per shot
 * - Medium range
 * - Requires ammunition
 * - Can be carried by players
 */

import type { Vector2 } from '../../../types/game'
import type { IDamageable } from '../base/Entity'
import { Weapon } from './WeaponBase'
import type { WeaponConfigBase, WeaponRuntime } from './WeaponBase'

// =============================================================================
// SMG CONFIG
// =============================================================================
export interface SMGConfig extends WeaponConfigBase {
  weaponType: 'smg'
  category: 'handheld'
  /** Projectile travel speed */
  projectileSpeed: number
  /** Projectile color for rendering */
  projectileColor: string
  /** Spray/accuracy angle in degrees */
  spreadAngle: number
  /** Magazine capacity */
  magazineSize: number
  /** Time to reload in seconds */
  reloadTime: number
  /** Fire rate (shots per second) */
  fireRate: number
}

// =============================================================================
// SMG PROJECTILE DATA
// =============================================================================
export interface SMGProjectile {
  id: number
  position: Vector2
  velocity: Vector2
  damage: number
  color: string
  lifeTime: number
}

// =============================================================================
// SMG CLASS
// =============================================================================
export class SMG extends Weapon {
  // Position (carried by player)
  private position: Vector2
  
  // SMG-specific properties
  public projectileSpeed: number
  public projectileColor: string
  public spreadAngle: number
  public magazineSize: number
  public currentAmmo: number
  public reloadTime: number
  public reloadTimer: number
  public isReloading: boolean
  public fireRate: number
  
  // Aim direction
  public aimAngle: number
  
  constructor(
    id: number,
    ownerId: number,
    config: SMGConfig
  ) {
    // Override attack cooldown with fire rate
    const modifiedConfig = {
      ...config,
      attackCooldown: 1 / config.fireRate
    }
    super(id, ownerId, modifiedConfig)
    
    this.position = { x: 0, y: 0 }
    
    this.projectileSpeed = config.projectileSpeed
    this.projectileColor = config.projectileColor
    this.spreadAngle = config.spreadAngle
    this.magazineSize = config.magazineSize
    this.currentAmmo = config.magazineSize
    this.reloadTime = config.reloadTime
    this.reloadTimer = 0
    this.isReloading = false
    this.fireRate = config.fireRate
    
    this.aimAngle = 0
  }
  
  // =========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =========================================================================
  
  /**
   * SMG doesn't auto-target, player aims
   * Returns null - targeting is handled by player input
   */
  public findTarget(_potentialTargets: IDamageable[]): IDamageable | null {
    return null // SMG is aimed by player
  }
  
  /**
   * Get SMG position (same as carrier)
   */
  public getPosition(): Vector2 {
    return { ...this.position }
  }
  
  /**
   * Update SMG state
   */
  public update(deltaTime: number): void {
    this.updateCooldown(deltaTime)
    
    // Handle reload
    if (this.isReloading) {
      this.reloadTimer -= deltaTime
      if (this.reloadTimer <= 0) {
        this.finishReload()
      }
    }
  }
  
  /**
   * Serialize SMG state
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      weaponType: this.weaponType,
      category: this.category,
      ownerId: this.ownerId,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      damage: this.damage,
      baseDamage: this.baseDamage,
      attackRange: this.attackRange,
      baseRange: this.baseRange,
      attackCooldown: this.attackCooldown,
      currentAttackCooldown: this.currentAttackCooldown,
      state: this.state,
      animationFrame: this.animationFrame,
      upgradeCost: this.upgradeCost,
      projectileSpeed: this.projectileSpeed,
      projectileColor: this.projectileColor,
      spreadAngle: this.spreadAngle,
      magazineSize: this.magazineSize,
      currentAmmo: this.currentAmmo,
      reloadTime: this.reloadTime,
      isReloading: this.isReloading,
      fireRate: this.fireRate,
      aimAngle: this.aimAngle
    }
  }
  
  // =========================================================================
  // SMG-SPECIFIC METHODS
  // =========================================================================
  
  /**
   * Update position (called when carrier moves)
   */
  public setPosition(pos: Vector2): void {
    this.position = { ...pos }
  }
  
  /**
   * Set aim direction
   */
  public aim(angle: number): void {
    this.aimAngle = angle
  }
  
  /**
   * Aim towards a target position
   */
  public aimAt(targetPosition: Vector2): void {
    const dx = targetPosition.x - this.position.x
    const dy = targetPosition.y - this.position.y
    this.aimAngle = Math.atan2(dy, dx)
  }
  
  /**
   * Check if can fire
   */
  public override canAttack(): boolean {
    return super.canAttack() && 
           this.currentAmmo > 0 && 
           !this.isReloading
  }
  
  /**
   * Fire a bullet
   * Returns projectile data for the game system
   */
  public fire(): SMGProjectile | null {
    if (!this.canAttack()) return null
    
    // Apply spread
    const spread = (Math.random() - 0.5) * (this.spreadAngle * Math.PI / 180)
    const finalAngle = this.aimAngle + spread
    
    // Calculate velocity
    const velocity: Vector2 = {
      x: Math.cos(finalAngle) * this.projectileSpeed,
      y: Math.sin(finalAngle) * this.projectileSpeed
    }
    
    // Consume ammo and set cooldown
    this.currentAmmo--
    this.currentAttackCooldown = this.attackCooldown
    this.state = 'attacking'
    this.animationFrame = 0
    
    // Auto-reload if empty
    if (this.currentAmmo <= 0) {
      this.startReload()
    }
    
    return {
      id: Date.now(),
      position: { ...this.position },
      velocity,
      damage: this.damage,
      color: this.projectileColor,
      lifeTime: this.attackRange / this.projectileSpeed // Time to travel max range
    }
  }
  
  /**
   * Start reload process
   */
  public startReload(): void {
    if (this.isReloading || this.currentAmmo >= this.magazineSize) return
    
    this.isReloading = true
    this.reloadTimer = this.reloadTime
    this.state = 'cooldown'
  }
  
  /**
   * Finish reload
   */
  private finishReload(): void {
    this.isReloading = false
    this.reloadTimer = 0
    this.currentAmmo = this.magazineSize
    this.state = 'idle'
  }
  
  /**
   * Cancel reload (if interrupted)
   */
  public cancelReload(): void {
    this.isReloading = false
    this.reloadTimer = 0
    this.state = 'idle'
  }
  
  /**
   * Get ammo status
   */
  public getAmmoStatus(): { current: number; max: number; isReloading: boolean } {
    return {
      current: this.currentAmmo,
      max: this.magazineSize,
      isReloading: this.isReloading
    }
  }
  
  /**
   * Override upgrade to improve fire rate
   */
  protected override onUpgrade(): void {
    // Improve fire rate slightly with each level
    const fireRateBonus = 1 + (this.level - 1) * 0.05 // 5% per level
    this.attackCooldown = 1 / (this.fireRate * fireRateBonus)
    
    // Reduce spread with level
    const spreadReduction = 1 - (this.level - 1) * 0.03 // 3% less spread per level
    this.spreadAngle = this.spreadAngle * spreadReduction
  }
}

// =============================================================================
// SMG RUNTIME TYPE (for compatibility with existing code)
// =============================================================================
export interface SMGRuntime extends WeaponRuntime {
  weaponType: 'smg'
  projectileSpeed: number
  projectileColor: string
  spreadAngle: number
  magazineSize: number
  currentAmmo: number
  reloadTime: number
  reloadTimer: number
  isReloading: boolean
  fireRate: number
  aimAngle: number
}

// =============================================================================
// SMG FACTORY (functional approach for compatibility)
// =============================================================================
export function createSMG(
  id: number,
  ownerId: number,
  config: SMGConfig
): SMGRuntime {
  return {
    id,
    weaponType: 'smg',
    category: 'handheld',
    ownerId,
    level: 1,
    hp: config.maxHp,
    maxHp: config.maxHp,
    damage: config.baseDamage,
    baseDamage: config.baseDamage,
    attackRange: config.baseRange,
    baseRange: config.baseRange,
    attackCooldown: 1 / config.fireRate,
    currentAttackCooldown: 0,
    state: 'idle',
    animationFrame: 0,
    upgradeCost: config.upgradeCost,
    maxLevel: config.maxLevel,
    projectileSpeed: config.projectileSpeed,
    projectileColor: config.projectileColor,
    spreadAngle: config.spreadAngle,
    magazineSize: config.magazineSize,
    currentAmmo: config.magazineSize,
    reloadTime: config.reloadTime,
    reloadTimer: 0,
    isReloading: false,
    fireRate: config.fireRate,
    aimAngle: 0
  }
}

// =============================================================================
// DEFAULT SMG CONFIG
// =============================================================================
export const DEFAULT_SMG_CONFIG: SMGConfig = {
  weaponType: 'smg',
  category: 'handheld',
  name: 'SMG',
  maxHp: 100, // Durability
  baseDamage: 8,
  baseRange: 300,
  attackCooldown: 0.1, // Will be calculated from fireRate
  baseCost: 50,
  costCurrency: 'gold',
  upgradeCost: 100,
  upgradeCostScale: 1.5,
  maxLevel: 5,
  damageScale: 1.5,
  rangeScale: 1.3,
  projectileSpeed: 800,
  projectileColor: '#fbbf24',
  spreadAngle: 8, // degrees
  magazineSize: 30,
  reloadTime: 2.0,
  fireRate: 10, // shots per second
}
