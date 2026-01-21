/**
 * Abstract Monster Base Class
 * Foundation for all enemy entities in the game
 * 
 * All monsters share common behaviors:
 * - Health and damage
 * - Movement and pathfinding
 * - State machine for AI behavior
 * - Leveling and scaling
 * - Healing/retreat mechanics
 */

import type { Vector2, EntityState, MonsterState } from '../../../types/game'
import type { IEntity, IDamageable, IMoveable, ICombatant } from '../base/Entity'

// =============================================================================
// MONSTER ARCHETYPE
// =============================================================================
export type MonsterArchetype = 'standard' | 'tank' | 'fast' | 'ranged' | 'boss'

// =============================================================================
// BASE MONSTER CONFIG
// =============================================================================
export interface MonsterConfigBase {
  /** Monster archetype identifier */
  archetype: MonsterArchetype
  /** Display name */
  name: string
  /** Base maximum HP */
  maxHp: number
  /** Base damage per attack */
  baseDamage: number
  /** Movement speed */
  speed: number
  /** Attack range */
  attackRange: number
  /** Cooldown between attacks in seconds */
  attackCooldown: number
  /** HP multiplier per level */
  hpScale: number
  /** Damage multiplier per level */
  damageScale: number
  /** HP threshold to trigger retreat (0-1) */
  healThreshold: number
  /** HP percent per second when healing */
  healRate: number
  /** Speed multiplier when retreating */
  retreatSpeedBonus: number
  /** Max seconds to chase same target */
  targetTimeout: number
  /** Aggression level (0-1) */
  aggressiveness: number
  /** Base seconds for first level up */
  baseLevelTime: number
  /** Additional seconds per level */
  levelTimeIncrement: number
  /** Size multiplier for rendering */
  size: number
  /** Color for rendering */
  color: string
}

// =============================================================================
// ABSTRACT MONSTER CLASS
// =============================================================================
/**
 * Abstract base class for all monsters
 * Implements common monster functionality
 */
export abstract class Monster implements IEntity, IDamageable, IMoveable, ICombatant {
  // Identity
  public readonly id: number
  public readonly archetype: MonsterArchetype
  public readonly name: string
  
  // Health
  public hp: number
  public maxHp: number
  protected baseMaxHp: number
  
  // Combat
  public damage: number
  public baseDamage: number
  public attackRange: number
  public attackCooldown: number
  public currentAttackCooldown: number
  
  // Movement
  public position: Vector2
  public targetPosition: Vector2 | null
  public path: Vector2[]
  public speed: number
  public baseSpeed: number
  
  // State
  public state: EntityState
  public monsterState: MonsterState
  public animationFrame: number
  public animationTimer: number
  public facingRight: boolean
  
  // Level progression
  public level: number
  public levelTimer: number
  protected hpScale: number
  protected damageScale: number
  protected baseLevelTime: number
  protected levelTimeIncrement: number
  
  // Targeting
  public targetRoomId: number | null
  public targetPlayerId: number | null
  public targetVanguardId: number | null
  public targetTimer: number
  public lastTargets: number[]
  protected targetTimeout: number
  
  // Healing/Retreat
  public healZones: Vector2[]
  public healZone: Vector2
  public isRetreating: boolean
  public isFullyHealing: boolean
  public healingInterrupted: boolean
  public healIdleTimer: number
  public targetHealingPointId: number | null
  protected healThreshold: number
  protected healRate: number
  protected retreatSpeedBonus: number
  
  // Behavior
  protected aggressiveness: number
  
  // Rendering
  public size: number
  public color: string
  
  // Skill system
  public skill: MonsterSkill | null = null
  public passiveActive: boolean = false
  public isRanged: boolean = false
  public baseAttackRange: number = 55
  
