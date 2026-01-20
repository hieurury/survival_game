/**
 * Standard Monster Class
 * Basic enemy with balanced stats
 * 
 * Characteristics:
 * - Balanced HP, damage, and speed
 * - No special abilities
 * - Standard AI behavior
 */

import type { Vector2 } from '../../../types/game'
import { Monster } from './MonsterBase'
import type { MonsterConfigBase, MonsterRuntime } from './MonsterBase'

// =============================================================================
// STANDARD MONSTER CONFIG
// =============================================================================
export interface StandardMonsterConfig extends MonsterConfigBase {
  archetype: 'standard'
}

// =============================================================================
// STANDARD MONSTER CLASS
// =============================================================================
export class StandardMonster extends Monster {
  constructor(
    id: number,
    config: StandardMonsterConfig,
    spawnPosition: Vector2,
    healZones: Vector2[] = []
  ) {
    super(id, config, spawnPosition, healZones)
  }
  
  /**
   * Standard monsters have no special ability
   */
  public getSpecialAbility(): string | null {
    return null
  }
  
  /**
   * Standard monsters have no special ability
   */
  public useSpecialAbility(): boolean {
    return false
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
// STANDARD MONSTER FACTORY
// =============================================================================
export function createStandardMonster(
  id: number,
  config: StandardMonsterConfig,
  spawnPosition: Vector2,
  healZones: Vector2[] = []
): MonsterRuntime {
  return {
    id,
    archetype: 'standard',
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
    color: config.color
  }
}

// =============================================================================
// DEFAULT STANDARD MONSTER CONFIG
// =============================================================================
export const DEFAULT_STANDARD_MONSTER_CONFIG: StandardMonsterConfig = {
  archetype: 'standard',
  name: 'Standard Monster',
  maxHp: 800,
  baseDamage: 10,
  speed: 120,
  attackRange: 55,
  attackCooldown: 1.0,
  hpScale: 1.3,
  damageScale: 1.4,
  healThreshold: 0.2,
  healRate: 0.2,
  retreatSpeedBonus: 1.5,
  targetTimeout: 30,
  aggressiveness: 0.7,
  baseLevelTime: 30,
  levelTimeIncrement: 10,
  size: 1.0,
  color: '#ef4444'
}
