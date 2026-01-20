/**
 * Vanguard Weapon Class
 * Mobile defense unit that patrols and attacks enemies
 * 
 * Characteristics:
 * - Can move around the map
 * - Melee attacks
 * - Autonomous behavior (roaming, chasing, attacking)
 * - Spawned from Vanguard buildings
 * - Respawns after death
 */

import type { Vector2, VanguardState } from '../../../types/game'
import type { IDamageable, IMoveable } from '../base/Entity'
import { Weapon } from './WeaponBase'
import type { WeaponConfigBase, WeaponRuntime } from './WeaponBase'

// =============================================================================
// VANGUARD CONFIG
// =============================================================================
export interface VanguardConfig extends WeaponConfigBase {
  weaponType: 'vanguard'
  category: 'mobile'
  /** Movement speed */
  speed: number
  /** Detection range for finding enemies */
  detectionRange: number
  /** Time to respawn after death */
  respawnTime: number
  /** HP scaling per level */
  hpScale: number
}

// =============================================================================
// VANGUARD CLASS
// =============================================================================
export class Vanguard extends Weapon implements IMoveable {
  // Reference to spawner building
  public readonly buildingId: number
  
  // Movement properties
  public position: Vector2
  public targetPosition: Vector2 | null
  public path: Vector2[]
  public speed: number
  public baseSpeed: number
  public facingRight: boolean
  
  // Vanguard-specific properties
  public vanguardState: VanguardState
  public detectionRange: number
  public respawnTime: number
  public respawnTimer: number
  
  // Target tracking
  public targetMonsterId: boolean // Has monster target
  
  // HP scaling
  private hpScale: number
  
  constructor(
    id: number,
    buildingId: number,
    ownerId: number,
    position: Vector2,
    config: VanguardConfig
  ) {
    super(id, ownerId, config)
    
    this.buildingId = buildingId
    
    // Movement
    this.position = { ...position }
    this.targetPosition = null
    this.path = []
    this.speed = config.speed
    this.baseSpeed = config.speed
    this.facingRight = true
    
    // Vanguard state
    this.vanguardState = 'roaming'
    this.detectionRange = config.detectionRange
    this.respawnTime = config.respawnTime
    this.respawnTimer = 0
    
    // Target
    this.targetMonsterId = false
    
    // Scaling
    this.hpScale = config.hpScale
  }
  
  // =========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =========================================================================
  
  /**
   * Find nearest valid target within detection range
   * Vanguards prioritize closest enemies
   */
  public findTarget(potentialTargets: IDamageable[]): IDamageable | null {
    if (potentialTargets.length === 0) return null
    
    let nearest: IDamageable | null = null
    let nearestDist = Infinity
    
    for (const target of potentialTargets) {
      if (!target.isAlive()) continue
      
      const targetWithPos = target as IDamageable & { position: Vector2 }
      if (!targetWithPos.position) continue
      
      const dist = this.getDistanceTo(targetWithPos.position, this.position)
      if (dist <= this.detectionRange && dist < nearestDist) {
        nearest = target
        nearestDist = dist
      }
    }
    
    return nearest
  }
  
  /**
   * Get vanguard's current world position
   */
  public getPosition(): Vector2 {
    return { ...this.position }
  }
  
  /**
   * Update vanguard state
   */
  public update(deltaTime: number): void {
    this.updateCooldown(deltaTime)
    
    // Handle respawn timer
    if (this.vanguardState === 'dead') {
      this.respawnTimer -= deltaTime
      if (this.respawnTimer <= 0) {
        this.respawn()
      }
      return
    }
    
    // Animation update based on state
    this.animationFrame++
    if (this.animationFrame > 7) {
      this.animationFrame = 0
    }
  }
  
  /**
   * Serialize vanguard state
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      weaponType: this.weaponType,
      category: this.category,
      buildingId: this.buildingId,
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
      position: this.position,
      targetPosition: this.targetPosition,
      path: this.path,
      speed: this.speed,
      vanguardState: this.vanguardState,
      detectionRange: this.detectionRange,
      respawnTimer: this.respawnTimer,
      state: this.state,
      animationFrame: this.animationFrame,
      facingRight: this.facingRight,
      upgradeCost: this.upgradeCost,
      targetMonsterId: this.targetMonsterId
    }
  }
  
  // =========================================================================
  // MOVEABLE INTERFACE IMPLEMENTATION
  // =========================================================================
  
  /**
   * Set movement target
   */
  public moveTo(target: Vector2): void {
    this.targetPosition = { ...target }
  }
  
  /**
   * Stop all movement
   */
  public stopMoving(): void {
    this.targetPosition = null
    this.path = []
  }
  
  // =========================================================================
  // VANGUARD-SPECIFIC METHODS
  // =========================================================================
  
  /**
   * Set vanguard state
   */
  public setState(state: VanguardState): void {
    this.vanguardState = state
    if (state === 'attacking') {
      this.state = 'attacking'
    } else if (state === 'dead') {
      this.state = 'destroyed'
    } else {
      this.state = 'idle'
    }
  }
  