  constructor(
    id: number,
    config: MonsterConfigBase,
    spawnPosition: Vector2,
    healZones: Vector2[] = []
  ) {
    this.id = id
    this.archetype = config.archetype
    this.name = config.name
    
    // Health
    this.hp = config.maxHp
    this.maxHp = config.maxHp
    this.baseMaxHp = config.maxHp
    
    // Combat
    this.damage = config.baseDamage
    this.baseDamage = config.baseDamage
    this.attackRange = config.attackRange
    this.attackCooldown = config.attackCooldown
    this.currentAttackCooldown = 0
    
    // Movement
    this.position = { ...spawnPosition }
    this.targetPosition = null
    this.path = []
    this.speed = config.speed
    this.baseSpeed = config.speed
    
    // State
    this.state = 'idle'
    this.monsterState = 'search'
    this.animationFrame = 0
    this.animationTimer = 0
    this.facingRight = false
    
    // Level progression
    this.level = 1
    this.levelTimer = 0
    this.hpScale = config.hpScale
    this.damageScale = config.damageScale
    this.baseLevelTime = config.baseLevelTime
    this.levelTimeIncrement = config.levelTimeIncrement
    
    // Targeting
    this.targetRoomId = null
    this.targetPlayerId = null
    this.targetVanguardId = null
    this.targetTimer = 0
    this.lastTargets = []
    this.targetTimeout = config.targetTimeout
    
    // Healing/Retreat
    this.healZones = [...healZones]
    this.healZone = { ...spawnPosition }
    this.isRetreating = false
    this.isFullyHealing = false
    this.healingInterrupted = false
    this.healIdleTimer = 0
    this.targetHealingPointId = null
    this.healThreshold = config.healThreshold
    this.healRate = config.healRate
    this.retreatSpeedBonus = config.retreatSpeedBonus
    
    // Behavior
    this.aggressiveness = config.aggressiveness
    
    // Rendering
    this.size = config.size
    this.color = config.color
  }
  
  // =========================================================================
  // DAMAGEABLE INTERFACE IMPLEMENTATION
  // =========================================================================
  
  /**
   * Take damage from an attack
   */
  public takeDamage(amount: number): void {
    const actualDamage = this.calculateDamageReceived(amount)
    this.hp = Math.max(0, this.hp - actualDamage)
    
    if (this.hp <= 0) {
      this.onDeath()
    } else if (this.shouldRetreat()) {
      this.startRetreat()
    }
  }
  
  /**
   * Calculate actual damage received (can be modified by subclasses for armor, etc.)
   */
  protected calculateDamageReceived(amount: number): number {
    return amount
  }
  
