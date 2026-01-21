/**
 * ATM - Gold generating structure
 * 
 * ATMs passively generate gold for their owner over time.
 * Higher levels generate more gold per second.
 * 
 * Features:
 * - Passive gold generation
 * - Upgradeable gold rate
 * - Max level 6 with rates: [4, 8, 16, 32, 64, 128] gold/sec
 */

import { Structure, type StructureConfig, type StructureState } from './StructureBase'

// =============================================================================
// ATM CONFIG
// =============================================================================
export interface ATMConfig extends StructureConfig {
  type: 'atm'
  baseGoldRate: number
  goldRatePerLevel: number[] // Gold rate at each level [4, 8, 16, 32, 64, 128]
}

// =============================================================================
// ATM STATE
// =============================================================================
export interface ATMState extends StructureState {
  type: 'atm'
  goldRate: number
}

// =============================================================================
// DEFAULT ATM CONFIG
// Mua và nâng cấp bằng LINH HỒN (không dùng vàng)
// =============================================================================
export const DEFAULT_ATM_CONFIG: ATMConfig = {
  type: 'atm',
  hp: 50,
  baseCost: 200,           // 200 souls để mua
  costCurrency: 'souls',   // Chỉ dùng linh hồn
  upgradeCost: 250,        // 250 souls nâng cấp lần đầu
  upgradeCostScale: 2.0,   // Gấp đôi mỗi level: 250 -> 500 -> 1000...
  maxLevel: 6,
  baseGoldRate: 4,
  goldRatePerLevel: [4, 8, 16, 32, 64, 128],
}

// =============================================================================
// ATM CLASS
// =============================================================================
export class ATM extends Structure {
  // ATM-specific properties
  private goldRate: number
  private atmConfig: ATMConfig
  
  constructor(
    id: number,
    ownerId: number,
    gridX: number,
    gridY: number,
    config: ATMConfig = DEFAULT_ATM_CONFIG
  ) {
    super(id, 'atm', ownerId, gridX, gridY, config)
    this.atmConfig = config
    this.goldRate = config.goldRatePerLevel[0] || config.baseGoldRate
  }
  
  // ==========================================================================
  // Structure Abstract Implementations
  // ==========================================================================
  
  /**
   * Get current gold generation rate
   */
  getResourceRate(): number {
    return this.goldRate
  }
  
  /**
   * ATMs generate gold
   */
  getResourceType(): 'gold' | 'souls' {
    return 'gold'
  }
  
  /**
   * Called after upgrade - update gold rate
   */
  protected onUpgrade(): void {
    this.goldRate = this.atmConfig.goldRatePerLevel[this.level - 1] || this.goldRate * 2
  }
  
  // ==========================================================================
  // ATM-Specific Methods
  // ==========================================================================
  
  /**
   * Get gold rate at a specific level
   */
  getGoldRateAtLevel(level: number): number {
    if (level < 1 || level > this.atmConfig.maxLevel) {
      return 0
    }
    return this.atmConfig.goldRatePerLevel[level - 1] || 
           this.atmConfig.baseGoldRate * Math.pow(2, level - 1)
  }
  
  /**
   * Get current gold rate
   */
  getGoldRate(): number {
    return this.goldRate
  }
  
  /**
   * Set gold rate directly (for loading saved states)
   */
  setGoldRate(rate: number): void {
    this.goldRate = rate
  }
  
  // ==========================================================================
  // Serialization Override
  // ==========================================================================
  
  toJSON(): ATMState {
    return {
      ...super.toJSON(),
      type: 'atm',
      goldRate: this.goldRate
    }
  }
  
  fromJSON(data: Partial<ATMState>): void {
    super.fromJSON(data)
    if (data.goldRate !== undefined) this.goldRate = data.goldRate
  }
}

// =============================================================================
// FACTORY FUNCTION (for backward compatibility)
// =============================================================================
export interface ATMRuntime {
  id: number
  type: 'atm'
  level: number
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  ownerId: number
  animationFrame: number
  upgradeCost: number
  goldRate: number
  accumulatedResource: number
}

export const createATM = (
  id: number,
  ownerId: number,
  gridX: number,
  gridY: number,
  config: ATMConfig = DEFAULT_ATM_CONFIG
): ATMRuntime => {
  return {
    id,
    type: 'atm',
    level: 1,
    gridX,
    gridY,
    hp: config.hp,
    maxHp: config.hp,
    ownerId,
    animationFrame: 0,
    upgradeCost: config.upgradeCost,
    goldRate: config.goldRatePerLevel[0] || config.baseGoldRate,
    accumulatedResource: 0,
  }
}
