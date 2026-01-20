/**
 * Abstract Character Base Class
 * Foundation for all controllable characters (Player and Bot)
 * 
 * All characters share common behaviors:
 * - Health and damage
 * - Movement and pathfinding
 * - Resource management (gold, souls)
 * - Room ownership
 * - Sleep mechanics
 */

import type { Vector2, EntityState } from '../../../types/game'
import type { IEntity, IDamageable, IMoveable, ICombatant } from '../base/Entity'

// =============================================================================
// CHARACTER ROLE
// =============================================================================
export type CharacterRole = 'survivor' | 'defender' | 'builder' | 'scout'

// =============================================================================
// BASE CHARACTER CONFIG
// =============================================================================
export interface CharacterConfigBase {
  /** Display name */
  name: string
  /** Maximum HP */
  maxHp: number
  /** Movement speed */
  speed: number
  /** Base damage */
  damage: number
  /** Attack range */
  attackRange: number
  /** Attack cooldown in seconds */
  attackCooldown: number
  /** Starting gold amount */
  startingGold: number
  /** Character color for rendering */
  color: string
}

// =============================================================================
// ABSTRACT CHARACTER CLASS
// =============================================================================
/**
 * Abstract base class for all characters
 * Implements common character functionality
 */
export abstract class Character implements IEntity, IDamageable, IMoveable, ICombatant {
  // Identity
  public readonly id: number
  public name: string
  public readonly isHuman: boolean
  public color: string
  public role: CharacterRole
  
  // Health
  public hp: number
  public maxHp: number
  public alive: boolean
  
  // Combat
  public damage: number
  public attackRange: number
  public attackCooldown: number
  public currentAttackCooldown: number
  
  // Movement
  public position: Vector2
  public targetPosition: Vector2 | null
  public path: Vector2[]
  public speed: number
  public baseSpeed: number
  public smoothX: number
  public smoothY: number
  
  // State
  public state: EntityState
  public animationFrame: number
  public animationTimer: number
  public facingRight: boolean
  
  // Resources
  public gold: number
  public souls: number
  
  // Room
  public roomId: number | null
  public isSleeping: boolean
  public sleepTimer: number
  
  constructor(
    id: number,
    isHuman: boolean,
    config: CharacterConfigBase,
    position: Vector2
  ) {
    this.id = id
    this.name = config.name
    this.isHuman = isHuman
    this.color = config.color
    this.role = 'survivor'
    
    // Health
    this.hp = config.maxHp
    this.maxHp = config.maxHp
    this.alive = true
    
    // Combat
    this.damage = config.damage
    this.attackRange = config.attackRange
    this.attackCooldown = config.attackCooldown
    this.currentAttackCooldown = 0
    
    // Movement
    this.position = { ...position }
    this.targetPosition = null
    this.path = []
    this.speed = config.speed
    this.baseSpeed = config.speed
    this.smoothX = position.x
    this.smoothY = position.y
    
    // State
    this.state = 'idle'
    this.animationFrame = 0
    this.animationTimer = 0
    this.facingRight = true
    
    // Resources
    this.gold = config.startingGold
    this.souls = 0
    
    // Room
    this.roomId = null
    this.isSleeping = false
    this.sleepTimer = 0
  }
  
  // =========================================================================
  // DAMAGEABLE INTERFACE IMPLEMENTATION
  // =========================================================================
  
  /**
   * Take damage from an attack
   */
  public takeDamage(amount: number): void {
    if (!this.alive) return
    
    this.hp = Math.max(0, this.hp - amount)
    
    if (this.hp <= 0) {
      this.onDeath()
    }
  }
  
  /**
   * Heal the character
   */
  public heal(amount: number): void {
    if (!this.alive) return
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }
  
  /**
   * Check if character is still alive
   */
  public isAlive(): boolean {
    return this.alive && this.hp > 0
  }
  
  // =========================================================================
  // MOVEABLE INTERFACE IMPLEMENTATION
  // =========================================================================
  
  /**
   * Set movement target
   */
  public moveTo(target: Vector2): void {
    this.targetPosition = { ...target }
    this.state = 'walking'
  }
  
  /**
   * Stop all movement
   */
  public stopMoving(): void {
    this.targetPosition = null
    this.path = []
    if (this.state === 'walking') {
      this.state = 'idle'
    }
  }
  
  /**
   * Move towards a target position
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
   * Update smooth position for rendering
   */
  public updateSmoothPosition(deltaTime: number, factor: number = 0.15): void {
    const smoothFactor = 1 - Math.pow(1 - factor, deltaTime * 60)
    this.smoothX += (this.position.x - this.smoothX) * smoothFactor
    this.smoothY += (this.position.y - this.smoothY) * smoothFactor
  }
  