  /**
   * Heal the monster
   */
  public heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }
  
  /**
   * Check if monster is still alive
   */
  public isAlive(): boolean {
    return this.hp > 0
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
  
  // =========================================================================
  // COMBAT INTERFACE IMPLEMENTATION
  // =========================================================================
  
  /**
   * Check if monster can attack
   */
  public canAttack(): boolean {
    return this.currentAttackCooldown <= 0 && this.isAlive()
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
  // LEVEL PROGRESSION
  // =========================================================================
  
  /**
   * Update level timer and check for level up
   */
  public updateLevelProgression(deltaTime: number): boolean {
    this.levelTimer += deltaTime
    
    const levelUpTime = this.baseLevelTime + (this.levelTimeIncrement * this.level)
    if (this.levelTimer >= levelUpTime) {
      this.levelUp()
      return true
    }
    
    return false
  }
  
  /**
   * Level up the monster
   */
  public levelUp(): void {
    this.level++
    this.levelTimer = 0
    
    // Scale stats
    this.damage = Math.floor(this.baseDamage * Math.pow(this.damageScale, this.level - 1))
    this.maxHp = Math.floor(this.baseMaxHp * Math.pow(this.hpScale, this.level - 1))
    this.hp = this.maxHp // Full heal on level up
    
    this.onLevelUp()
  }
  
  /**
   * Hook for subclasses to add custom level up behavior
   */
  protected onLevelUp(): void {
    // Override in subclasses
  }
  
  // =========================================================================
  // RETREAT/HEALING
  // =========================================================================
  
  /**
   * Check if monster should retreat
   */
  public shouldRetreat(): boolean {
    return this.hp / this.maxHp <= this.healThreshold && !this.isFullyHealing
  }
  
  /**
   * Start retreat behavior
   */
  public startRetreat(): void {
    this.isRetreating = true
    this.isFullyHealing = true
    this.healIdleTimer = 0
    this.speed = this.baseSpeed * this.retreatSpeedBonus
    this.targetPlayerId = null
    this.targetVanguardId = null
    this.targetTimer = 0
    this.monsterState = 'retreat'
  }
  
  /**
   * End retreat and resume combat
   */
  public endRetreat(): void {
    this.isRetreating = false
    this.isFullyHealing = false
    this.healingInterrupted = false
    this.targetHealingPointId = null
    this.speed = this.baseSpeed
    this.monsterState = 're-engage'
  }
  
  /**
   * Heal using mana from healing point
   * @returns Amount of mana consumed
   */
  public healWithMana(deltaTime: number, availableMana: number): number {
    const potentialHeal = this.maxHp * this.healRate * deltaTime
    const hpNeeded = this.maxHp - this.hp
    const healAmount = Math.min(potentialHeal, hpNeeded, availableMana)
    
    this.hp += healAmount
    
    // Check if fully healed
    if (this.hp >= this.maxHp) {
      this.hp = this.maxHp
      this.endRetreat()
    }
    
    return healAmount
  }
  
  // =========================================================================
  // TARGETING
  // =========================================================================
  
  /**
   * Update target timer
   * @returns true if target should be changed
   */
  public updateTargetTimer(deltaTime: number): boolean {
    if (this.targetPlayerId !== null) {
      this.targetTimer += deltaTime
      
      if (this.targetTimer >= this.targetTimeout) {
        this.addToLastTargets(this.targetPlayerId)
        this.clearTarget()
        this.monsterState = 'disengage'
        return true
      }
    }
    
    return false
  }
  
  /**
   * Set a new target
   */
  public setTarget(targetId: number, isVanguard: boolean = false): void {
    if (isVanguard) {
      this.targetVanguardId = targetId
    } else {
      this.targetPlayerId = targetId
    }
    this.targetTimer = 0
    this.monsterState = 'attack'
  }
  
  /**
   * Clear current target
   */
  public clearTarget(): void {
    this.targetPlayerId = null
    this.targetVanguardId = null
    this.targetTimer = 0
  }
  
  /**
   * Add target to recent targets list
   */
  private addToLastTargets(targetId: number): void {
    if (!this.lastTargets.includes(targetId)) {
      this.lastTargets.push(targetId)
      if (this.lastTargets.length > 2) {
        this.lastTargets.shift()
      }
    }
  }
  
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  
  /**
   * Called when monster dies
   */
  protected onDeath(): void {
    this.state = 'dying'
    this.stopMoving()
  }
  
  /**
   * Update monster
   */
  public update(deltaTime: number): void {
    this.updateCooldown(deltaTime)
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
   * Get monster's special ability (if any)
   */
  abstract getSpecialAbility(): string | null
  
  /**
   * Use special ability
   */
  abstract useSpecialAbility(): boolean
  
  /**
   * Serialize monster state
   */
  abstract toJSON(): Record<string, unknown>
}

// =============================================================================
// MONSTER SKILL INTERFACE
// =============================================================================
export interface MonsterSkill {
  name: string
  damage: number
  range: number
  cooldown: number // Total cooldown in seconds
  currentCooldown: number // Current cooldown remaining
  isAreaDamage: boolean
  targetStructures: boolean // Does skill target structures?
}

// =============================================================================
// MONSTER RUNTIME TYPE (for compatibility with existing code)
// =============================================================================
export interface MonsterRuntime {
  id: number
  archetype: MonsterArchetype
  name: string
  hp: number
  maxHp: number
  damage: number
  baseDamage: number
  level: number
  levelTimer: number
  levelUpTime: number // Time needed for next level up
  targetRoomId: number | null
  targetPlayerId: number | null
  targetVanguardId: number | null
  targetHealingPointId: number | null
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  baseSpeed: number
  state: EntityState
  monsterState: MonsterState
  attackCooldown: number
  attackRange: number
  baseAttackRange: number // For passive range switch
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
  size: number
  color: string
  // Skill system
  skill: MonsterSkill | null
  passiveActive: boolean // For passive abilities like range switch
  isRanged: boolean // Current attack mode (melee or ranged)
}
