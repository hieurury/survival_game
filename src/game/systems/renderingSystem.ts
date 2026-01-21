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
    case 'smg':
      drawSMG(ctx, centerX, centerY, cellSize, building)
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

function drawSMG(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, building: DefenseBuilding): void {
  // Outer glow ring
  ctx.strokeStyle = '#f97316'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.38, 0, Math.PI * 2)
  ctx.stroke()
  
  // Base platform - darker orange/brown
  ctx.fillStyle = '#78350f'
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2)
  ctx.fill()
  
  // Inner ring - orange
  ctx.fillStyle = '#ea580c'
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.25, 0, Math.PI * 2)
  ctx.fill()
  
  // Rotating barrel assembly
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(building.rotation || 0)
  
  // Barrel housing - dark metal box
  ctx.fillStyle = '#292524'
  ctx.fillRect(0, -size * 0.18, size * 0.45, size * 0.36)
  
  // 3 barrel tubes - orange
  const barrelY = [-size * 0.1, 0, size * 0.1]
  for (const by of barrelY) {
    // Barrel body
    ctx.fillStyle = '#f97316'
    ctx.fillRect(size * 0.08, by - 2.5, size * 0.4, 5)
    
    // Barrel tip highlight
    ctx.fillStyle = '#fcd34d'
    ctx.beginPath()
    ctx.arc(size * 0.48, by, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  
  ctx.restore()
  
  // Center core - bright orange dot
  ctx.fillStyle = '#fb923c'
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.1, 0, Math.PI * 2)
  ctx.fill()
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
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.beginPath()
  ctx.ellipse(x, y + 30, 32, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  
  const bounce = monster.state === 'walking' ? Math.sin(monster.animationFrame * Math.PI / 2) * 5 : 0
  
  ctx.save()
  ctx.translate(x, y + bounce)
  if (!monster.facingRight) ctx.scale(-1, 1)
  
  // Determine body color based on monster state
  let bodyColor = '#7c3aed' // Default purple (Ác ma)
  if (monster.name === 'Vong hồn kỵ sỹ') {
    bodyColor = '#6366f1' // Indigo for Phantom Knight
  }
  if (monster.isRetreating) {
    bodyColor = '#581c87' // Dark purple when retreating
  } else if (monster.passiveActive) {
    bodyColor = '#dc2626' // Red when passive active (ranged mode)
  }
  
  // Body
  ctx.fillStyle = bodyColor
  ctx.beginPath()
  ctx.ellipse(0, 0, 35, 45, 0, 0, Math.PI * 2)
  ctx.fill()
  
  // Horns (different style for Phantom Knight)
  if (monster.name === 'Vong hồn kỵ sỹ') {
    // Knight helmet style
    ctx.fillStyle = '#44403c'
    ctx.beginPath()
    ctx.moveTo(-20, -35)
    ctx.lineTo(0, -60)
    ctx.lineTo(20, -35)
    ctx.closePath()
    ctx.fill()
  } else {
    // Demon horns
    ctx.fillStyle = '#44403c'
    ctx.beginPath()
    ctx.moveTo(-18, -32)
    ctx.lineTo(-12, -55)
    ctx.lineTo(-6, -32)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(6, -32)
    ctx.lineTo(12, -55)
    ctx.lineTo(18, -32)
    ctx.fill()
  }
  
  // Eyes
  ctx.fillStyle = monster.passiveActive ? '#fbbf24' : '#ef4444' // Yellow when passive active
  ctx.shadowColor = monster.passiveActive ? '#fbbf24' : '#ef4444'
  ctx.shadowBlur = 15
  ctx.beginPath()
  ctx.arc(-12, -12, 7, 0, Math.PI * 2)
  ctx.arc(12, -12, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  
  // Healing effect
  if (monster.state === 'healing') {
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, 50 + Math.sin(Date.now() / 150) * 8, 0, Math.PI * 2)
    ctx.stroke()
  }
  
  // Attack effect - different for each monster type
  if (monster.state === 'attacking') {
    const attackAnim = (Date.now() % 400) / 400 // 0-1 animation cycle
    
    if (monster.name === 'Vong hồn kỵ sỹ') {
      // Check if in ranged mode (passive active)
      if (monster.isRanged && monster.passiveActive) {
        // Bow and arrow animation for ranged attacks
        ctx.save()
        const drawAnim = Math.sin(attackAnim * Math.PI) // 0 -> 1 -> 0
        
        // Bow body (curved)
        ctx.strokeStyle = '#78350f' // Brown wood
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(30, 0, 20, -Math.PI / 2.5, Math.PI / 2.5)
        ctx.stroke()
        
        // Bow string
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 2
        ctx.beginPath()
        const stringPull = drawAnim * 15 // String pulls back
        ctx.moveTo(30, -16)
        ctx.quadraticCurveTo(30 - stringPull, 0, 30, 16)
        ctx.stroke()
        
        // Arrow
        if (drawAnim > 0.2) {
          const arrowX = 30 - stringPull + 5
          
          // Arrow shaft
          ctx.fillStyle = '#78350f'
          ctx.fillRect(arrowX - 25, -1.5, 30, 3)
          
          // Arrow head
          ctx.fillStyle = '#94a3b8'
          ctx.beginPath()
          ctx.moveTo(arrowX + 8, 0)
          ctx.lineTo(arrowX + 2, -4)
          ctx.lineTo(arrowX + 2, 4)
          ctx.closePath()
          ctx.fill()
          
          // Arrow feathers
          ctx.fillStyle = '#ef4444'
          ctx.beginPath()
          ctx.moveTo(arrowX - 25, 0)
          ctx.lineTo(arrowX - 30, -5)
          ctx.lineTo(arrowX - 22, 0)
          ctx.lineTo(arrowX - 30, 5)
          ctx.closePath()
          ctx.fill()
        }
        
        // Release effect
        if (attackAnim > 0.7) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)'
          ctx.lineWidth = 2
          const releaseOffset = (attackAnim - 0.7) * 100
          ctx.beginPath()
          ctx.moveTo(50 + releaseOffset, -3)
          ctx.lineTo(70 + releaseOffset, 0)
          ctx.lineTo(50 + releaseOffset, 3)
          ctx.stroke()
        }
        
        ctx.restore()
      } else {
        // Sword slash animation for melee
        ctx.save()
        const swingAngle = Math.sin(attackAnim * Math.PI * 2) * 0.8 - 0.4
        ctx.rotate(swingAngle)
        
        // Sword blade
        ctx.fillStyle = '#94a3b8' // Steel color
        ctx.beginPath()
        ctx.moveTo(25, -3)
        ctx.lineTo(65, -5)
        ctx.lineTo(70, 0)
        ctx.lineTo(65, 5)
        ctx.lineTo(25, 3)
        ctx.closePath()
        ctx.fill()
        
        // Sword edge glow
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 1
        ctx.stroke()
        
        // Sword handle
        ctx.fillStyle = '#78350f'
        ctx.fillRect(15, -4, 12, 8)
        
        // Guard
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(24, -8, 4, 16)
        
        // Slash trail effect
        if (attackAnim > 0.3 && attackAnim < 0.7) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(45, 0, 30, -Math.PI / 3, Math.PI / 3)
          ctx.stroke()
        }
        
        ctx.restore()
      }
    } else {
      // Demon claw scratch animation
      const clawExtend = Math.sin(attackAnim * Math.PI) * 25
      
      // Draw 3 claws scratching
      ctx.strokeStyle = '#ef4444'
      ctx.lineCap = 'round'
      
      for (let i = -1; i <= 1; i++) {
        const offsetY = i * 12
        ctx.lineWidth = 4 - Math.abs(i)
        
        ctx.beginPath()
        ctx.moveTo(20, offsetY)
        ctx.quadraticCurveTo(
          35 + clawExtend * 0.5, offsetY - 5,
          45 + clawExtend, offsetY + i * 3
        )
        ctx.stroke()
        
        // Claw tip
        ctx.fillStyle = '#fca5a5'
        ctx.beginPath()
        ctx.arc(45 + clawExtend, offsetY + i * 3, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      
      // Scratch marks effect
      if (attackAnim > 0.5) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'
        ctx.lineWidth = 2
        for (let i = 0; i < 3; i++) {
          ctx.beginPath()
          ctx.moveTo(50 + i * 5, -15)
          ctx.lineTo(60 + i * 5, 15)
          ctx.stroke()
        }
      }
    }
  }
  
  // Ranged mode indicator (bow for Phantom Knight)
  if (monster.isRanged && monster.name === 'Vong hồn kỵ sỹ') {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(30, 0, 15, -Math.PI / 3, Math.PI / 3)
    ctx.stroke()
  }
  
  ctx.restore()
  
  // HP bar
  const hpPercent = monster.hp / monster.maxHp
  ctx.fillStyle = '#222'
  ctx.fillRect(x - 40, y - 65, 80, 12)
  ctx.fillStyle = hpPercent > 0.5 ? '#a855f7' : hpPercent > 0.2 ? '#eab308' : '#ef4444'
  ctx.fillRect(x - 40, y - 65, 80 * hpPercent, 12)
  ctx.strokeStyle = '#444'
  ctx.lineWidth = 1
  ctx.strokeRect(x - 40, y - 65, 80, 12)
  
  // Skill Cooldown bar (yellow) - directly below HP bar
  if (monster.skill) {
    const skillProgress = monster.skill.cooldown > 0 
      ? 1 - (monster.skill.currentCooldown / monster.skill.cooldown) 
      : 1
    
    ctx.fillStyle = '#78350f' // Dark yellow background
    ctx.fillRect(x - 40, y - 51, 80, 5)
    ctx.fillStyle = skillProgress >= 1 ? '#fbbf24' : '#eab308' // Bright yellow when ready
    ctx.fillRect(x - 40, y - 51, 80 * Math.min(1, skillProgress), 5)
    ctx.strokeStyle = '#92400e'
    ctx.lineWidth = 0.5
    ctx.strokeRect(x - 40, y - 51, 80, 5)
    
    // Skill ready indicator
    if (skillProgress >= 1) {
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 8px Arial'
      ctx.textAlign = 'right'
      ctx.fillText('⚡', x + 48, y - 46)
    }
  }
  
  // Monster level badge
  ctx.fillStyle = monster.name === 'Vong hồn kỵ sỹ' ? '#6366f1' : '#7c3aed'
  ctx.beginPath()
  ctx.arc(x + 50, y - 60, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`${monster.level}`, x + 50, y - 56)
  
  // HP text
  ctx.fillStyle = '#fff'
  ctx.font = '10px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.floor(monster.hp)}/${monster.maxHp}`, x, y - 75)
  
  // Monster name
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 10px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(monster.name, x, y - 85)
}

// =============================================================================
// PROGRESS BAR UTILITY (for level and skill cooldown)
// =============================================================================
export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  ratio: number,
  fillColor: string = '#3b82f6',
  bgColor: string = '#1e3a8a',
  height: number = 4
): void {
  // Background
  ctx.fillStyle = bgColor
  ctx.fillRect(x, y, width, height)
  
  // Progress
  ctx.fillStyle = fillColor
  ctx.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), height)
  
  // Border
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 0.5
  ctx.strokeRect(x, y, width, height)
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