  // =========================================================================
  // COMBAT INTERFACE IMPLEMENTATION
  // =========================================================================
  
  /**
   * Check if character can attack
   */
  public canAttack(): boolean {
    return this.currentAttackCooldown <= 0 && this.isAlive() && !this.isSleeping
  }
  
  /**
   * Attack a target
   */
  public attack(target: IDamageable): void {
    if (!this.canAttack()) return
    
    target.takeDamage(this.damage)
    this.currentAttackCooldown = this.attackCooldown
    this.state = 'attacking'
  }
  
  /**
   * Update attack cooldown
   */
  public updateCooldown(deltaTime: number): void {
    if (this.currentAttackCooldown > 0) {
      this.currentAttackCooldown -= deltaTime
      if (this.currentAttackCooldown < 0) {
        this.currentAttackCooldown = 0
      }
    }
  }
  
  /**
   * Check if target is within attack range
   */
  public isInRange(targetPosition: Vector2): boolean {
    return this.getDistanceTo(targetPosition) <= this.attackRange
  }
  
  /**
   * Get distance to a position
   */
  public getDistanceTo(targetPosition: Vector2): number {
    const dx = targetPosition.x - this.position.x
    const dy = targetPosition.y - this.position.y
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  // =========================================================================
  // RESOURCE MANAGEMENT
  // =========================================================================
  
  /**
   * Add gold
   */
  public addGold(amount: number): void {
    this.gold += amount
  }
  
  /**
   * Spend gold
   */
  public spendGold(amount: number): boolean {
    if (this.gold < amount) return false
    this.gold -= amount
    return true
  }
  
  /**
   * Add souls
   */
  public addSouls(amount: number): void {
    this.souls += amount
  }
  
  /**
   * Spend souls
   */
  public spendSouls(amount: number): boolean {
    if (this.souls < amount) return false
    this.souls -= amount
    return true
  }
  
  // =========================================================================
  // SLEEP MECHANICS
  // =========================================================================
  
  /**
   * Start sleeping
   */
  public startSleep(): void {
    if (!this.alive || this.roomId === null) return
    
    this.isSleeping = true
    this.sleepTimer = 0
    this.state = 'sleeping'
    this.stopMoving()
  }
  
  /**
   * Wake up from sleep
   */
  public wakeUp(): void {
    this.isSleeping = false
    this.sleepTimer = 0
    this.state = 'idle'
  }
  
  /**
   * Update sleep timer
   */
  public updateSleep(deltaTime: number): void {
    if (this.isSleeping) {
      this.sleepTimer += deltaTime
    }
  }
  
  // =========================================================================
  // ROOM MANAGEMENT
  // =========================================================================
  
  /**
   * Claim a room
   */
  public claimRoom(roomId: number): void {
    this.roomId = roomId
  }
  
  /**
   * Leave current room
   */
  public leaveRoom(): void {
    if (this.isSleeping) {
      this.wakeUp()
    }
    this.roomId = null
  }
  
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  
  /**
   * Called when character dies
   */
  protected onDeath(): void {
    this.alive = false
    this.state = 'dying'
    this.stopMoving()
    this.wakeUp()
  }
  
  /**
   * Respawn the character
   */
  public respawn(position: Vector2): void {
    this.alive = true
    this.hp = this.maxHp
    this.position = { ...position }
    this.smoothX = position.x
    this.smoothY = position.y
    this.state = 'idle'
  }
  
  /**
   * Update character state
   */
  public update(deltaTime: number): void {
    this.updateCooldown(deltaTime)
    this.updateSleep(deltaTime)
    this.updateAnimation(deltaTime)
  }
  
  /**
   * Update animation
   */
  protected updateAnimation(deltaTime: number): void {
    this.animationTimer += deltaTime
    if (this.animationTimer >= 0.1) {
      this.animationTimer = 0
      this.animationFrame = (this.animationFrame + 1) % 4
    }
  }
  
  // =========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // =========================================================================
  
  /**
   * Get character's decision logic (for AI)
   */
  abstract makeDecision(): void
  
  /**
   * Serialize character state
   */
  abstract toJSON(): Record<string, unknown>
}

// =============================================================================
// CHARACTER RUNTIME TYPE (for compatibility)
// =============================================================================
export interface CharacterRuntime {
  id: number
  name: string
  isHuman: boolean
  color: string
  role: CharacterRole
  hp: number
  maxHp: number
  alive: boolean
  damage: number
  attackRange: number
  attackCooldown: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  baseSpeed: number
  smoothX: number
  smoothY: number
  state: EntityState
  animationFrame: number
  facingRight: boolean
  gold: number
  souls: number
  roomId: number | null
  isSleeping: boolean
  sleepTimer: number
}
