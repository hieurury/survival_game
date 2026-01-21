/**
 * Room System
 * Base class for shelter areas
 * Rooms only differ by size, doors and beds are the same for all rooms
 */

import type { Vector2 } from '../../../types/game'

// =============================================================================
// ROOM CONFIG
// =============================================================================
export interface RoomConfig {
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
  buildSlotCount: number
  // Door config (same for all rooms)
  baseDoorHp: number
  doorHpScale: number
  maxDoorLevel: number
  // Bed config (same for all rooms)
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

// Door upgrade functions are now in ../doors/Door.ts - single source of truth
// Bed upgrade functions are now in ../beds/Bed.ts - single source of truth

// =============================================================================
// DEFAULT ROOM CONFIG
// =============================================================================
export const DEFAULT_ROOM_CONFIG: RoomConfig = {
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
