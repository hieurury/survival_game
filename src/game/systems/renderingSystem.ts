/**
 * Rendering System
 * Handles all canvas drawing operations
 */
import type { Player, Monster, DefenseBuilding, Room, VanguardUnit, Projectile, GridCell } from '../../types/game'

// =============================================================================
// CANVAS UTILITIES
// =============================================================================
export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, width, height)
}

export function setupCamera(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
  ctx.save()
  ctx.translate(-cameraX, -cameraY)
}

export function resetCamera(ctx: CanvasRenderingContext2D): void {
  ctx.restore()
}

// =============================================================================
// GRID RENDERING
// =============================================================================
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: GridCell[][],
  cellSize: number,
  cameraX: number,
  cameraY: number,
  viewportWidth: number,
  viewportHeight: number
): void {
  const startX = Math.max(0, Math.floor(cameraX / cellSize))
  const startY = Math.max(0, Math.floor(cameraY / cellSize))
  const endX = Math.min(grid.length, Math.ceil((cameraX + viewportWidth) / cellSize) + 1)
  const endY = Math.min(grid[0]?.length || 0, Math.ceil((cameraY + viewportHeight) / cellSize) + 1)
  
  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      const cell = grid[x]?.[y]
      if (!cell) continue
      
      const px = x * cellSize
      const py = y * cellSize
      
      // Draw cell based on type
      switch (cell.type) {
        case 'wall':
          ctx.fillStyle = '#374151'
          break
        case 'room':
          ctx.fillStyle = '#2d3748'
          break
        case 'corridor':
          ctx.fillStyle = '#3d4a5c'
          break
        case 'door':
          ctx.fillStyle = '#8b5cf6'
          break
        case 'build_spot':
          ctx.fillStyle = '#1e3a5f'
          break
        case 'heal_zone':
          ctx.fillStyle = '#065f46'
          break
        default:
          ctx.fillStyle = '#1f2937'
      }
      
      ctx.fillRect(px, py, cellSize, cellSize)
      
      // Draw grid lines
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 0.5
      ctx.strokeRect(px, py, cellSize, cellSize)
    }
  }
}

// =============================================================================
// ROOM RENDERING
// =============================================================================
export function drawRoom(
  ctx: CanvasRenderingContext2D,
  room: Room,
  cellSize: number
): void {
  const x = room.gridX * cellSize
  const y = room.gridY * cellSize
  const width = room.width * cellSize
  const height = room.height * cellSize
  
  // Room floor
  ctx.fillStyle = 'rgba(45, 55, 72, 0.5)'
  ctx.fillRect(x, y, width, height)
  
  // Room border
  ctx.strokeStyle = '#4a5568'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2)
  
  // Draw door
  const doorX = room.doorGridX * cellSize
  const doorY = room.doorGridY * cellSize
  const doorHpRatio = room.doorHp / room.doorMaxHp
  
  ctx.fillStyle = doorHpRatio > 0.5 ? '#8b5cf6' : '#ef4444'
  ctx.fillRect(doorX + 4, doorY + 4, cellSize - 8, cellSize - 8)
  
  // Door HP bar
  if (room.doorHp < room.doorMaxHp) {
    drawHealthBar(ctx, doorX, doorY - 8, cellSize, doorHpRatio)
  }
}

// =============================================================================
// BUILDING RENDERING
// =============================================================================
export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  building: DefenseBuilding,
  cellSize: number
): void {
  const x = building.gridX * cellSize
  const y = building.gridY * cellSize
  const centerX = x + cellSize / 2
  const centerY = y + cellSize / 2
  
  switch (building.type) {
    case 'turret':
      drawTurret(ctx, centerX, centerY, cellSize, building)
      break
    case 'atm':
      drawATM(ctx, centerX, centerY, cellSize)
      break
    case 'soul_collector':
      drawSoulCollector(ctx, centerX, centerY, cellSize)
      break
    case 'vanguard':
      drawVanguardBuilding(ctx, centerX, centerY, cellSize)
      break
  }
  
  // HP bar
  if (building.hp < building.maxHp) {
    drawHealthBar(ctx, x, y - 8, cellSize, building.hp / building.maxHp)
  }
  
  // Level indicator
  if (building.level > 1) {
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`Lv${building.level}`, x + cellSize - 2, y + 12)
  }
}

function drawTurret(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, building: DefenseBuilding): void {
  // Base
  ctx.fillStyle = '#4b5563'
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2)
  ctx.fill()
  
  // Barrel
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(building.rotation || 0)
  
  ctx.fillStyle = '#3b82f6'
  ctx.fillRect(0, -4, size * 0.4, 8)
  
  ctx.restore()
}

