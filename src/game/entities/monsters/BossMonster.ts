/**
 * Boss Monster Class
 * Very powerful enemy with special abilities
 * 
 * Characteristics:
 * - Very high HP and damage
 * - Multiple special abilities
 * - Phase-based combat
 * - Spawns minions
 */

import type { Vector2 } from '../../../types/game'
import { Monster } from './MonsterBase'
import type { MonsterConfigBase, MonsterRuntime } from './MonsterBase'

// =============================================================================
// BOSS ABILITY TYPES
// =============================================================================
export type BossAbilityType = 'aoe_attack' | 'spawn_minions' | 'enrage' | 'shield' | 'charge'

export interface BossAbility {
  type: BossAbilityType
  name: string
  cooldown: number
  duration: number
  damage?: number
  radius?: number
  minionCount?: number
}

// =============================================================================
// BOSS MONSTER CONFIG
// =============================================================================
export interface BossMonsterConfig extends MonsterConfigBase {
  archetype: 'boss'
  /** Available abilities */
  abilities: BossAbility[]
  /** HP threshold for phase 2 (0-1) */
  phase2Threshold: number
  /** HP threshold for phase 3 (0-1) */
  phase3Threshold: number
  /** Damage multiplier in enraged state */
  enrageMultiplier: number
}

// =============================================================================
// BOSS PHASE
// =============================================================================
export type BossPhase = 1 | 2 | 3

// =============================================================================
// BOSS MONSTER CLASS
// =============================================================================
export class BossMonster extends Monster {
  public abilities: BossAbility[]
  public abilityCooldowns: Map<BossAbilityType, number>
  public currentAbility: BossAbility | null
  public abilityTimer: number
  
  public phase: BossPhase
  public phase2Threshold: number
  public phase3Threshold: number
  
  public isEnraged: boolean
  public enrageMultiplier: number
  
  public shieldActive: boolean
  public shieldHp: number
  public maxShieldHp: number
  
  constructor(
    id: number,
    config: BossMonsterConfig,
    spawnPosition: Vector2,
    healZones: Vector2[] = []
  ) {
    super(id, config, spawnPosition, healZones)
    
    this.abilities = [...config.abilities]
    this.abilityCooldowns = new Map()
    for (const ability of config.abilities) {
      this.abilityCooldowns.set(ability.type, 0)
    }
    this.currentAbility = null
    this.abilityTimer = 0
    
    this.phase = 1
    this.phase2Threshold = config.phase2Threshold
    this.phase3Threshold = config.phase3Threshold
    
    this.isEnraged = false
    this.enrageMultiplier = config.enrageMultiplier
    
    this.shieldActive = false
    this.shieldHp = 0
    this.maxShieldHp = this.maxHp * 0.2 // 20% of max HP
  }
  
  /**
   * Update boss state including abilities
   */
  public override update(deltaTime: number): void {
    super.update(deltaTime)
    
    // Update ability cooldowns
    for (const [type, cooldown] of this.abilityCooldowns) {
      if (cooldown > 0) {
        this.abilityCooldowns.set(type, cooldown - deltaTime)
      }
    }
    
    // Update current ability duration
    if (this.currentAbility && this.abilityTimer > 0) {
      this.abilityTimer -= deltaTime
      if (this.abilityTimer <= 0) {
        this.endAbility()
      }
    }
    
    // Check for phase transitions
    this.checkPhaseTransition()
  }
  
  /**
   * Override damage calculation for shield
   */
  protected override calculateDamageReceived(amount: number): number {
    if (this.shieldActive && this.shieldHp > 0) {
      const shieldDamage = Math.min(amount, this.shieldHp)
      this.shieldHp -= shieldDamage
      
      if (this.shieldHp <= 0) {
        this.shieldActive = false
      }
      
      return Math.max(0, amount - shieldDamage)
    }
    
    return amount
  }
  
  /**
   * Check and handle phase transitions
   */
  private checkPhaseTransition(): void {
    const hpPercent = this.hp / this.maxHp
    
    if (this.phase === 1 && hpPercent <= this.phase2Threshold) {
      this.enterPhase(2)
    } else if (this.phase === 2 && hpPercent <= this.phase3Threshold) {
      this.enterPhase(3)
    }
  }
  
  /**
   * Enter a new phase
   */
  private enterPhase(phase: BossPhase): void {
    this.phase = phase
    
    // Phase-specific behavior
    switch (phase) {
      case 2:
        // Increase speed
        this.speed = this.baseSpeed * 1.3
        break
      case 3:
        // Enrage
        this.activateEnrage()
        break
    }
  }
  
  /**
   * Activate enrage mode
   */
  private activateEnrage(): void {
    this.isEnraged = true
    this.damage = Math.floor(this.baseDamage * this.enrageMultiplier)
    this.speed = this.baseSpeed * 1.5
    this.attackCooldown = this.attackCooldown * 0.7
  }
  
  /**
   * Boss's special abilities
   */
  public getSpecialAbility(): string {
    return 'boss_abilities'
  }
  
