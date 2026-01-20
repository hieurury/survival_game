/**
 * Door System
 * Defensive entry points for rooms
 * Only one door type - basic door
 */

import type { Vector2 } from '../../../types/game'
import type { IDamageable, IUpgradeable } from '../base/Entity'

// =============================================================================
// DOOR CONFIG
// =============================================================================
export interface DoorConfig {
  baseHp: number
  hpScale: number // HP multiplier per level
  maxLevel: number
  baseUpgradeCost: number
  upgradeCostScale: number
  soulRequiredLevel: number // Level at which souls are required
  soulCost: number // Soul cost starting at soulRequiredLevel
  repairDuration: number // Seconds to repair
  repairCooldown: number // Cooldown between repairs
  repairPercent: number // Percent of max HP restored
}

// =============================================================================
// DOOR INTERFACE
// =============================================================================
export interface IDoor extends IDamageable, IUpgradeable {
  position: Vector2
  gridX: number
  gridY: number
  roomId: number
  isRepairing: boolean
  repairTimer: number
  repairCooldown: number
}

// =============================================================================
// DOOR RUNTIME STATE
// =============================================================================
export interface DoorRuntime {
  hp: number
  maxHp: number
  level: number
  position: Vector2
  gridX: number
  gridY: number
  roomId: number
  upgradeCost: number
  soulCost: number // Soul cost for current upgrade (0 if below soulRequiredLevel)
  isRepairing: boolean
  repairTimer: number
  repairCooldown: number
}

// =============================================================================
// DOOR FACTORY
// =============================================================================
export const createDoor = (
  roomId: number,
  gridX: number,
  gridY: number,
  cellSize: number,
  config: DoorConfig
): DoorRuntime => {
  return {
    hp: config.baseHp,
    maxHp: config.baseHp,
    level: 1,
    position: {
      x: (gridX + 0.5) * cellSize,
      y: (gridY + 0.5) * cellSize,
    },
    gridX,
    gridY,
    roomId,
    upgradeCost: config.baseUpgradeCost,
    soulCost: 0,
    isRepairing: false,
    repairTimer: 0,
    repairCooldown: 0,
  }
}

// =============================================================================
// DOOR UPGRADE COST CALCULATION
// =============================================================================
export const calculateDoorUpgradeCost = (level: number, config: DoorConfig): { gold: number; souls: number } => {
  const nextLevel = level + 1
  const gold = Math.floor(config.baseUpgradeCost * Math.pow(config.upgradeCostScale, level - 1))
  const souls = nextLevel >= config.soulRequiredLevel ? config.soulCost * Math.pow(2, nextLevel - config.soulRequiredLevel) : 0
  return { gold, souls: Math.floor(souls) }
}

// =============================================================================
// DOOR UPGRADE
// =============================================================================
export const upgradeDoor = (door: DoorRuntime, config: DoorConfig): boolean => {
  if (door.level >= config.maxLevel) return false
  
  door.level++
  door.maxHp = Math.floor(config.baseHp * Math.pow(config.hpScale, door.level - 1))
  door.hp = door.maxHp // Full heal on upgrade
  
  // Calculate next upgrade cost
  const nextCost = calculateDoorUpgradeCost(door.level, config)
  door.upgradeCost = nextCost.gold
  door.soulCost = nextCost.souls
  
  return true
}

// =============================================================================
// DOOR REPAIR
// =============================================================================
export const startDoorRepair = (door: DoorRuntime, _config: DoorConfig): boolean => {
  if (door.isRepairing || door.repairCooldown > 0 || door.hp <= 0) return false
  if (door.hp >= door.maxHp) return false
  
  door.isRepairing = true
  door.repairTimer = 0
  return true
}

export const updateDoorRepair = (door: DoorRuntime, config: DoorConfig, deltaTime: number): boolean => {
  if (!door.isRepairing) return false
  
  door.repairTimer += deltaTime
  const healPerSecond = (door.maxHp * config.repairPercent) / config.repairDuration
  door.hp = Math.min(door.maxHp, door.hp + healPerSecond * deltaTime)
  
  if (door.repairTimer >= config.repairDuration) {
    door.isRepairing = false
    door.repairTimer = 0
    door.repairCooldown = config.repairCooldown
    return true // Repair complete
  }
  
  return false
}
