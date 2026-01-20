/**
 * SoulCollector - Soul generating structure
 * 
 * Soul Collectors passively generate souls for their owner over time.
 * Higher levels generate more souls per second.
 * 
 * Features:
 * - Passive soul generation
 * - Upgradeable soul rate
 * - Max level 6 with rates: [1, 2, 4, 8, 16, 32] souls/sec
 */

import { Structure, type StructureConfig, type StructureState } from './StructureBase'

// =============================================================================
// SOUL COLLECTOR CONFIG
// =============================================================================
export interface SoulCollectorConfig extends StructureConfig {
  type: 'soul_collector'
  baseSoulRate: number
  soulRatePerLevel: number[] // Soul rate at each level [1, 2, 4, 8, 16, 32]
}

// =============================================================================
// SOUL COLLECTOR STATE
// =============================================================================
export interface SoulCollectorState extends StructureState {
  type: 'soul_collector'
  soulRate: number
}

// =============================================================================
// DEFAULT SOUL COLLECTOR CONFIG
// =============================================================================
export const DEFAULT_SOUL_COLLECTOR_CONFIG: SoulCollectorConfig = {
  type: 'soul_collector',
  hp: 50,
  baseCost: 440,
  costCurrency: 'gold',
  upgradeCost: 440,
  upgradeCostScale: 2.0,
  maxLevel: 6,
  baseSoulRate: 1,
  soulRatePerLevel: [1, 2, 4, 8, 16, 32],
}

// =============================================================================
// SOUL COLLECTOR CLASS
// =============================================================================
export class SoulCollector extends Structure {
  // SoulCollector-specific properties
  private soulRate: number
  private soulCollectorConfig: SoulCollectorConfig
  
  constructor(
    id: number,
    ownerId: number,
    gridX: number,
    gridY: number,
    config: SoulCollectorConfig = DEFAULT_SOUL_COLLECTOR_CONFIG
  ) {
    super(id, 'soul_collector', ownerId, gridX, gridY, config)
    this.soulCollectorConfig = config
    this.soulRate = config.soulRatePerLevel[0] || config.baseSoulRate
  }
  
  // ==========================================================================
  // Structure Abstract Implementations
  // ==========================================================================
  
  /**
   * Get current soul generation rate
   */
  getResourceRate(): number {
    return this.soulRate
  }
  
  /**
   * Soul Collectors generate souls
   */
  getResourceType(): 'gold' | 'souls' {
    return 'souls'
  }
  
  /**
   * Called after upgrade - update soul rate
   */
  protected onUpgrade(): void {
    this.soulRate = this.soulCollectorConfig.soulRatePerLevel[this.level - 1] || this.soulRate * 2
  }
  
  // ==========================================================================
  // SoulCollector-Specific Methods
  // ==========================================================================
  
  /**
   * Get soul rate at a specific level
   */
  getSoulRateAtLevel(level: number): number {
    if (level < 1 || level > this.soulCollectorConfig.maxLevel) {
      return 0
    }
    return this.soulCollectorConfig.soulRatePerLevel[level - 1] || 
           this.soulCollectorConfig.baseSoulRate * Math.pow(2, level - 1)
  }
  
  /**
   * Get current soul rate
   */
  getSoulRate(): number {
    return this.soulRate
  }
  
  /**
   * Set soul rate directly (for loading saved states)
   */
  setSoulRate(rate: number): void {
    this.soulRate = rate
  }
  
  // ==========================================================================
  // Serialization Override
  // ==========================================================================
  
  toJSON(): SoulCollectorState {
    return {
      ...super.toJSON(),
      type: 'soul_collector',
      soulRate: this.soulRate
    }
  }
  
  fromJSON(data: Partial<SoulCollectorState>): void {
    super.fromJSON(data)
    if (data.soulRate !== undefined) this.soulRate = data.soulRate
  }
}

// =============================================================================
// FACTORY FUNCTION (for backward compatibility)
// =============================================================================
export interface SoulCollectorRuntime {
  id: number
  type: 'soul_collector'
  level: number
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  ownerId: number
  animationFrame: number
  upgradeCost: number
  soulRate: number
  accumulatedResource: number
}

export const createSoulCollector = (
  id: number,
  ownerId: number,
  gridX: number,
  gridY: number,
  config: SoulCollectorConfig = DEFAULT_SOUL_COLLECTOR_CONFIG
): SoulCollectorRuntime => {
  return {
    id,
    type: 'soul_collector',
    level: 1,
    gridX,
    gridY,
    hp: config.hp,
    maxHp: config.hp,
    ownerId,
    animationFrame: 0,
    upgradeCost: config.upgradeCost,
    soulRate: config.soulRatePerLevel[0] || config.baseSoulRate,
    accumulatedResource: 0,
  }
}
