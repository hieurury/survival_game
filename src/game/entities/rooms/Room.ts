/**
 * Room System
 * Base class for shelter areas
 */

import type { Vector2 } from '../../../types/game'

// =============================================================================
// ROOM TYPE
// =============================================================================
export type RoomType = 'standard' | 'large' | 'l_shape' | 'bunker' | 'armory' | 'storage'

// =============================================================================
// ROOM CONFIG
// =============================================================================
export interface RoomConfig {
  type: RoomType
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
  buildSlotCount: number
  // Door config
  baseDoorHp: number
  doorHpScale: number
  maxDoorLevel: number
  // Bed config
  bedBaseIncome: number
  bedIncomeScale: number
  maxBedLevel: number
}

// =============================================================================
// ROOM LAYOUT
// =============================================================================
export interface RoomLayout {
  width: number
  height: number
  buildSpots: Vector2[] // Relative positions within room
  bedPosition: Vector2 // Relative position within room
  doorSide: 'top' | 'bottom' | 'left' | 'right'
}

// =============================================================================
// ROOM RUNTIME STATE
// =============================================================================
export interface RoomRuntime {
  id: number
  type: RoomType
  // Grid position
  gridX: number
  gridY: number
  width: number
  height: number
  // World position
  centerX: number
  centerY: number
  // Ownership
  ownerId: number | null
  // Door
  doorHp: number
  doorMaxHp: number
  doorLevel: number
  doorUpgradeCost: number
  doorSoulCost: number // Soul cost for door upgrade (0 if below soulRequiredLevel)
  doorRepairCooldown: number
  doorIsRepairing: boolean
  doorRepairTimer: number
  doorPosition: Vector2
  doorGridX: number
  doorGridY: number
  // Bed
  bedPosition: Vector2
  bedLevel: number
  bedUpgradeCost: number
  bedSoulCost: number // Soul cost for bed upgrade (0 if below soulRequiredLevel)
  bedIncome: number
  // Build spots
  buildSpots: Vector2[]
}

// =============================================================================
// ROOM FACTORY
// =============================================================================
export const createRoom = (
  id: number,
  gridX: number,
  gridY: number,
  layout: RoomLayout,
  config: RoomConfig,
  cellSize: number
): RoomRuntime => {
  const centerX = (gridX + layout.width / 2) * cellSize
  const centerY = (gridY + layout.height / 2) * cellSize
  
  // Calculate door position based on side
  let doorGridX = gridX
  let doorGridY = gridY
  switch (layout.doorSide) {
    case 'top':
      doorGridX = gridX + Math.floor(layout.width / 2)
      doorGridY = gridY
      break
    case 'bottom':
      doorGridX = gridX + Math.floor(layout.width / 2)
      doorGridY = gridY + layout.height - 1
      break
    case 'left':
      doorGridX = gridX
      doorGridY = gridY + Math.floor(layout.height / 2)
      break
    case 'right':
      doorGridX = gridX + layout.width - 1
      doorGridY = gridY + Math.floor(layout.height / 2)
      break
  }
  
  const doorPosition = {
    x: (doorGridX + 0.5) * cellSize,
    y: (doorGridY + 0.5) * cellSize,
  }
  
  // Convert relative build spots to absolute world positions
  const absoluteBuildSpots = layout.buildSpots.map(spot => ({
    x: (gridX + spot.x) * cellSize + cellSize / 2,
    y: (gridY + spot.y) * cellSize + cellSize / 2,
  }))
  
  const absoluteBedPosition = {
    x: (gridX + layout.bedPosition.x) * cellSize + cellSize / 2,
    y: (gridY + layout.bedPosition.y) * cellSize + cellSize / 2,
  }
  
  return {
    id,
    type: config.type,
    gridX,
    gridY,
    width: layout.width,
    height: layout.height,
    centerX,
    centerY,
    ownerId: null,
    doorHp: config.baseDoorHp,
    doorMaxHp: config.baseDoorHp,
    doorLevel: 1,
    doorUpgradeCost: 40, // Base upgrade cost (gold)
    doorSoulCost: 0, // No soul cost at level 1
    doorRepairCooldown: 0,
    doorIsRepairing: false,
    doorRepairTimer: 0,
    doorPosition,
    doorGridX,
    doorGridY,
    bedPosition: absoluteBedPosition,
    bedLevel: 1,
    bedUpgradeCost: 25, // Base upgrade cost (gold)
    bedSoulCost: 0, // No soul cost at level 1
    bedIncome: config.bedBaseIncome,
    buildSpots: absoluteBuildSpots,
  }
}

