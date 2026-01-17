/**
 * Movement System
 * Handles all movement-related logic: player movement, pathfinding integration, collision
 */
import { reactive } from 'vue'
import type { Player, Monster, GridCell, Room } from '../../types/game'
import { GAME_CONSTANTS } from '../../types/game'
import { distance, moveTowards } from '../../composables/usePathfinding'

// =============================================================================
// INPUT STATE
// =============================================================================
export interface MoveInput {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export const moveInput = reactive<MoveInput>({
  up: false,
  down: false,
  left: false,
  right: false,
})

// =============================================================================
// INPUT HANDLERS
// =============================================================================
export function handleKeyDown(e: KeyboardEvent, player: Player | null, gamePhase: string): boolean {
  if (gamePhase !== 'playing') return false
  if (!player?.alive || player.isSleeping) return false
  
  let handled = false
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup':
      moveInput.up = true
      handled = true
      break
    case 's': case 'arrowdown':
      moveInput.down = true
      handled = true
      break
    case 'a': case 'arrowleft':
      moveInput.left = true
      handled = true
      break
    case 'd': case 'arrowright':
      moveInput.right = true
      handled = true
      break
  }
  return handled
}

export function handleKeyUp(e: KeyboardEvent): void {
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup': moveInput.up = false; break
    case 's': case 'arrowdown': moveInput.down = false; break
    case 'a': case 'arrowleft': moveInput.left = false; break
    case 'd': case 'arrowright': moveInput.right = false; break
  }
}

export function startMove(dir: keyof MoveInput): void {
  moveInput[dir] = true
}

export function stopMove(): void {
  moveInput.up = false
  moveInput.down = false
  moveInput.left = false
  moveInput.right = false
}

export function stopMoveDir(dir: keyof MoveInput): void {
  moveInput[dir] = false
}

// =============================================================================
// MOVEMENT UPDATE
// =============================================================================
export function updatePlayerMovement(
  player: Player,
  deltaTime: number,
  grid: GridCell[][],
  rooms: Room[],
  isDoorPassable: (room: Room, playerId: number, isMonster: boolean) => boolean
): void {
  if (!player.alive || player.isSleeping) return
  
  const hasInput = moveInput.up || moveInput.down || moveInput.left || moveInput.right
  if (!hasInput) return
  
  // Calculate movement direction
  let dx = 0
  let dy = 0
  if (moveInput.up) dy -= 1
  if (moveInput.down) dy += 1
  if (moveInput.left) dx -= 1
  if (moveInput.right) dx += 1
  
  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy)
    dx /= len
    dy /= len
  }
  
  // Calculate new position
  const speed = player.speed * deltaTime
  let newX = player.position.x + dx * speed
  let newY = player.position.y + dy * speed
  
  // Clamp to world bounds
  const cellSize = GAME_CONSTANTS.CELL_SIZE
  newX = Math.max(cellSize, Math.min(GAME_CONSTANTS.WORLD_WIDTH - cellSize, newX))
  newY = Math.max(cellSize, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - cellSize, newY))
  
  // Check collision at new position
  const cellX = Math.floor(newX / cellSize)
  const cellY = Math.floor(newY / cellSize)
  
  const cell = grid[cellY]?.[cellX]
  if (!cell) return
  
  // Wall collision with sliding
  if (cell.type === 'wall') {
    const cellXOnly = Math.floor((player.position.x + dx * speed) / cellSize)
    const cellYOnly = Math.floor((player.position.y + dy * speed) / cellSize)
    
    const cellAtX = grid[Math.floor(player.position.y / cellSize)]?.[cellXOnly]
    if (cellAtX && cellAtX.type !== 'wall') {
      newX = player.position.x + dx * speed
      newY = player.position.y
    } else {
      const cellAtY = grid[cellYOnly]?.[Math.floor(player.position.x / cellSize)]
      if (cellAtY && cellAtY.type !== 'wall') {
        newX = player.position.x
        newY = player.position.y + dy * speed
      } else {
        return // Completely blocked
      }
    }
  }
  
  // Check room entry
  const finalCellX = Math.floor(newX / cellSize)
  const finalCellY = Math.floor(newY / cellSize)
  const finalCell = grid[finalCellY]?.[finalCellX]
  
  if (finalCell && (finalCell.type === 'room' || finalCell.type === 'door') && finalCell.roomId !== undefined) {
    const room = rooms[finalCell.roomId]
    if (room && !isDoorPassable(room, player.id, false)) {
      return // Door locked
    }
  }
  
  // Apply movement
  if (finalCell && (finalCell.walkable || finalCell.type === 'door' || finalCell.type === 'room')) {
    player.position.x = newX
    player.position.y = newY
    player.state = 'walking'
    player.path = []
    player.targetPosition = null
    
    if (dx > 0) player.facingRight = true
    else if (dx < 0) player.facingRight = false
    
    player.animationTimer += deltaTime
    if (player.animationTimer >= GAME_CONSTANTS.ANIMATION_SPEED) {
      player.animationFrame = (player.animationFrame + 1) % 4
      player.animationTimer = 0
    }
  }
}

// =============================================================================
// SMOOTH MOVEMENT
// =============================================================================
export function smoothMove(entity: Player, deltaTime: number): void {
  const factor = 1 - Math.pow(1 - GAME_CONSTANTS.SMOOTH_FACTOR, deltaTime * 60)
  entity.smoothX += (entity.position.x - entity.smoothX) * factor
  entity.smoothY += (entity.position.y - entity.smoothY) * factor
}

// =============================================================================
// PATH-BASED MOVEMENT
// =============================================================================
export function moveAlongPath(entity: Player | Monster, deltaTime: number): void {
  if (entity.path.length === 0) {
    if ('isSleeping' in entity && !entity.isSleeping) {
      entity.state = 'idle'
    } else if (!('isSleeping' in entity)) {
      entity.state = 'idle'
    }
    return
  }
  
  const target = entity.path[0]
  if (!target) {
    entity.path.shift()
    return
  }
  
  const newPos = moveTowards(entity.position, target, entity.speed, deltaTime)
  
  if (newPos.x > entity.position.x) entity.facingRight = true
  else if (newPos.x < entity.position.x) entity.facingRight = false
  
  entity.position.x = newPos.x
  entity.position.y = newPos.y
  
  entity.animationTimer += deltaTime
  if (entity.animationTimer >= GAME_CONSTANTS.ANIMATION_SPEED) {
    entity.animationFrame = (entity.animationFrame + 1) % 4
    entity.animationTimer = 0
  }
  
  if (distance(entity.position, target) < 8) {
    entity.path.shift()
  }
}
