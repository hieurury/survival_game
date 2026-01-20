/**
 * Bot Player AI Module
 * 
 * A dedicated AI system for Bot Players, completely separate from Monster AI.
 * Uses a Hybrid FSM + Utility Scoring architecture for intelligent decision-making.
 * 
 * Bot priorities (High → Low):
 * 1. Door Defense (repair, upgrade)
 * 2. Turret Placement & Upgrade
 * 3. Bed Upgrade (economy scaling)
 * 4. Resource Structure Construction (Soul Collector, ATM)
 */

import type {
  Player,
  Monster,
  Room,
  DefenseBuilding,
  Vector2,
} from '../types/game'
import { GAME_CONSTANTS } from '../types/game'

// ============================================================================
// BOT AI STATES (FSM)
// ============================================================================

export type BotState = 
  | 'idle'
  | 'evaluate'
  | 'navigate_to_room'
  | 'navigate_to_bed'
  | 'repair_door'
  | 'upgrade_door'
  | 'build_turret'
  | 'upgrade_turret'
  | 'upgrade_bed'
  | 'build_soul_collector'
  | 'build_atm'
  | 'upgrade_atm'
  | 'sleep'

// ============================================================================
// UTILITY SCORING SYSTEM
// ============================================================================

export interface ActionScore {
  action: BotState
  score: number
  reason: string
}

