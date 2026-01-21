/**
 * Bed System
 * Sleeping and income-generating objects
 * Only one bed type - basic bed
 */

import type { Vector2 } from '../../../types/game'
import type { IUpgradeable } from '../base/Entity'

// =============================================================================
// BED CONFIG
// =============================================================================
export interface BedConfig {
  baseIncome: number // Gold per second at level 1
  incomeScale: number // Income multiplier per level (usually 2.0 = doubling)
  maxLevel: number
  baseUpgradeCost: number
  upgradeCostScale: number
  interactRange: number // Range to interact with bed
  soulRequiredLevel: number // Level at which souls are required
  soulCost: number // Soul cost starting at soulRequiredLevel
}

// =============================================================================
// BED INTERFACE
// =============================================================================
export interface IBed extends IUpgradeable {
  position: Vector2
  roomId: number
  income: number
  isOccupied: boolean
  occupantId: number | null
}

// =============================================================================
// BED RUNTIME STATE
// =============================================================================
export interface BedRuntime {
  level: number
  position: Vector2
  roomId: number
  income: number
  upgradeCost: number
  soulCost: number // Soul cost for current upgrade (0 if below soulRequiredLevel)
  isOccupied: boolean
  occupantId: number | null
  // For tracking fractional gold
  accumulatedGold: number
}

// =============================================================================
// BED FACTORY
// =============================================================================
export const createBed = (
  roomId: number,
  position: Vector2,
  config: BedConfig
): BedRuntime => {
  return {
    level: 1,
    position: { ...position },
    roomId,
    income: config.baseIncome,
    upgradeCost: config.baseUpgradeCost,
    soulCost: 0,
    isOccupied: false,
    occupantId: null,
    accumulatedGold: 0,
  }
}

// =============================================================================
// BED UPGRADE COST CALCULATION
// =============================================================================
export const calculateBedUpgradeCost = (level: number, config: BedConfig): { gold: number; souls: number } => {
  const nextLevel = level + 1
  const gold = Math.floor(config.baseUpgradeCost * Math.pow(config.upgradeCostScale, level - 1))
  const souls = nextLevel >= config.soulRequiredLevel ? config.soulCost * Math.pow(2, nextLevel - config.soulRequiredLevel) : 0
  return { gold, souls: Math.floor(souls) }
}

// =============================================================================
// BED UPGRADE
// =============================================================================
export const upgradeBed = (bed: BedRuntime, config: BedConfig): boolean => {
  if (bed.level >= config.maxLevel) return false
  
  bed.level++
  bed.income = Math.floor(config.baseIncome * Math.pow(config.incomeScale, bed.level - 1))
  
  // Calculate next upgrade cost
  const nextCost = calculateBedUpgradeCost(bed.level, config)
  bed.upgradeCost = nextCost.gold
  bed.soulCost = nextCost.souls
  
  return true
}

// =============================================================================
// BED INCOME GENERATION
// =============================================================================
export const generateBedIncome = (bed: BedRuntime, deltaTime: number): number => {
  if (!bed.isOccupied) return 0
  
  bed.accumulatedGold += bed.income * deltaTime
  const goldToGive = Math.floor(bed.accumulatedGold)
  bed.accumulatedGold -= goldToGive
  
  return goldToGive
}

// =============================================================================
// BED OCCUPY/LEAVE
// =============================================================================
export const occupyBed = (bed: BedRuntime, playerId: number): boolean => {
  if (bed.isOccupied) return false
  
  bed.isOccupied = true
  bed.occupantId = playerId
  return true
}

export const leaveBed = (bed: BedRuntime): boolean => {
  if (!bed.isOccupied) return false
  
  bed.isOccupied = false
  bed.occupantId = null
  return true
}

// =============================================================================
// DEFAULT BED CONFIG
// =============================================================================
export const DEFAULT_BED_CONFIG: BedConfig = {
  baseIncome: 1,
  incomeScale: 2.0, // Doubling per level
  maxLevel: 10,
  baseUpgradeCost: 25,
  upgradeCostScale: 2.0,
  interactRange: 60,
  soulRequiredLevel: 5,
  soulCost: 25, // 25 linh hồn từ level 5
}
