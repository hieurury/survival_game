/**
 * Phantom Knight Class - "Vong hồn kỵ sỹ"
 * Versatile enemy with both melee and ranged attacks
 * 
 * Characteristics:
 * - HP: 750, Speed: 130, Base Damage: 20
 * - HP Scale: 1.2, Damage Scale: 1.4, Attack Speed: 0.9s
 * - Skill: "Ám xạ cung" (Shadow Arrow) - Instantly destroys a structure in a random room
 * - Passive: "Nội tại võ thuật bóng ma" - Switches to ranged (200 range) when below 50% HP
 */

import type { Vector2 } from '../../../types/game'
import { Monster } from './MonsterBase'
import type { MonsterConfigBase, MonsterRuntime, MonsterSkill } from './MonsterBase'

// =============================================================================
// PHANTOM KNIGHT SKILL CONFIG
// =============================================================================
export const PHANTOM_KNIGHT_SKILL: MonsterSkill = {
  name: 'Ám xạ cung',
  damage: 99999, // Instant kill structure
  range: 9999, // Global range - targets any room
  cooldown: 50,
  currentCooldown: 0,
  isAreaDamage: false,
  targetStructures: true
}

// =============================================================================
// PHANTOM KNIGHT CONFIG
// =============================================================================
export interface PhantomKnightConfig extends MonsterConfigBase {
  archetype: 'ranged'
  /** Range when passive activates (below 50% HP) */
  passiveRangedRange: number
  /** HP threshold to activate passive (0-1) */
  passiveThreshold: number
}

// =============================================================================
// PHANTOM KNIGHT CLASS
// =============================================================================
export class PhantomKnight extends Monster {
  public passiveRangedRange: number
  public passiveThreshold: number
  
  constructor(
    id: number,
    config: PhantomKnightConfig,
    spawnPosition: Vector2,
    healZones: Vector2[] = []
  ) {
    super(id, config, spawnPosition, healZones)
    
    // Initialize skill
    this.skill = { ...PHANTOM_KNIGHT_SKILL }
    
    // Passive config
    this.passiveRangedRange = config.passiveRangedRange
    this.passiveThreshold = config.passiveThreshold
    this.isRanged = false
    this.passiveActive = false
    this.baseAttackRange = config.attackRange
  }
  
  /**
   * Update monster state including passive check
   */
  public override update(deltaTime: number): void {
    super.update(deltaTime)
    
    // Update skill cooldown
    if (this.skill && this.skill.currentCooldown > 0) {
      this.skill.currentCooldown -= deltaTime
      if (this.skill.currentCooldown < 0) {
        this.skill.currentCooldown = 0
      }
    }
    
    // Check passive: "Nội tại võ thuật bóng ma"
    this.checkPassive()
  }
  
  /**
   * Check and activate passive ability
   * When below 50% HP, switch from melee to ranged
   */
  private checkPassive(): void {
    const hpPercent = this.hp / this.maxHp
    
    if (!this.passiveActive && hpPercent <= this.passiveThreshold) {
      this.activatePassive()
    } else if (this.passiveActive && hpPercent > this.passiveThreshold) {
      // Deactivate if healed above threshold
      this.deactivatePassive()
    }
  }
  
  /**
   * Activate "Nội tại võ thuật bóng ma" passive
   */
  private activatePassive(): void {
    this.passiveActive = true
    this.isRanged = true
    this.attackRange = this.passiveRangedRange
  }
  
  /**
   * Deactivate passive (if healed)
   */
  private deactivatePassive(): void {
    this.passiveActive = false
    this.isRanged = false
    this.attackRange = this.baseAttackRange
  }
  
  /**
   * Get special ability name
   */
  public getSpecialAbility(): string | null {
    return 'Ám xạ cung'
  }
  
  /**
   * Use "Ám xạ cung" - Instantly destroy a structure in a random room
   * @returns true if skill was used successfully
   */
  public useSpecialAbility(): boolean {
    if (!this.skill || this.skill.currentCooldown > 0) {
      return false
    }
    
    // Start cooldown
    this.skill.currentCooldown = this.skill.cooldown
    return true
  }
  
  /**
   * Check if skill is ready to use
   */
  public canUseSkill(): boolean {
    return this.skill !== null && this.skill.currentCooldown <= 0
  }
  
  /**
   * Get skill cooldown progress (0-1, 1 = ready)
   */
  public getSkillCooldownProgress(): number {
    if (!this.skill) return 1
    if (this.skill.cooldown === 0) return 1
    return 1 - (this.skill.currentCooldown / this.skill.cooldown)
  }
  
  /**
   * Get passive ability name
   */
  public getPassiveAbility(): string {
    return 'Nội tại võ thuật bóng ma'
  }
  
  /**
   * Check if passive is currently active
   */
  public isPassiveActive(): boolean {
    return this.passiveActive
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
      baseAttackRange: this.baseAttackRange,
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
      skill: this.skill,
      passiveActive: this.passiveActive,
      isRanged: this.isRanged
    }
  }
}

// =============================================================================
// PHANTOM KNIGHT RUNTIME
// =============================================================================
export interface PhantomKnightRuntime extends MonsterRuntime {
  archetype: 'ranged'
  passiveRangedRange: number
  passiveThreshold: number
}

// =============================================================================
// PHANTOM KNIGHT FACTORY
// =============================================================================
export function createPhantomKnight(
  id: number,
  config: PhantomKnightConfig,
  spawnPosition: Vector2,
  healZones: Vector2[] = []
): PhantomKnightRuntime {
  const levelUpTime = config.baseLevelTime + config.levelTimeIncrement
  
  return {
    id,
    archetype: 'ranged',
    name: config.name,
    hp: config.maxHp,
    maxHp: config.maxHp,
    damage: config.baseDamage,
    baseDamage: config.baseDamage,
    level: 1,
    levelTimer: 0,
    levelUpTime,
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
    baseAttackRange: config.attackRange,
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
    // Skill: Ám xạ cung
    skill: { ...PHANTOM_KNIGHT_SKILL },
    passiveActive: false,
    isRanged: false,
    // Phantom Knight specific
    passiveRangedRange: config.passiveRangedRange,
    passiveThreshold: config.passiveThreshold
  }
}

// =============================================================================
// DEFAULT PHANTOM KNIGHT CONFIG
// =============================================================================
export const DEFAULT_PHANTOM_KNIGHT_CONFIG: PhantomKnightConfig = {
  archetype: 'ranged',
  name: 'Vong hồn kỵ sỹ',
  maxHp: 700,
  baseDamage: 15,
  speed: 130,
  attackRange: 55, // Melee range
  attackCooldown: 0.9, // Faster attack speed
  hpScale: 1.2,
  damageScale: 1.3,
  healThreshold: 0.2,
  healRate: 0.15,
  retreatSpeedBonus: 1.5,
  targetTimeout: 30,
  aggressiveness: 0.8,
  baseLevelTime: 35,
  levelTimeIncrement: 12,
  size: 1.1,
  color: '#6366f1', // Indigo/purple color for phantom
  passiveRangedRange: 250, // Range when passive activates
  passiveThreshold: 0.5 // Below 50% HP
}