export interface BotContext {
  player: Player
  room: Room | null
  monster: Monster
  buildings: DefenseBuilding[]
  myTurrets: DefenseBuilding[]
  myATMs: DefenseBuilding[]
  mySoulCollectors: DefenseBuilding[]
  isPlayerInRoom: boolean
  threatLevel: ThreatLevel
  emptyBuildSpot: Vector2 | null
}

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function distance(a: Vector2, b: Vector2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function gridToWorld(grid: { x: number; y: number }, cellSize: number): Vector2 {
  return {
    x: grid.x * cellSize + cellSize / 2,
    y: grid.y * cellSize + cellSize / 2,
  }
}

// ============================================================================
// THREAT ASSESSMENT
// ============================================================================

export function assessThreatLevel(
  player: Player,
  room: Room | null,
  monster: Monster
): ThreatLevel {
  if (!room || monster.hp <= 0) return 'none'
  
  const monsterTargetingMe = monster.targetPlayerId === player.id
  const doorHpPercent = room.doorHp / room.doorMaxHp
  
  // Critical: Monster targeting me AND door is very low
  if (monsterTargetingMe && doorHpPercent < 0.3) {
    return 'critical'
  }
  
  // High: Monster targeting me OR door is low
  if (monsterTargetingMe || doorHpPercent < 0.4) {
    return 'high'
  }
  
  // Medium: Monster alive and somewhat close to my room
  const roomCenter = { x: room.centerX, y: room.centerY }
  const distToRoom = distance(monster.position, roomCenter)
  if (distToRoom < GAME_CONSTANTS.CELL_SIZE * 10) {
    return 'medium'
  }
  
  // Low: Monster exists but not immediate threat
  if (monster.hp > 0) {
    return 'low'
  }
  
  return 'none'
}

// ============================================================================
// UTILITY SCORING FUNCTIONS
// ============================================================================

function scoreRepairDoor(ctx: BotContext): ActionScore {
  if (!ctx.room) return { action: 'repair_door', score: 0, reason: 'No room' }
  
  const { room } = ctx
  const doorHpPercent = room.doorHp / room.doorMaxHp
  
  // Cannot repair if: door is dead, already repairing, on cooldown
  if (room.doorHp <= 0 || room.doorIsRepairing || room.doorRepairCooldown > 0) {
    return { action: 'repair_door', score: 0, reason: 'Repair not available' }
  }
  
  // Base score from damage (more damage = higher score)
  let score = (1 - doorHpPercent) * 100
  
  // Threat multiplier
  if (ctx.threatLevel === 'critical') score *= 3
  else if (ctx.threatLevel === 'high') score *= 2
  else if (ctx.threatLevel === 'medium') score *= 1.5
  
  // Only repair if door is under 80% HP
  if (doorHpPercent >= 0.8) score = 0
  
  return { action: 'repair_door', score, reason: `Door at ${Math.floor(doorHpPercent * 100)}%` }
}

function scoreUpgradeDoor(ctx: BotContext): ActionScore {
  if (!ctx.room) return { action: 'upgrade_door', score: 0, reason: 'No room' }
  
  const { player, room } = ctx
  const canAffordGold = player.gold >= room.doorUpgradeCost
  const canAffordSouls = (room.doorSoulCost || 0) <= 0 || player.souls >= (room.doorSoulCost || 0)
  const doorHpPercent = room.doorHp / room.doorMaxHp
  
  if (!canAffordGold || !canAffordSouls || room.doorLevel >= 10) {
    return { action: 'upgrade_door', score: 0, reason: 'Cannot afford or max level' }
  }
  
  // Base score
  let score = 40
  
  // Higher score if door is damaged
  if (doorHpPercent < 0.6) score += 30
  
  // Threat multiplier
  if (ctx.threatLevel === 'critical') score *= 2.5
  else if (ctx.threatLevel === 'high') score *= 2
  else if (ctx.threatLevel === 'medium') score *= 1.5
  
  // Lower priority for door upgrade if door level is already high
  if (room.doorLevel >= 5) score *= 0.5
  
  return { action: 'upgrade_door', score, reason: `Door LV${room.doorLevel}` }
}

function scoreBuildTurret(ctx: BotContext): ActionScore {
  const { player, myTurrets, emptyBuildSpot } = ctx
  const canAfford = player.gold >= GAME_CONSTANTS.COSTS.turret
  const maxTurrets = 2
  
  if (!canAfford || myTurrets.length >= maxTurrets || !emptyBuildSpot) {
    return { action: 'build_turret', score: 0, reason: 'Cannot build turret' }
  }
  
  // Base score - turrets are essential defense
  let score = 60
  
  // First turret is highest priority
  if (myTurrets.length === 0) score += 40
  
  // Threat increases turret priority
  if (ctx.threatLevel === 'critical') score *= 1.5
  else if (ctx.threatLevel === 'high') score *= 1.3
  
  return { action: 'build_turret', score, reason: `Have ${myTurrets.length} turrets` }
}

function scoreUpgradeTurret(ctx: BotContext): ActionScore {
  const { player, myTurrets } = ctx
  
  const upgradableTurret = myTurrets.find(t => 
    t.level < 5 && player.gold >= t.upgradeCost
  )
  
  if (!upgradableTurret) {
    return { action: 'upgrade_turret', score: 0, reason: 'No turret to upgrade' }
  }
  
  // Base score
  let score = 35
  
  // Higher priority if we have multiple turrets (defense is stable)
  if (myTurrets.length >= 2) score += 15
  
  // Threat increases priority
  if (ctx.threatLevel === 'high' || ctx.threatLevel === 'critical') score *= 1.3
  
  return { action: 'upgrade_turret', score, reason: `Turret LV${upgradableTurret.level}` }
}

function scoreUpgradeBed(ctx: BotContext): ActionScore {
  if (!ctx.room) return { action: 'upgrade_bed', score: 0, reason: 'No room' }
  
  const { player, room, myTurrets } = ctx
  const canAffordGold = player.gold >= room.bedUpgradeCost
  const canAffordSouls = (room.bedSoulCost || 0) <= 0 || player.souls >= (room.bedSoulCost || 0)
  
  if (!canAffordGold || !canAffordSouls) {
    return { action: 'upgrade_bed', score: 0, reason: 'Cannot afford bed upgrade' }
  }
  
  // Base score - economy is important for long-term
  let score = 25
  
  // Only upgrade bed if we have basic defense
  if (myTurrets.length === 0) score *= 0.2
  else if (myTurrets.length === 1 && room.doorLevel < 2) score *= 0.5
  
  // Reduce priority during high threat
  if (ctx.threatLevel === 'critical') score *= 0.2
  else if (ctx.threatLevel === 'high') score *= 0.5
  
  // Increase priority if threat is low (economic phase)
  if (ctx.threatLevel === 'low' || ctx.threatLevel === 'none') score *= 1.5
  
  return { action: 'upgrade_bed', score, reason: `Bed LV${room.bedLevel}` }
}

function scoreBuildSoulCollector(ctx: BotContext): ActionScore {
  const { player, mySoulCollectors, myTurrets, room, emptyBuildSpot } = ctx
  const canAfford = player.gold >= GAME_CONSTANTS.COSTS.soul_collector
  
  if (!canAfford || mySoulCollectors.length >= 1 || !emptyBuildSpot || !room) {
    return { action: 'build_soul_collector', score: 0, reason: 'Cannot build soul collector' }
  }
  
  // Base score - soul collector enables ATM
  let score = 30
  
  // Require at least 1 turret before economic structures
  if (myTurrets.length === 0) score *= 0.1
  
  // Require door at level 2+
  if (room.doorLevel < 2) score *= 0.3
  
  // Lower priority during high threat
  if (ctx.threatLevel === 'critical') score *= 0.1
  else if (ctx.threatLevel === 'high') score *= 0.3
  
  return { action: 'build_soul_collector', score, reason: 'Need soul collector for ATM' }
}

function scoreBuildATM(ctx: BotContext): ActionScore {
  const { player, myATMs, mySoulCollectors, room, emptyBuildSpot } = ctx
  // ATM costs SOULS, not gold!
  const canAfford = player.souls >= GAME_CONSTANTS.SOUL_COSTS.atm
  
  if (!canAfford || myATMs.length >= 1 || !emptyBuildSpot || !room) {
    return { action: 'build_atm', score: 0, reason: 'Cannot build ATM' }
  }
  
  // Require soul collector first
  if (mySoulCollectors.length === 0) {
    return { action: 'build_atm', score: 0, reason: 'Need soul collector first' }
  }
  
  // Base score - ATM is great for income
  let score = 35
  
  // Lower priority during high threat
  if (ctx.threatLevel === 'critical') score *= 0.1
  else if (ctx.threatLevel === 'high') score *= 0.3
  
  return { action: 'build_atm', score, reason: 'Build ATM for income' }
}

function scoreUpgradeATM(ctx: BotContext): ActionScore {
  const { player, myATMs } = ctx
  
  const upgradableATM = myATMs.find(a => 
    a.level < 5 && player.gold >= a.upgradeCost
  )
  
  if (!upgradableATM) {
    return { action: 'upgrade_atm', score: 0, reason: 'No ATM to upgrade' }
  }
  
  // Base score
  let score = 20
  
  // Lower priority during high threat
  if (ctx.threatLevel === 'critical') score *= 0.1
  else if (ctx.threatLevel === 'high') score *= 0.3
  
  return { action: 'upgrade_atm', score, reason: `ATM LV${upgradableATM.level}` }
}

function scoreSleep(_ctx: BotContext): ActionScore {
  // Sleep is the default action when nothing else to do
  // Score is low so other actions take priority
  return { action: 'sleep', score: 10, reason: 'Default: go to sleep' }
}

// ============================================================================
// MAIN BOT AI DECISION SYSTEM
// ============================================================================

export function evaluateBotActions(ctx: BotContext): ActionScore[] {
  const scores: ActionScore[] = [
    scoreRepairDoor(ctx),
    scoreUpgradeDoor(ctx),
    scoreBuildTurret(ctx),
    scoreUpgradeTurret(ctx),
    scoreUpgradeBed(ctx),
    scoreBuildSoulCollector(ctx),
    scoreBuildATM(ctx),
    scoreUpgradeATM(ctx),
    scoreSleep(ctx),
  ]
  
  // Sort by score descending
  return scores.sort((a, b) => b.score - a.score)
}

export function getBestAction(ctx: BotContext): ActionScore {
  const scores = evaluateBotActions(ctx)
  return scores[0] ?? { action: 'sleep', score: 0, reason: 'No actions available' } // Return highest scoring action
}

// ============================================================================
// BOT AI CONTEXT BUILDER
// ============================================================================

export function buildBotContext(
  player: Player,
  rooms: Room[],
  monster: Monster,
  buildings: DefenseBuilding[],
  cellSize: number
): BotContext {
  const room = player.roomId !== null 
    ? rooms.find(r => r.id === player.roomId) || null 
    : null
  
  // Check if player is inside their room
  let isPlayerInRoom = false
  if (room) {
    const cellX = Math.floor(player.position.x / cellSize)
    const cellY = Math.floor(player.position.y / cellSize)
    isPlayerInRoom = cellX >= room.gridX && cellX < room.gridX + room.width &&
                     cellY >= room.gridY && cellY < room.gridY + room.height
  }
  
  // Get player's buildings
  const myBuildings = buildings.filter(b => b.ownerId === player.id && b.hp > 0)
  const myTurrets = myBuildings.filter(b => b.type === 'turret')
  const myATMs = myBuildings.filter(b => b.type === 'atm')
  const mySoulCollectors = myBuildings.filter(b => b.type === 'soul_collector')
  
  // Find empty build spot
  let emptyBuildSpot: Vector2 | null = null
  if (room) {
    emptyBuildSpot = room.buildSpots.find(spot => {
      return !buildings.some(b => {
        const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, cellSize)
        return distance(bPos, spot) < 30
      })
    }) || null
  }
  
  // Assess threat
  const threatLevel = assessThreatLevel(player, room, monster)
  
  return {
    player,
    room,
    monster,
    buildings,
    myTurrets,
    myATMs,
    mySoulCollectors,
    isPlayerInRoom,
    threatLevel,
    emptyBuildSpot,
  }
}

