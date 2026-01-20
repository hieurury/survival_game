/**
 * Structure System
 * Base class for resource-generating buildings (ATM, Soul Collector)
 */

import type { IUpgradeable } from '../base/Entity'

// =============================================================================
// STRUCTURE TYPE
// =============================================================================
export type StructureType = 'atm' | 'soul_collector'

// =============================================================================
// STRUCTURE CONFIG
// =============================================================================
export interface StructureConfig {
  type: StructureType
  hp: number
  baseCost: number
  costCurrency: 'gold' | 'souls'
  upgradeCost: number
  upgradeCostScale: number
  maxLevel: number
}

// =============================================================================
// ATM CONFIG
// =============================================================================
export interface ATMConfig extends StructureConfig {
  type: 'atm'
  baseGoldRate: number
  goldRatePerLevel: number[] // Gold rate at each level [4, 8, 16, 32, 64, 128]
}

// =============================================================================
// SOUL COLLECTOR CONFIG
// =============================================================================
export interface SoulCollectorConfig extends StructureConfig {
  type: 'soul_collector'
  baseSoulRate: number
  soulRatePerLevel: number[] // Soul rate at each level [1, 2, 4, 8, 16, 32]
}

// =============================================================================
// STRUCTURE INTERFACE
// =============================================================================
export interface IStructure extends IUpgradeable {
  id: number
  type: StructureType
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  ownerId: number
  animationFrame: number
}

// =============================================================================
// STRUCTURE RUNTIME STATE
// =============================================================================
export interface StructureRuntime {
  id: number
  type: StructureType
  level: number
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  ownerId: number
  animationFrame: number
  upgradeCost: number
  // Resource generation
  goldRate?: number // For ATM
  soulRate?: number // For Soul Collector
  // Accumulated resources (for fractional rates)
  accumulatedResource: number
}

// =============================================================================
// ATM FACTORY
// =============================================================================
export const createATM = (
  id: number,
  ownerId: number,
  gridX: number,
  gridY: number,
  config: ATMConfig
): StructureRuntime => {
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

// =============================================================================
// SOUL COLLECTOR FACTORY
// =============================================================================
export const createSoulCollector = (
  id: number,
  ownerId: number,
  gridX: number,
  gridY: number,
  config: SoulCollectorConfig
): StructureRuntime => {
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

// =============================================================================
// STRUCTURE UPGRADE
// =============================================================================
export const upgradeStructure = (
  structure: StructureRuntime,
  config: ATMConfig | SoulCollectorConfig
): boolean => {
  if (structure.level >= config.maxLevel) return false
  
  structure.level++
  structure.upgradeCost = Math.floor(config.upgradeCost * Math.pow(config.upgradeCostScale, structure.level - 1))
  
  if (structure.type === 'atm' && 'goldRatePerLevel' in config) {
    structure.goldRate = config.goldRatePerLevel[structure.level - 1] || structure.goldRate! * 2
  } else if (structure.type === 'soul_collector' && 'soulRatePerLevel' in config) {
    structure.soulRate = config.soulRatePerLevel[structure.level - 1] || structure.soulRate! * 2
  }
  
  return true
}

// =============================================================================
// DEFAULT CONFIGS
// =============================================================================
export const DEFAULT_ATM_CONFIG: ATMConfig = {
  type: 'atm',
  hp: 50,
  baseCost: 200,
  costCurrency: 'souls',
  upgradeCost: 100,
  upgradeCostScale: 2.0,
  maxLevel: 6,
  baseGoldRate: 4,
  goldRatePerLevel: [4, 8, 16, 32, 64, 128],
}

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
