/**
 * Fast Monster Class
 * Low HP, high speed, can dash
 * 
 * Characteristics:
 * - Low HP pool
 * - Very high movement speed
 * - Can dash to close distance quickly
 * - Higher attack frequency
 */

import type { Vector2 } from '../../../types/game'
import { Monster } from './MonsterBase'
import type { MonsterConfigBase, MonsterRuntime } from './MonsterBase'

// =============================================================================
// FAST MONSTER CONFIG
// =============================================================================
export interface FastMonsterConfig extends MonsterConfigBase {
  archetype: 'fast'
  /** Cooldown for dash ability in seconds */
  dashCooldown: number
  /** Distance covered by dash */
  dashDistance: number
  /** Speed multiplier during dash */
  dashSpeedMultiplier: number
}

// =============================================================================
// FAST MONSTER CLASS
// =============================================================================
export class FastMonster extends Monster {
  public dashCooldown: number
  public currentDashCooldown: number
  public dashDistance: number
  public dashSpeedMultiplier: number
  public isDashing: boolean
  public dashTarget: Vector2 | null
  
  constructor(
    id: number,
    config: FastMonsterConfig,
    spawnPosition: Vector2,
    healZones: Vector2[] = []
  ) {
    super(id, config, spawnPosition, healZones)
    
    this.dashCooldown = config.dashCooldown
    this.currentDashCooldown = 0
    this.dashDistance = config.dashDistance
    this.dashSpeedMultiplier = config.dashSpeedMultiplier
    this.isDashing = false
    this.dashTarget = null
  }
  
  /**
   * Update dash cooldown
   */
  public override update(deltaTime: number): void {
    super.update(deltaTime)
    
    if (this.currentDashCooldown > 0) {
      this.currentDashCooldown -= deltaTime
    }
    
    // Handle dash movement
    if (this.isDashing && this.dashTarget) {
      this.moveTowards(this.dashTarget, deltaTime * this.dashSpeedMultiplier)
      
      if (this.getDistanceTo(this.dashTarget) < 10) {
        this.endDash()
      }
    }
  }
  
  /**
   * Fast monster's special ability: Dash
   */
  public getSpecialAbility(): string {
    return 'dash'
  }
  
  /**
   * Check if can dash
   */
  public canDash(): boolean {
    return this.currentDashCooldown <= 0 && !this.isDashing && this.isAlive()
  }
  
  /**
   * Use Dash ability
   */
  public useSpecialAbility(): boolean {
    return this.dashTowards(this.targetPosition || this.position)
  }
  
  /**
   * Dash towards a target position
   */
  public dashTowards(target: Vector2): boolean {
    if (!this.canDash()) return false
    
    const dx = target.x - this.position.x
    const dy = target.y - this.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist < 1) return false
    
    // Calculate dash endpoint
    const actualDist = Math.min(dist, this.dashDistance)
    const ratio = actualDist / dist
    
    this.dashTarget = {
      x: this.position.x + dx * ratio,
      y: this.position.y + dy * ratio
    }
    
    this.isDashing = true
    this.currentDashCooldown = this.dashCooldown
    
    return true
  }
  
  /**
   * End dash movement
   */
  private endDash(): void {
    this.isDashing = false
    this.dashTarget = null
  }
  
  /**
   * Override movement to be faster
   */
  public override moveTowards(target: Vector2, deltaTime: number): void {
    const speedMultiplier = this.isDashing ? this.dashSpeedMultiplier : 1
    const dx = target.x - this.position.x
    const dy = target.y - this.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist < 1) return
    
    const moveAmount = this.speed * speedMultiplier * deltaTime
    const ratio = Math.min(moveAmount / dist, 1)
    
    this.position.x += dx * ratio
    this.position.y += dy * ratio
    this.facingRight = dx > 0
  }
  
  /**
   * Serialize monster state
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      archetype: this.archetype,
      name: this.name,
      hp: this.hp,
      maxHp: this.maxHp,
      damage: this.damage,
      baseDamage: this.baseDamage,
      level: this.level,
      levelTimer: this.levelTimer,
      position: this.position,
      targetPosition: this.targetPosition,
      path: this.path,
      speed: this.speed,
      baseSpeed: this.baseSpeed,
      state: this.state,
      monsterState: this.monsterState,
      attackCooldown: this.attackCooldown,
      attackRange: this.attackRange,
      animationFrame: this.animationFrame,
      facingRight: this.facingRight,
      targetPlayerId: this.targetPlayerId,
      targetVanguardId: this.targetVanguardId,
      targetHealingPointId: this.targetHealingPointId,
      isRetreating: this.isRetreating,
      isFullyHealing: this.isFullyHealing,
      healingInterrupted: this.healingInterrupted,
      size: this.size,
      color: this.color,
      dashCooldown: this.dashCooldown,
      currentDashCooldown: this.currentDashCooldown,
      isDashing: this.isDashing
    }
  }
}

// =============================================================================
// FAST MONSTER RUNTIME (extended)
// =============================================================================
export interface FastMonsterRuntime extends MonsterRuntime {
  archetype: 'fast'
  dashCooldown: number
  currentDashCooldown: number
  dashDistance: number
  isDashing: boolean
  dashTarget: Vector2 | null
}

// =============================================================================
// FAST MONSTER FACTORY
// =============================================================================
export function createFastMonster(
  id: number,
  config: FastMonsterConfig,
  spawnPosition: Vector2,
  healZones: Vector2[] = []
): FastMonsterRuntime {
  return {
    id,
    archetype: 'fast',
    hp: config.maxHp,
    maxHp: config.maxHp,
    damage: config.baseDamage,
    baseDamage: config.baseDamage,
    level: 1,
    levelTimer: 0,
    targetRoomId: null,
    targetPlayerId: null,
    targetVanguardId: null,
    targetHealingPointId: null,
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
    size: config.size,
    color: config.color,
    dashCooldown: config.dashCooldown,
    currentDashCooldown: 0,
    dashDistance: config.dashDistance,
    isDashing: false,
    dashTarget: null
  }
}

// =============================================================================
// DEFAULT FAST MONSTER CONFIG
// =============================================================================
export const DEFAULT_FAST_MONSTER_CONFIG: FastMonsterConfig = {
  archetype: 'fast',
  name: 'Fast Monster',
  maxHp: 400,
  baseDamage: 12,
  speed: 200, // Very fast
  attackRange: 45,
  attackCooldown: 0.6, // Attacks faster
  hpScale: 1.2,
  damageScale: 1.3,
  healThreshold: 0.3, // Retreats earlier due to low HP
  healRate: 0.3, // Heals faster
  retreatSpeedBonus: 2.0, // Very fast retreat
  targetTimeout: 20, // Less persistent
  aggressiveness: 0.5,
  baseLevelTime: 25,
  levelTimeIncrement: 8,
  size: 0.8, // Smaller
  color: '#22c55e',
  dashCooldown: 5,
  dashDistance: 150,
  dashSpeedMultiplier: 3.0
}
