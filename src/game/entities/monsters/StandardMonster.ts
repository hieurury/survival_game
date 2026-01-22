/**
 * Standard Monster Class - "Ác ma" (Demon)
 * Basic enemy with balanced stats and area damage skill
 * 
 * Characteristics:
 * - Balanced HP, damage, and speed
 * - Skill: "Gầm thét âm vong" (Wailing Roar) - AoE damage to structures
 * - Standard AI behavior
 */

import type { Vector2 } from '../../../types/game'
import { Monster } from './MonsterBase'
import type { MonsterConfigBase, MonsterRuntime, MonsterSkill } from './MonsterBase'

// =============================================================================
// ÁC MA (DEMON) SKILL CONFIG
// =============================================================================
export const DEMON_SKILL: MonsterSkill = {
  name: 'Gầm thét âm vong',
  damage: 20,
  range: 100,
  cooldown: 25,
  currentCooldown: 0,
  isAreaDamage: true,
  targetStructures: true
}

// =============================================================================
// STANDARD MONSTER CONFIG
// =============================================================================
export interface StandardMonsterConfig extends MonsterConfigBase {
  archetype: 'standard'
}

// =============================================================================
// STANDARD MONSTER CLASS - ÁC MA (DEMON)
// =============================================================================
export class StandardMonster extends Monster {
  constructor(
    id: number,
    config: StandardMonsterConfig,
    spawnPosition: Vector2,
    healZones: Vector2[] = []
  ) {
    super(id, config, spawnPosition, healZones)
    // Initialize skill
    this.skill = { ...DEMON_SKILL }
  }
  
  /**
   * Update skill cooldown
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
  }
  
  /**
   * Ác ma has "Gầm thét âm vong" skill
   */
  public getSpecialAbility(): string | null {
    return 'Gầm thét âm vong'
  }
  
  /**
   * Use "Gầm thét âm vong" - AoE damage to structures in 200 range
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
      color: this.color
    }
  }
}

// =============================================================================
// ÁC MA FACTORY
// =============================================================================
export function createStandardMonster(
  id: number,
  config: StandardMonsterConfig,
  spawnPosition: Vector2,
  healZones: Vector2[] = []
): MonsterRuntime {
  const levelUpTime = config.baseLevelTime + config.levelTimeIncrement
  
  return {
    id,
    archetype: 'standard',
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
    // Skill: Gầm thét âm vong
    skill: { ...DEMON_SKILL },
    passiveActive: false,
    isRanged: false
  }
}

// =============================================================================
// DEFAULT ÁC MA (DEMON) CONFIG
// =============================================================================
export const DEFAULT_STANDARD_MONSTER_CONFIG: StandardMonsterConfig = {
  archetype: 'standard',
  name: 'Ác ma',
  maxHp: 850,
  baseDamage: 10,
  speed: 120,
  attackRange: 55,
  attackCooldown: 1.0,
  hpScale: 1.35,
  damageScale: 1.2,
  healThreshold: 0.3,
  healRate: 0.1,
  retreatSpeedBonus: 1.5,
  targetTimeout: 30,
  aggressiveness: 0.7,
  baseLevelTime: 30,
  levelTimeIncrement: 5,
  size: 1.0,
  color: '#ef4444'
}