function drawATM(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  // Base
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(cx - size * 0.3, cy - size * 0.35, size * 0.6, size * 0.7)
  
  // Screen
  ctx.fillStyle = '#065f46'
  ctx.fillRect(cx - size * 0.2, cy - size * 0.25, size * 0.4, size * 0.3)
  
  // Dollar sign
  ctx.fillStyle = '#22c55e'
  ctx.font = `bold ${size * 0.3}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('$', cx, cy - size * 0.1)
}

function drawSoulCollector(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  // Crystal base
  ctx.fillStyle = '#8b5cf6'
  ctx.beginPath()
  ctx.moveTo(cx, cy - size * 0.4)
  ctx.lineTo(cx + size * 0.3, cy)
  ctx.lineTo(cx, cy + size * 0.4)
  ctx.lineTo(cx - size * 0.3, cy)
  ctx.closePath()
  ctx.fill()
  
  // Glow
  ctx.fillStyle = 'rgba(139, 92, 246, 0.3)'
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawVanguardBuilding(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  // Base
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.38, 0, Math.PI * 2)
  ctx.fill()
  
  // Shield icon
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(cx, cy - 12)
  ctx.lineTo(cx + 10, cy - 4)
  ctx.lineTo(cx + 8, cy + 10)
  ctx.lineTo(cx, cy + 14)
  ctx.lineTo(cx - 8, cy + 10)
  ctx.lineTo(cx - 10, cy - 4)
  ctx.closePath()
  ctx.fill()
}

// =============================================================================
// PLAYER RENDERING
// =============================================================================
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  isCurrentPlayer: boolean = false
): void {
  if (!player.alive) return
  
  const { x, y } = player.position
  const size = 16
  
  // Sleeping indicator
  if (player.isSleeping) {
    ctx.fillStyle = 'rgba(100, 100, 255, 0.3)'
    ctx.beginPath()
    ctx.arc(x, y, size + 10, 0, Math.PI * 2)
    ctx.fill()
    
    // ZZZ
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Z Z Z', x, y - 25)
  }
  
  // Player body
  ctx.fillStyle = isCurrentPlayer ? '#22c55e' : '#3b82f6'
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fill()
  
  // Player border
  ctx.strokeStyle = isCurrentPlayer ? '#16a34a' : '#2563eb'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.stroke()
  
  // Health bar
  if (player.hp < player.maxHp) {
    drawHealthBar(ctx, x - 20, y - 30, 40, player.hp / player.maxHp)
  }
  
  // Attack indicator
  if (player.state === 'attacking') {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, size + 5, 0, Math.PI * 2)
    ctx.stroke()
  }
}

// =============================================================================
// MONSTER RENDERING
// =============================================================================
export function drawMonster(
  ctx: CanvasRenderingContext2D,
  monster: Monster
): void {
  if (monster.hp <= 0) return
  
  const { x, y } = monster.position
  const size = 20
  
  // Monster body
  ctx.fillStyle = monster.isRetreating ? '#f97316' : '#ef4444'
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fill()
  
  // Eyes
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x - 6, y - 4, 4, 0, Math.PI * 2)
  ctx.arc(x + 6, y - 4, 4, 0, Math.PI * 2)
  ctx.fill()
  
  // Pupils
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.arc(x - 5, y - 4, 2, 0, Math.PI * 2)
  ctx.arc(x + 7, y - 4, 2, 0, Math.PI * 2)
  ctx.fill()
  
  // Health bar
  drawHealthBar(ctx, x - 20, y - 30, 40, monster.hp / monster.maxHp)
  
  // Level indicator
  if (monster.level > 1) {
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`Lv${monster.level}`, x, y + 35)
  }
}

// =============================================================================
// VANGUARD RENDERING
// =============================================================================
export function drawVanguard(
  ctx: CanvasRenderingContext2D,
  vanguard: VanguardUnit
): void {
  if (vanguard.hp <= 0) return
  
  const { x, y } = vanguard.position
  const size = 14
  
  // Body
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fill()
  
  // Shield icon
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(x, y - 6)
  ctx.lineTo(x + 5, y - 2)
  ctx.lineTo(x + 4, y + 5)
  ctx.lineTo(x, y + 7)
  ctx.lineTo(x - 4, y + 5)
  ctx.lineTo(x - 5, y - 2)
  ctx.closePath()
  ctx.fill()
  
  // Health bar
  if (vanguard.hp < vanguard.maxHp) {
    drawHealthBar(ctx, x - 15, y - 22, 30, vanguard.hp / vanguard.maxHp)
  }
  
  // Attack indicator
  if (vanguard.state === 'attacking') {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(x, y, size + 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// =============================================================================
// PROJECTILE RENDERING
// =============================================================================
export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  projectile: Projectile
): void {
  const { x, y } = projectile.position
  const size = projectile.size || 5
  
  // Glow effect
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2)
  gradient.addColorStop(0, projectile.color || '#3b82f6')
  gradient.addColorStop(1, 'transparent')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, size * 2, 0, Math.PI * 2)
  ctx.fill()
  
  // Core
  ctx.fillStyle = projectile.color || '#3b82f6'
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fill()
}

// =============================================================================
// UI ELEMENTS
// =============================================================================
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  ratio: number,
  height: number = 6
): void {
  // Background
  ctx.fillStyle = '#374151'
  ctx.fillRect(x, y, width, height)
  
  // Health
  const healthColor = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#eab308' : '#ef4444'
  ctx.fillStyle = healthColor
  ctx.fillRect(x, y, width * Math.max(0, ratio), height)
  
  // Border
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, width, height)
}

export function drawSelectionCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string = '#22c55e'
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
}

export function drawRangeIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  range: number,
  color: string = 'rgba(59, 130, 246, 0.2)'
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, range, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, range, 0, Math.PI * 2)
  ctx.stroke()
}
