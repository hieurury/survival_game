/**
 * Tank Monster Class
 * High HP, slow movement, damage reduction
 * 
 * Characteristics:
 * - Very high HP pool
 * - Slow movement speed
 * - Armor that reduces damage taken
 * - Lower damage output
 */

import type { Vector2 } from '../../../types/game'
import { Monster } from './MonsterBase'
import type { MonsterConfigBase, MonsterRuntime } from './MonsterBase'

// =============================================================================
// TANK MONSTER CONFIG
// =============================================================================
export interface TankMonsterConfig extends MonsterConfigBase {
  archetype: 'tank'
  /** Damage reduction percentage (0-1) */
  armorValue: number
  /** Armor scaling per level */
  armorScale: number
}

// =============================================================================
// TANK MONSTER CLASS
// =============================================================================
export class TankMonster extends Monster {
  public armorValue: number
  private baseArmor: number
  private armorScale: number
  
  constructor(
    id: number,
    config: TankMonsterConfig,
    spawnPosition: Vector2,
    healZones: Vector2[] = []
  ) {
    super(id, config, spawnPosition, healZones)
    
    this.armorValue = config.armorValue
    this.baseArmor = config.armorValue
    this.armorScale = config.armorScale
  }
  
  /**
   * Override damage calculation to apply armor
   */
  protected override calculateDamageReceived(amount: number): number {
    const reduction = amount * this.armorValue
    return Math.max(1, amount - reduction) // Always take at least 1 damage
  }
  
  /**
   * Override level up to scale armor
   */
  protected override onLevelUp(): void {
    this.armorValue = Math.min(0.75, this.baseArmor * Math.pow(this.armorScale, this.level - 1))
  }
  
  /**
   * Tank's special ability: Fortify
   * Temporarily increases armor
   */
  public getSpecialAbility(): string {
    return 'fortify'
  }
  
  /**
   * Use Fortify ability
   */
  public useSpecialAbility(): boolean {
    // Double armor for a short time
    this.armorValue = Math.min(0.9, this.armorValue * 2)
    
    // Reset after 5 seconds (would need timer implementation)
    setTimeout(() => {
      this.armorValue = this.baseArmor * Math.pow(this.armorScale, this.level - 1)
    }, 5000)
    
    return true
  }
  
  /**
   * Get current armor value
   */
  public getArmorValue(): number {
    return this.armorValue
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
      armorValue: this.armorValue
    }
  }
}

// =============================================================================
// TANK MONSTER RUNTIME (extended)
// =============================================================================
export interface TankMonsterRuntime extends MonsterRuntime {
  archetype: 'tank'
  armorValue: number
}

// =============================================================================
// TANK MONSTER FACTORY
// =============================================================================
export function createTankMonster(
  id: number,
  config: TankMonsterConfig,
  spawnPosition: Vector2,
  healZones: Vector2[] = []
): TankMonsterRuntime {
  return {
    id,
    archetype: 'tank',
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
    armorValue: config.armorValue
  }
}

// =============================================================================
// DEFAULT TANK MONSTER CONFIG
// =============================================================================
export const DEFAULT_TANK_MONSTER_CONFIG: TankMonsterConfig = {
  archetype: 'tank',
  name: 'Tank Monster',
  maxHp: 2000,
  baseDamage: 8,
  speed: 60, // Slow
  attackRange: 50,
  attackCooldown: 1.5,
  hpScale: 1.4,
  damageScale: 1.2,
  healThreshold: 0.15, // Retreats later due to armor
  healRate: 0.15, // Heals slower
  retreatSpeedBonus: 1.2,
  targetTimeout: 45, // More persistent
  aggressiveness: 0.9,
  baseLevelTime: 40,
  levelTimeIncrement: 15,
  size: 1.5, // Larger
  color: '#6b7280',
  armorValue: 0.3, // 30% damage reduction
  armorScale: 1.05
}