  /**
   * Kill the vanguard and start respawn timer
   */
  public die(): void {
    this.hp = 0
    this.vanguardState = 'dead'
    this.state = 'destroyed'
    this.respawnTimer = this.respawnTime
    this.stopMoving()
    this.targetMonsterId = false
  }
  
  /**
   * Respawn the vanguard at a given position
   */
  public respawn(position?: Vector2): void {
    this.hp = this.maxHp
    this.vanguardState = 'roaming'
    this.state = 'idle'
    this.respawnTimer = 0
    this.targetMonsterId = false
    if (position) {
      this.position = { ...position }
    }
  }
  
  /**
   * Check if vanguard is dead
   */
  public isDead(): boolean {
    return this.vanguardState === 'dead' || this.hp <= 0
  }
  
  /**
   * Override onDestroyed to handle vanguard death
   */
  protected override onDestroyed(): void {
    this.die()
  }
  
  /**
   * Override onUpgrade to scale HP with level
   */
  protected override onUpgrade(): void {
    this.maxHp = Math.floor(this.maxHp * Math.pow(this.hpScale, this.level - 1))
    this.hp = this.maxHp // Full heal on upgrade
  }
  
  /**
   * Move towards target position
   */
  public moveTowards(target: Vector2, deltaTime: number): void {
    const dx = target.x - this.position.x
    const dy = target.y - this.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist < 1) return
    
    const moveAmount = this.speed * deltaTime
    const ratio = Math.min(moveAmount / dist, 1)
    
    this.position.x += dx * ratio
    this.position.y += dy * ratio
    this.facingRight = dx > 0
  }
  
  /**
   * Set path for movement
   */
  public setPath(newPath: Vector2[]): void {
    this.path = [...newPath]
    if (newPath.length > 0) {
      this.targetPosition = newPath[0] ?? null
    }
  }
  
  /**
   * Follow the current path
   */
  public followPath(deltaTime: number): boolean {
    if (this.path.length === 0) return false
    
    const nextPoint = this.path[0]
    if (!nextPoint) return false
    
    this.moveTowards(nextPoint, deltaTime)
    
    const dist = this.getDistanceTo(nextPoint, this.position)
    if (dist < 5) {
      this.path.shift()
      if (this.path.length === 0) {
        this.targetPosition = null
        return false
      }
      this.targetPosition = this.path[0] || null
    }
    
    return true
  }
}

// =============================================================================
// VANGUARD RUNTIME TYPE (for compatibility with existing code)
// =============================================================================
export interface VanguardRuntime extends WeaponRuntime {
  weaponType: 'vanguard'
  buildingId: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  baseSpeed: number
  vanguardState: VanguardState
  detectionRange: number
  respawnTime: number
  respawnTimer: number
  targetMonsterId: boolean
  facingRight: boolean
}

// =============================================================================
// VANGUARD FACTORY (functional approach for compatibility)
// =============================================================================
export function createVanguard(
  id: number,
  buildingId: number,
  ownerId: number,
  position: Vector2,
  config: VanguardConfig
): VanguardRuntime {
  return {
    id,
    weaponType: 'vanguard',
    category: 'mobile',
    buildingId,
    ownerId,
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
    position: { ...position },
    targetPosition: null,
    path: [],
    speed: config.speed,
    baseSpeed: config.speed,
    vanguardState: 'roaming',
    detectionRange: config.detectionRange,
    respawnTime: config.respawnTime,
    respawnTimer: 0,
    targetMonsterId: false,
    facingRight: true
  }
}

// =============================================================================
// VANGUARD UPGRADE FUNCTION (functional approach)
// =============================================================================
export function upgradeVanguard(vanguard: VanguardRuntime, config: VanguardConfig): boolean {
  if (vanguard.level >= config.maxLevel) return false
  
  vanguard.level++
  vanguard.maxHp = Math.floor(config.maxHp * Math.pow(config.hpScale, vanguard.level - 1))
  vanguard.hp = vanguard.maxHp // Full heal on upgrade
  vanguard.damage = Math.floor(vanguard.baseDamage * Math.pow(config.damageScale, vanguard.level - 1))
  vanguard.upgradeCost = Math.floor(config.upgradeCost * Math.pow(config.upgradeCostScale, vanguard.level - 1))
  
  return true
}

// =============================================================================
// DEFAULT VANGUARD CONFIG
// =============================================================================
export const DEFAULT_VANGUARD_CONFIG: VanguardConfig = {
  weaponType: 'vanguard',
  category: 'mobile',
  name: 'Vanguard',
  maxHp: 100,
  baseDamage: 20,
  baseRange: 45,
  attackCooldown: 1.0,
  baseCost: 150,
  costCurrency: 'gold',
  upgradeCost: 250,
  upgradeCostScale: 2.0,
  maxLevel: 10,
  damageScale: 1.2,
  rangeScale: 1.0,
  speed: 150,
  detectionRange: 300,
  respawnTime: 30,
  hpScale: 1.3,
}
