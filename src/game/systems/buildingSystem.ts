/**
 * Building System
 * Handles building construction, upgrades, and effects
 */
import type { DefenseBuilding, Room, Player } from '../../types/game'
import { GAME_CONSTANTS } from '../../types/game'

// =============================================================================
// BUILDING TYPES - Match game.ts exactly
// =============================================================================
export type BuildingType = 'turret' | 'atm' | 'soul_collector' | 'vanguard'

// =============================================================================
// BUILDING CREATION
// =============================================================================
export function createBuilding(
  id: number,
  type: BuildingType,
  gridX: number,
  gridY: number,
  ownerId: number,
  level: number = 1
): DefenseBuilding {
  const stats = GAME_CONSTANTS.BUILDINGS[type]
  
  const building: DefenseBuilding = {
    id,
    type,
    gridX,
    gridY,
    hp: stats.hp,
    maxHp: stats.hp,
    level,
    ownerId,
    damage: stats.damage,
    baseDamage: stats.damage,
    range: stats.range,
    baseRange: stats.range,
    cooldown: stats.cooldown,
    currentCooldown: 0,
    rotation: 0,
    animationFrame: 0,
    upgradeCost: stats.upgradeCost,
  }
  
  // Add type-specific properties
  if (type === 'atm') {
    building.goldRate = GAME_CONSTANTS.ATM_GOLD_LEVELS[0] || 4
  } else if (type === 'soul_collector') {
    building.soulRate = GAME_CONSTANTS.SOUL_COLLECTOR_LEVELS[0] || 1
  }
  
  return building
}

// =============================================================================
// BUILDING COST
// =============================================================================
export function getBuildingCost(type: BuildingType): number {
  // Map type to COSTS key
  const costKey = type === 'soul_collector' ? 'soulCollector' : type
  return (GAME_CONSTANTS.COSTS as Record<string, number>)[costKey] || 50
}

export function getUpgradeCost(building: DefenseBuilding): number {
  const baseStats = GAME_CONSTANTS.BUILDINGS[building.type]
  // Cost doubles each level
  return Math.floor(baseStats.upgradeCost * Math.pow(2, building.level))
}

// =============================================================================
// BUILDING UPGRADE
// =============================================================================
export function upgradeBuilding(building: DefenseBuilding): DefenseBuilding {
  const newLevel = building.level + 1
  const baseStats = GAME_CONSTANTS.BUILDINGS[building.type]
  
  // Calculate new stats
  const newMaxHp = Math.floor(baseStats.hp * Math.pow(1.3, newLevel - 1))
  const newDamage = Math.floor(baseStats.damage * Math.pow(GAME_CONSTANTS.BUILDING_DAMAGE_SCALE, newLevel - 1))
  const newRange = Math.floor(baseStats.range * Math.pow(GAME_CONSTANTS.BUILDING_RANGE_SCALE, newLevel - 1))
  
  const upgraded: DefenseBuilding = {
    ...building,
    level: newLevel,
    maxHp: newMaxHp,
    hp: newMaxHp, // Full heal on upgrade
    damage: newDamage,
    range: newRange,
    upgradeCost: getUpgradeCost({ ...building, level: newLevel }),
  }
  
  // Update type-specific properties
  if (building.type === 'atm') {
    upgraded.goldRate = GAME_CONSTANTS.ATM_GOLD_LEVELS[Math.min(newLevel - 1, GAME_CONSTANTS.ATM_GOLD_LEVELS.length - 1)]
  } else if (building.type === 'soul_collector') {
    upgraded.soulRate = GAME_CONSTANTS.SOUL_COLLECTOR_LEVELS[Math.min(newLevel - 1, GAME_CONSTANTS.SOUL_COLLECTOR_LEVELS.length - 1)]
  }
  
  return upgraded
}

// =============================================================================
// BUILDING VALIDATION
// =============================================================================
export function canPlaceBuilding(
  gridX: number,
  gridY: number,
  buildings: DefenseBuilding[],
  obstacles: { gridX: number; gridY: number }[]
): boolean {
  // Check collision with existing buildings
  if (buildings.some(b => b.gridX === gridX && b.gridY === gridY)) {
    return false
  }
  
  // Check collision with obstacles
  if (obstacles.some(o => o.gridX === gridX && o.gridY === gridY)) {
    return false
  }
  
  return true
}

export function canAffordBuilding(player: Player, type: BuildingType): boolean {
  const cost = getBuildingCost(type)
  
  // ATM costs souls
  if (type === 'atm') {
    return player.souls >= cost
  }
  
  return player.gold >= cost
}

// =============================================================================
// BUILDING QUERY
// =============================================================================
export function findBuildingAt(
  buildings: DefenseBuilding[],
  gridX: number,
  gridY: number
): DefenseBuilding | undefined {
  return buildings.find(b => b.gridX === gridX && b.gridY === gridY)
}

export function findBuildingsByType(
  buildings: DefenseBuilding[],
  type: BuildingType
): DefenseBuilding[] {
  return buildings.filter(b => b.type === type)
}

export function findBuildingsByOwner(
  buildings: DefenseBuilding[],
  ownerId: number
): DefenseBuilding[] {
  return buildings.filter(b => b.ownerId === ownerId)
}

export function getTurrets(buildings: DefenseBuilding[]): DefenseBuilding[] {
  return buildings.filter(b => b.type === 'turret' && b.hp > 0)
}

export function getVanguardBuildings(buildings: DefenseBuilding[]): DefenseBuilding[] {
  return buildings.filter(b => b.type === 'vanguard' && b.hp > 0)
}

// =============================================================================
// BUILDING EFFECTS
// =============================================================================
export function applyBuildingDamage(building: DefenseBuilding, damage: number): boolean {
  building.hp -= damage
  return building.hp <= 0
}

export function repairBuilding(building: DefenseBuilding, amount: number): void {
  building.hp = Math.min(building.hp + amount, building.maxHp)
}

// =============================================================================
// ROOM-BASED BUILDING PLACEMENT
// =============================================================================
export function getRoomBuildSlots(room: Room): { gridX: number; gridY: number }[] {
  const slots: { gridX: number; gridY: number }[] = []
  
  // Use room grid position (gridX, gridY) instead of x, y
  for (let x = room.gridX + 1; x < room.gridX + room.width - 1; x++) {
    for (let y = room.gridY + 1; y < room.gridY + room.height - 1; y++) {
      slots.push({ gridX: x, gridY: y })
    }
  }
  
  return slots
}

export function getAvailableBuildSlots(
  room: Room,
  buildings: DefenseBuilding[],
  obstacles: { gridX: number; gridY: number }[]
): { gridX: number; gridY: number }[] {
  return getRoomBuildSlots(room).filter(slot => 
    canPlaceBuilding(slot.gridX, slot.gridY, buildings, obstacles)
  )
}

// =============================================================================
// RESOURCE GENERATION
// =============================================================================
export function calculateBuildingIncome(building: DefenseBuilding, deltaTime: number): { gold: number; souls: number } {
  let gold = 0
  let souls = 0
  
  if (building.hp <= 0) return { gold, souls }
  
  if (building.type === 'atm' && building.goldRate) {
    gold = building.goldRate * deltaTime
  } else if (building.type === 'soul_collector' && building.soulRate) {
    souls = building.soulRate * deltaTime
  }
  
  return { gold, souls }
}