// ============================================================================
// ACTION EXECUTION HELPERS
// ============================================================================

export interface BotActionResult {
  success: boolean
  message: string
  floatingText?: { position: Vector2; text: string; color: string; size: number }
}

export function executeRepairDoor(room: Room): BotActionResult {
  if (room.doorRepairCooldown > 0 || room.doorIsRepairing || room.doorHp <= 0) {
    return { success: false, message: 'Cannot repair door' }
  }
  
  room.doorIsRepairing = true
  room.doorRepairTimer = 0
  
  return {
    success: true,
    message: 'Started repairing door',
    floatingText: { position: room.doorPosition, text: '🔧 Repairing...', color: '#fbbf24', size: 12 }
  }
}

export function executeUpgradeDoor(player: Player, room: Room): BotActionResult {
  const soulCost = room.doorSoulCost || 0
  if (player.gold < room.doorUpgradeCost || room.doorLevel >= 10) {
    return { success: false, message: 'Cannot upgrade door' }
  }
  if (soulCost > 0 && player.souls < soulCost) {
    return { success: false, message: 'Not enough souls' }
  }
  
  player.gold -= room.doorUpgradeCost
  if (soulCost > 0) player.souls -= soulCost
  
  room.doorLevel++
  room.doorMaxHp = Math.floor(room.doorMaxHp * 1.5)
  room.doorHp = room.doorMaxHp
  
  // Calculate next upgrade cost
  const nextLevel = room.doorLevel
  room.doorUpgradeCost = Math.floor(40 * Math.pow(2, nextLevel - 1)) // Base 40g, doubles each level
  room.doorSoulCost = nextLevel >= 4 ? Math.floor(215 * Math.pow(2, nextLevel - 4)) : 0 // 215 souls from level 5+
  
  return {
    success: true,
    message: `Door upgraded to level ${room.doorLevel}`,
    floatingText: { position: room.doorPosition, text: `Door LV${room.doorLevel}!`, color: '#60a5fa', size: 14 }
  }
}

