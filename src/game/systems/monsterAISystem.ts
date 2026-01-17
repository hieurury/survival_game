/**
 * Monster AI System
 * Handles monster pathfinding and behavior
 */
import type { Monster, Player, DefenseBuilding, VanguardUnit, Vector2, GridCell } from '../../types/game'
import { GAME_CONSTANTS } from '../../types/game'
import { 
  distance, 
  gridToWorld, 
  findPath, 
  moveTowards
} from '../../composables/usePathfinding'

// =============================================================================
// RANDOM UTILITY
// =============================================================================
export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// =============================================================================
// MONSTER SCALING
// =============================================================================
export function getScaledMonsterHp(baseHp: number, level: number): number {
  return Math.floor(baseHp * Math.pow(GAME_CONSTANTS.MONSTER_HP_SCALE, level - 1))
}

export function getScaledMonsterDamage(baseDamage: number, level: number): number {
  return Math.floor(baseDamage * Math.pow(GAME_CONSTANTS.MONSTER_DAMAGE_SCALE, level - 1))
}

// =============================================================================
// MONSTER SPAWN
// =============================================================================
export function getSpawnPositions(
  worldWidth: number,
  worldHeight: number,
  count: number,
  padding: number = 50
): Vector2[] {
  const positions: Vector2[] = []
  const sides = ['top', 'bottom', 'left', 'right']
  
  for (let i = 0; i < count; i++) {
    const side = sides[i % sides.length]
    let pos: Vector2
    
    switch (side) {
      case 'top':
        pos = { x: Math.random() * worldWidth, y: padding }
        break
      case 'bottom':
        pos = { x: Math.random() * worldWidth, y: worldHeight - padding }
        break
      case 'left':
        pos = { x: padding, y: Math.random() * worldHeight }
        break
      case 'right':
      default:
        pos = { x: worldWidth - padding, y: Math.random() * worldHeight }
        break
    }
    
    positions.push(pos)
  }
  
  return positions
}

// =============================================================================
// TARGET SELECTION
// =============================================================================
export interface PotentialTarget {
  type: 'player' | 'building' | 'vanguard' | 'door'
  position: Vector2
  priority: number
  id: number
  hp: number
  roomId?: number
}

export function findBestTarget(
  monster: Monster,
  players: Player[],
  buildings: DefenseBuilding[],
  vanguards: VanguardUnit[]
): PotentialTarget | null {
  const targets: PotentialTarget[] = []
  
  // Add alive players (not sleeping)
  for (const player of players) {
    if (player.alive && player.hp > 0 && !player.isSleeping) {
      targets.push({
        type: 'player',
        position: player.position,
        priority: 3, // Highest priority
        id: player.id,
        hp: player.hp,
      })
    }
  }
  
  // Add turrets (priority targets)
  for (const building of buildings) {
    if (building.hp > 0 && building.type === 'turret') {
      const pos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
      targets.push({
        type: 'building',
        position: pos,
        priority: 2,
        id: building.id,
        hp: building.hp,
      })
    }
  }
  
  // Add vanguards
  for (const vanguard of vanguards) {
    if (vanguard.hp > 0) {
      targets.push({
        type: 'vanguard',
        position: vanguard.position,
        priority: 2,
        id: vanguard.id,
        hp: vanguard.hp,
      })
    }
  }
  
  if (targets.length === 0) return null
  
  // Find closest target with highest priority
  let bestTarget: PotentialTarget | null = null
  let bestScore = -Infinity
  
  for (const target of targets) {
    const dist = distance(monster.position, target.position)
    // Score: higher priority, closer distance, lower hp
    const score = target.priority * 1000 - dist + (1 - target.hp / 100) * 50
    
    if (score > bestScore) {
      bestScore = score
      bestTarget = target
    }
  }
  
  return bestTarget
}

// =============================================================================
// MONSTER MOVEMENT
// =============================================================================
export function updateMonsterPath(
  monster: Monster,
  target: Vector2,
  grid: GridCell[][],
  cellSize: number
): void {
  const path = findPath(grid, monster.position, target, cellSize)
  
  if (path.length > 0) {
    monster.path = path
    monster.targetPosition = path[0] || null
  }
}

export function moveMonsterAlongPath(
  monster: Monster,
  deltaTime: number
): void {
  if (monster.path.length === 0) {
    return
  }
  
  const target = monster.path[0]
  if (!target) return
  
  const moved = moveTowards(monster.position, target, monster.speed, deltaTime)
  
  monster.position.x = moved.x
  monster.position.y = moved.y
  
  if (distance(monster.position, target) < 5) {
    monster.path.shift() // Remove reached waypoint
    monster.targetPosition = monster.path[0] || null
  }
}

// =============================================================================
// MONSTER STATE MANAGEMENT
// =============================================================================
export function shouldRetreat(monster: Monster): boolean {
  const hpRatio = monster.hp / monster.maxHp
  return hpRatio <= GAME_CONSTANTS.MONSTER_HEAL_THRESHOLD && !monster.isFullyHealing
}

export function isAtHealZone(monster: Monster): boolean {
  for (const zone of monster.healZones) {
    if (distance(monster.position, zone) < 100) {
      return true
    }
  }
  return false
}

/**
 * Heal monster and consume mana from healing point
 * @param monster The monster to heal
 * @param deltaTime Time since last update
 * @param availableMana The mana available at the current healing point
 * @returns The amount of mana consumed (equals HP restored)
 */
export function healMonsterWithMana(
  monster: Monster, 
  deltaTime: number, 
  availableMana: number
): number {
  const potentialHeal = monster.maxHp * GAME_CONSTANTS.MONSTER_HEAL_RATE * deltaTime
  const hpNeeded = monster.maxHp - monster.hp
  const healAmount = Math.min(potentialHeal, hpNeeded, availableMana)
  
  monster.hp += healAmount
  return healAmount // Mana consumed equals HP restored
}

/**
 * @deprecated Use findNearestHealingPointWithMana instead for mana-based healing
 */
export function getClosestHealZone(monster: Monster): Vector2 | null {
  if (monster.healZones.length === 0) return null
  
  let closest: Vector2 | null = monster.healZones[0] || null
  if (!closest) return null
  
  let closestDist = distance(monster.position, closest)
  
  for (const zone of monster.healZones) {
    const dist = distance(monster.position, zone)
    if (dist < closestDist) {
      closest = zone
      closestDist = dist
    }
  }
  
  return closest
}

/**
 * Check if a healing point has sufficient mana for healing
 * Requires at least 10% of max mana capacity
 */
export function hasEnoughManaForHealing(
  currentMana: number, 
  maxMana: number
): boolean {
  const minManaPercent = GAME_CONSTANTS.MONSTER_HEAL_THRESHOLD // 10%
  return currentMana >= maxMana * minManaPercent
}