  /**
   * Use a specific ability
   */
  public useAbility(abilityType: BossAbilityType): boolean {
    const ability = this.abilities.find(a => a.type === abilityType)
    if (!ability) return false
    
    const cooldown = this.abilityCooldowns.get(abilityType) || 0
    if (cooldown > 0) return false
    
    this.currentAbility = ability
    this.abilityTimer = ability.duration
    this.abilityCooldowns.set(abilityType, ability.cooldown)
    
    // Execute ability effect
    switch (abilityType) {
      case 'shield':
        this.activateShield()
        break
      case 'enrage':
        this.activateEnrage()
        break
      // Other abilities would be handled by the game system
    }
    
    return true
  }
  
  /**
   * Generic use special ability (uses first available)
   */
  public useSpecialAbility(): boolean {
    for (const ability of this.abilities) {
      const cooldown = this.abilityCooldowns.get(ability.type) || 0
      if (cooldown <= 0) {
        return this.useAbility(ability.type)
      }
    }
    return false
  }
  
  /**
   * End current ability
   */
  private endAbility(): void {
    this.currentAbility = null
    this.abilityTimer = 0
  }
  
  /**
   * Activate shield ability
   */
  private activateShield(): void {
    this.shieldActive = true
    this.shieldHp = this.maxShieldHp
  }
  
  /**
   * Get available abilities for current phase
   */
  public getAvailableAbilities(): BossAbility[] {
    return this.abilities.filter(ability => {
      const cooldown = this.abilityCooldowns.get(ability.type) || 0
      return cooldown <= 0
    })
  }
  
  /**
   * Get current phase info
   */
  public getPhaseInfo(): { phase: BossPhase; isEnraged: boolean; shieldActive: boolean } {
    return {
      phase: this.phase,
      isEnraged: this.isEnraged,
      shieldActive: this.shieldActive
    }
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
      phase: this.phase,
      isEnraged: this.isEnraged,
      shieldActive: this.shieldActive,
      shieldHp: this.shieldHp,
      abilities: this.abilities.map(a => a.type),
      currentAbility: this.currentAbility?.type || null
    }
  }
}

// =============================================================================
// BOSS MONSTER RUNTIME (extended)
// =============================================================================
export interface BossMonsterRuntime extends MonsterRuntime {
  archetype: 'boss'
  phase: BossPhase
  isEnraged: boolean
  shieldActive: boolean
  shieldHp: number
  maxShieldHp: number
  abilities: BossAbility[]
  currentAbility: BossAbility | null
  abilityTimer: number
  abilityCooldowns: Record<BossAbilityType, number>
}

// =============================================================================
// BOSS MONSTER FACTORY
// =============================================================================
export function createBossMonster(
  id: number,
  config: BossMonsterConfig,
  spawnPosition: Vector2,
  healZones: Vector2[] = []
): BossMonsterRuntime {
  const abilityCooldowns: Record<BossAbilityType, number> = {
    aoe_attack: 0,
    spawn_minions: 0,
    enrage: 0,
    shield: 0,
    charge: 0
  }
  
  return {
    id,
    archetype: 'boss',
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
    phase: 1,
    isEnraged: false,
    shieldActive: false,
    shieldHp: 0,
    maxShieldHp: config.maxHp * 0.2,
    abilities: [...config.abilities],
    currentAbility: null,
    abilityTimer: 0,
    abilityCooldowns
  }
}

// =============================================================================
// DEFAULT BOSS ABILITIES
// =============================================================================
export const DEFAULT_BOSS_ABILITIES: BossAbility[] = [
  {
    type: 'aoe_attack',
    name: 'Ground Slam',
    cooldown: 10,
    duration: 0.5,
    damage: 50,
    radius: 200
  },
  {
    type: 'spawn_minions',
    name: 'Call Reinforcements',
    cooldown: 30,
    duration: 1,
    minionCount: 3
  },
  {
    type: 'shield',
    name: 'Dark Shield',
    cooldown: 20,
    duration: 5
  },
  {
    type: 'charge',
    name: 'Devastating Charge',
    cooldown: 15,
    duration: 0.3,
    damage: 80
  }
]

// =============================================================================
// DEFAULT BOSS MONSTER CONFIG
// =============================================================================
export const DEFAULT_BOSS_MONSTER_CONFIG: BossMonsterConfig = {
  archetype: 'boss',
  name: 'Boss Monster',
  maxHp: 5000,
  baseDamage: 30,
  speed: 80,
  attackRange: 70,
  attackCooldown: 1.2,
  hpScale: 1.5,
  damageScale: 1.3,
  healThreshold: 0.1, // Only retreats at 10% HP
  healRate: 0.1, // Heals slowly
  retreatSpeedBonus: 1.0, // Doesn't retreat faster
  targetTimeout: 60, // Very persistent
  aggressiveness: 1.0,
  baseLevelTime: 60,
  levelTimeIncrement: 30,
  size: 2.0, // Large
  color: '#9333ea',
  abilities: DEFAULT_BOSS_ABILITIES,
  phase2Threshold: 0.6,
  phase3Threshold: 0.3,
  enrageMultiplier: 1.5
}