export function executeBuildStructure(
  player: Player,
  buildings: DefenseBuilding[],
  type: DefenseBuilding['type'],
  spot: Vector2,
  cellSize: number
): BotActionResult {
  // ATM uses SOULS, others use GOLD
  if (type === 'atm') {
    const soulCost = GAME_CONSTANTS.SOUL_COSTS.atm
    if (player.souls < soulCost) return { success: false, message: 'Not enough souls' }
    player.souls -= soulCost
  } else {
    const cost = GAME_CONSTANTS.COSTS[type as keyof typeof GAME_CONSTANTS.COSTS] || 0
    if (player.gold < cost) return { success: false, message: 'Not enough gold' }
    player.gold -= cost
  }
  
  const stats = GAME_CONSTANTS.BUILDINGS[type]
  const newBuilding: DefenseBuilding = {
    id: buildings.length,
    type,
    level: 1,
    gridX: Math.floor(spot.x / cellSize),
    gridY: Math.floor(spot.y / cellSize),
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    baseDamage: stats.damage,
    range: stats.range,
    baseRange: stats.range,
    cooldown: stats.cooldown,
    currentCooldown: 0,
    ownerId: player.id,
    animationFrame: 0,
    rotation: 0,
    upgradeCost: stats.upgradeCost,
    goldRate: 'goldRate' in stats ? stats.goldRate : undefined,
    soulRate: 'soulRate' in stats ? stats.soulRate : undefined,
    // SMG specific fields
    burstCount: type === 'smg' ? GAME_CONSTANTS.SMG.BURST_COUNT : undefined,
    burstIndex: type === 'smg' ? 0 : undefined,
    burstCooldown: type === 'smg' ? 0 : undefined,
    soulCost: 0,
  }
  buildings.push(newBuilding)
  
  // Icon based on building type
  const icons: Record<string, string> = {
    turret: '🔫',
    atm: '🏧',
    soul_collector: '👻',
    vanguard: '⚔️',
    smg: '🔥'
  }
  const icon = icons[type] || '🏗️'
  
  return {
    success: true,
    message: `Built ${type}`,
    floatingText: { position: spot, text: `${icon} Built!`, color: '#22c55e', size: 12 }
  }
}