// =============================================================================
// ROOM DOOR UPGRADE - Calculate costs
// =============================================================================
export const calculateDoorUpgradeCost = (level: number): { gold: number; souls: number } => {
  // Import from balance - these are fixed constants
  const baseUpgradeCost = 40
  const upgradeCostScale = 2
  const soulRequiredLevel = 5
  const soulCost = 215
  
  const nextLevel = level + 1
  const gold = Math.floor(baseUpgradeCost * Math.pow(upgradeCostScale, level - 1))
  const souls = nextLevel >= soulRequiredLevel ? soulCost * Math.pow(2, nextLevel - soulRequiredLevel) : 0
  return { gold, souls: Math.floor(souls) }
}

export const upgradeDoor = (room: RoomRuntime, config: RoomConfig): boolean => {
  if (room.doorLevel >= config.maxDoorLevel) return false
  
  room.doorLevel++
  room.doorMaxHp = Math.floor(config.baseDoorHp * Math.pow(config.doorHpScale, room.doorLevel - 1))
  room.doorHp = room.doorMaxHp // Full heal on upgrade
  
  // Calculate next level costs
  const nextCost = calculateDoorUpgradeCost(room.doorLevel)
  room.doorUpgradeCost = nextCost.gold
  room.doorSoulCost = nextCost.souls
  
  return true
}

// =============================================================================
// ROOM BED UPGRADE - Calculate costs
// =============================================================================
export const calculateBedUpgradeCost = (level: number): { gold: number; souls: number } => {
  // Import from balance - these are fixed constants
  const baseUpgradeCost = 25
  const upgradeCostScale = 2
  const soulRequiredLevel = 5
  const soulCost = 200
  
  const nextLevel = level + 1
  const gold = Math.floor(baseUpgradeCost * Math.pow(upgradeCostScale, level - 1))
  const souls = nextLevel >= soulRequiredLevel ? soulCost * Math.pow(2, nextLevel - soulRequiredLevel) : 0
  return { gold, souls: Math.floor(souls) }
}

export const upgradeBed = (room: RoomRuntime, config: RoomConfig): boolean => {
  if (room.bedLevel >= config.maxBedLevel) return false
  
  room.bedLevel++
  room.bedIncome = Math.floor(config.bedBaseIncome * Math.pow(config.bedIncomeScale, room.bedLevel - 1))
  
  // Calculate next level costs
  const nextCost = calculateBedUpgradeCost(room.bedLevel)
  room.bedUpgradeCost = nextCost.gold
  room.bedSoulCost = nextCost.souls
  
  return true
}

// =============================================================================
// DEFAULT ROOM CONFIG
// =============================================================================
export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  type: 'standard',
  minWidth: 8,
  maxWidth: 10,
  minHeight: 8,
  maxHeight: 10,
  buildSlotCount: 4,
  baseDoorHp: 400, // From DOOR_BALANCE.BASE_HP
  doorHpScale: 1.5, // From DOOR_BALANCE.HP_SCALE
  maxDoorLevel: 10,
  bedBaseIncome: 1, // From BED_BALANCE.BASE_INCOME
  bedIncomeScale: 2.0, // From BED_BALANCE.INCOME_SCALE
  maxBedLevel: 10,
}

// =============================================================================
// ROOM TYPE PRESETS
// =============================================================================
export const ROOM_TYPE_CONFIGS: Record<RoomType, Partial<RoomConfig>> = {
  standard: {},
  large: {
    minWidth: 10,
    maxWidth: 12,
    minHeight: 10,
    maxHeight: 12,
    buildSlotCount: 6,
  },
  l_shape: {
    minWidth: 10,
    maxWidth: 12,
    minHeight: 10,
    maxHeight: 12,
    buildSlotCount: 5,
  },
  bunker: {
    baseDoorHp: 600,
    doorHpScale: 1.6,
    buildSlotCount: 3,
  },
  armory: {
    buildSlotCount: 6,
  },
  storage: {
    bedIncomeScale: 2.5,
    buildSlotCount: 2,
  },
}