export function executeUpgradeTurret(
  player: Player,
  turret: DefenseBuilding,
  getBuildingDamage: (base: number, level: number) => number,
  getBuildingRange: (base: number, level: number) => number,
  cellSize: number
): BotActionResult {
  if (player.gold < turret.upgradeCost || turret.level >= 10) {
    return { success: false, message: 'Cannot upgrade turret' }
  }
  
  // Level 4+ requires souls
  if (turret.level >= 4) {
    const soulCost = GAME_CONSTANTS.SOUL_UPGRADE_COST * (turret.level - 3)
    if (player.souls < soulCost) {
      return { success: false, message: 'Not enough souls for upgrade' }
    }
    player.souls -= soulCost
  }
  
  player.gold -= turret.upgradeCost
  turret.level++
  turret.damage = getBuildingDamage(turret.baseDamage, turret.level)
  turret.range = getBuildingRange(turret.baseRange, turret.level)
  turret.upgradeCost *= 2
  
  const pos = gridToWorld({ x: turret.gridX, y: turret.gridY }, cellSize)
  return {
    success: true,
    message: `Turret upgraded to level ${turret.level}`,
    floatingText: { position: pos, text: `LV${turret.level}!`, color: '#60a5fa', size: 12 }
  }
}

export function executeUpgradeATM(
  player: Player,
  atm: DefenseBuilding,
  cellSize: number
): BotActionResult {
  if (player.gold < atm.upgradeCost || atm.level >= 10) {
    return { success: false, message: 'Cannot upgrade ATM' }
  }
  
  // Level 4+ requires souls
  if (atm.level >= 4) {
    const soulCost = GAME_CONSTANTS.SOUL_UPGRADE_COST * (atm.level - 3)
    if (player.souls < soulCost) {
      return { success: false, message: 'Not enough souls for upgrade' }
    }
    player.souls -= soulCost
  }
  
  player.gold -= atm.upgradeCost
  atm.level++
  atm.goldRate = GAME_CONSTANTS.ATM_GOLD_LEVELS[Math.min(atm.level - 1, 5)] || atm.level * 4
  atm.upgradeCost *= 2
  
  const pos = gridToWorld({ x: atm.gridX, y: atm.gridY }, cellSize)
  return {
    success: true,
    message: `ATM upgraded to level ${atm.level}`,
    floatingText: { position: pos, text: `ATM LV${atm.level}!`, color: '#22c55e', size: 12 }
  }
}

export function executeUpgradeBed(player: Player, room: Room): BotActionResult {
  const soulCost = room.bedSoulCost || 0
  if (player.gold < room.bedUpgradeCost) {
    return { success: false, message: 'Cannot afford bed upgrade' }
  }
  if (soulCost > 0 && player.souls < soulCost) {
    return { success: false, message: 'Not enough souls' }
  }
  
  player.gold -= room.bedUpgradeCost
  if (soulCost > 0) player.souls -= soulCost
  
  room.bedLevel++
  room.bedIncome *= 2
  
  // Calculate next upgrade cost
  const nextLevel = room.bedLevel
  room.bedUpgradeCost = Math.floor(25 * Math.pow(2, nextLevel - 1)) // Base 25g, doubles each level
  room.bedSoulCost = nextLevel >= 4 ? Math.floor(200 * Math.pow(2, nextLevel - 4)) : 0 // 200 souls from level 5+
  
  return {
    success: true,
    message: `Bed upgraded to level ${room.bedLevel}`,
    floatingText: { position: room.bedPosition, text: `Bed LV${room.bedLevel}!`, color: '#fbbf24', size: 14 }
  }
}

// ============================================================================
// EXPORT BOT AI MODULE
// ============================================================================

export const BotAI = {
  // Context
  buildContext: buildBotContext,
  assessThreat: assessThreatLevel,
  
  // Decision
  evaluateActions: evaluateBotActions,
  getBestAction,
  
  // Execution
  executeRepairDoor,
  executeUpgradeDoor,
  executeBuildStructure,
  executeUpgradeTurret,
  executeUpgradeATM,
  executeUpgradeBed,
}

export default BotAI
