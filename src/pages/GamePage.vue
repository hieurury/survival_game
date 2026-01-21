<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { initAudio, playSfx, startBgm, stopBgm } from '../composables/useAudio'
import { findPath, distance, moveTowards, gridToWorld } from '../composables/usePathfinding'
import BotAI from '../composables/useBotAI'
import { t, getBuildingTypeName } from '../composables/useLocale'
import { useGameState } from '../composables/useGameState'
import { ROOM_SHAPES, doesShapeOverlap, markShapeAsOccupied } from '../game/entities/rooms/RoomShapes'
import { getBuildingConfig, type BuildingType } from '../game/config/entityConfigs'
import { getRandomMonsterType, createMonsterFromType, getMonsterPassiveInfo, getMonsterTypeConfig } from '../game/config/monsterPool'
import { drawMonster as renderMonster } from '../game/systems/renderingSystem'
import GameIcons from '../components/game/GameIcons.vue'
import type { 
  Room, Player, Monster, GamePhase, GridCell, 
  DefenseBuilding, Particle, Projectile, Vector2,
  FloatingText, VanguardUnit, HealingPoint
} from '../types/game'
import { GAME_CONSTANTS } from '../types/game'

// Get difficulty configuration
const { 
  mapConfig, 
  monsterConfig, 
  playerConfig, 
  economyConfig, 
  healingPointConfig,
  timingConfig,
  healingPointNests,
  spawnZone,
} = useGameState()

// Building costs - VÀNG (trừ ATM dùng LINH HỒN)
const buildingCosts = computed(() => ({
  turret: Math.floor(GAME_CONSTANTS.COSTS.turret * economyConfig.value.buildingCostMultiplier),
  smg: Math.floor(GAME_CONSTANTS.COSTS.smg * economyConfig.value.buildingCostMultiplier),
  atm: GAME_CONSTANTS.SOUL_COSTS.atm, // ATM mua bằng LINH HỒN
  soulCollector: Math.floor(GAME_CONSTANTS.COSTS.soul_collector * economyConfig.value.buildingCostMultiplier),
  vanguard: Math.floor(GAME_CONSTANTS.COSTS.vanguard * economyConfig.value.buildingCostMultiplier),
  upgradeDoor: Math.floor(GAME_CONSTANTS.COSTS.upgradeDoor * economyConfig.value.upgradeCostMultiplier)
}))

const emit = defineEmits<{
  (e: 'back-home'): void
}>() 

// Canvas refs
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let lastTime = 0

// Responsive viewport - adapts to screen size
const viewportWidth = ref<number>(GAME_CONSTANTS.VIEWPORT_WIDTH)
const viewportHeight = ref<number>(GAME_CONSTANTS.VIEWPORT_HEIGHT)

// Update viewport size based on container
const updateViewportSize = () => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    viewportWidth.value = Math.floor(rect.width)
    viewportHeight.value = Math.floor(rect.height)
  }
}

// Game state - game starts immediately, countdown is for monster spawn
const gamePhase = ref<GamePhase>('playing')
const countdown = ref(timingConfig.value.countdownTime)
const monsterActive = ref(false) // Monster starts hunting after countdown
const gameOver = ref(false)
const victory = ref(false)
const messageLog = ref<string[]>([])
const showBuildPopup = ref(false)
const buildTab = ref<'defense' | 'economy'>('defense') // Tab state for build popup
const selectedBuildSpot = ref<{ x: number; y: number; roomId: number } | null>(null)
const goldAccumulator = reactive<{ [key: number]: number }>({}) // Tracks partial gold per player

// Upgrade modal state
const showUpgradeModal = ref(false)
const upgradeTarget = ref<{ type: 'door' | 'bed' | 'building'; building?: DefenseBuilding; room?: Room } | null>(null)
const modalInteractive = ref(false) // Prevents accidental touches when modal opens

// Camera/viewport with drag support
const camera = reactive({ x: 0, y: 0 })
const cameraShake = reactive({ x: 0, y: 0, intensity: 0, duration: 0 })
const isDragging = ref(false)
const dragStart = reactive({ x: 0, y: 0 })
const cameraStart = reactive({ x: 0, y: 0 })
const cameraManualMode = ref(false) // true when user manually drags camera

// Near bed detection for sleep button
const isNearBed = ref(false)
const currentNearRoom = ref<Room | null>(null)

// Grid map
const grid = reactive<GridCell[][]>([])

// Helper: check if position is in central spawn zone (no building allowed)
const isInSpawnZone = (gridX: number, gridY: number): boolean => {
  const sz = spawnZone.value
  return gridX >= sz.gridX && gridX < sz.gridX + sz.width &&
         gridY >= sz.gridY && gridY < sz.gridY + sz.height
}

// Initialize grid - create a fully walkable map with corridors
// Uses difficulty-based map size
const initGrid = () => {
  grid.length = 0
  const config = mapConfig.value
  
  // First pass: create all corridor cells (WALKABLE by default)
  for (let y = 0; y < config.gridRows; y++) {
    const row: GridCell[] = []
    for (let x = 0; x < config.gridCols; x++) {
      row.push({ x, y, type: 'corridor', walkable: true })
    }
    grid.push(row)
  }
  
  // Mark central spawn zone (no building allowed, but walkable)
  const sz = spawnZone.value
  for (let y = sz.gridY; y < sz.gridY + sz.height; y++) {
    for (let x = sz.gridX; x < sz.gridX + sz.width; x++) {
      const row = grid[y]
      if (row && row[x]) {
        row[x] = { x, y, type: 'corridor', walkable: true }
      }
    }
  }
  
}

// Mark heal zones on grid based on healingPoints array (must call after initHealingPoints)
const markHealZonesOnGrid = () => {
  for (const hp of healingPoints) {
    for (let y = hp.gridY; y < hp.gridY + hp.height; y++) {
      for (let x = hp.gridX; x < hp.gridX + hp.width; x++) {
        const row = grid[y]
        if (row && row[x]) {
          row[x] = { x, y, type: 'heal_zone', walkable: true }
        }
      }
    }
  }
}

// Rooms with beds and build spots
const rooms = reactive<Room[]>([])

// Generate non-overlapping rooms using diverse shapes (Rectangle, L, U, T)
const initRooms = () => {
  rooms.length = 0
  const config = mapConfig.value
  const cellSize = config.cellSize
  const numRooms = config.roomCount
  
  // Track occupied cells for collision detection
  const occupiedCells = new Set<string>()
  
  // Map dimensions
  const gridCols = config.gridCols
  const gridRows = config.gridRows
  const margin = 4 // Margin from map edges (increased for safety)
  const roomPadding = 2 // Minimum space between rooms
  
  // Spawn zone (center of map)
  const sz = spawnZone.value
  
  // Mark spawn zone as occupied
  for (let y = sz.gridY - roomPadding; y < sz.gridY + sz.height + roomPadding; y++) {
    for (let x = sz.gridX - roomPadding; x < sz.gridX + sz.width + roomPadding; x++) {
      occupiedCells.add(`${x},${y}`)
    }
  }
  
  // Mark corner zones for healing points as occupied (dynamic based on map size)
  // Zone size is ~20% of map dimension
  const zoneWidth = Math.max(10, Math.floor(gridCols * 0.2))
  const zoneHeight = Math.max(10, Math.floor(gridRows * 0.2))
  
  const cornerZones = [
    { minX: 0, maxX: zoneWidth, minY: 0, maxY: zoneHeight },                           // Top-left
    { minX: gridCols - zoneWidth, maxX: gridCols, minY: 0, maxY: zoneHeight },         // Top-right  
    { minX: 0, maxX: zoneWidth, minY: gridRows - zoneHeight, maxY: gridRows },         // Bottom-left
    { minX: gridCols - zoneWidth, maxX: gridCols, minY: gridRows - zoneHeight, maxY: gridRows }, // Bottom-right
  ]
  
  for (const zone of cornerZones) {
    for (let y = zone.minY; y < zone.maxY; y++) {
      for (let x = zone.minX; x < zone.maxX; x++) {
        occupiedCells.add(`${x},${y}`)
      }
    }
  }
  
  // Helper: determine best door side based on room position
  const getBestDoorSide = (gx: number, gy: number, w: number, h: number): 'top' | 'bottom' | 'left' | 'right' => {
    const roomCenterX = gx + w / 2
    const roomCenterY = gy + h / 2
    const mapCenterX = gridCols / 2
    const mapCenterY = gridRows / 2
    
    const dx = mapCenterX - roomCenterX
    const dy = mapCenterY - roomCenterY
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left'
    } else {
      return dy > 0 ? 'bottom' : 'top'
    }
  }
  
  // Generate candidate positions covering the entire map
  const candidatePositions: { gridX: number; gridY: number }[] = []
  const step = 3 // Check every 3 cells for potential positions
  
  for (let gy = margin; gy < gridRows - margin - 10; gy += step) {
    for (let gx = margin; gx < gridCols - margin - 10; gx += step) {
      candidatePositions.push({ gridX: gx, gridY: gy })
    }
  }
  
  // Sort candidates by distance from spawn zone center (closer rooms first)
  const spawnCenterX = sz.gridX + sz.width / 2
  const spawnCenterY = sz.gridY + sz.height / 2
  
  candidatePositions.sort((a, b) => {
    const distA = Math.sqrt(Math.pow(a.gridX - spawnCenterX, 2) + Math.pow(a.gridY - spawnCenterY, 2))
    const distB = Math.sqrt(Math.pow(b.gridX - spawnCenterX, 2) + Math.pow(b.gridY - spawnCenterY, 2))
    return distA - distB
  })
  
  // Shuffle with bias towards closer positions for variety
  for (let i = 0; i < candidatePositions.length - 1; i++) {
    if (Math.random() < 0.25) {
      const j = Math.min(i + 1 + Math.floor(Math.random() * 5), candidatePositions.length - 1)
      const temp = candidatePositions[i]!
      candidatePositions[i] = candidatePositions[j]!
      candidatePositions[j] = temp
    }
  }
  
  // Shuffle room shapes for variety
  const shuffledShapes = [...ROOM_SHAPES].sort(() => Math.random() - 0.5)
  
  // Place rooms from candidates
  let roomsPlaced = 0
  let shapeIndex = 0
  
  for (const pos of candidatePositions) {
    if (roomsPlaced >= numRooms) break
    
    const { gridX, gridY } = pos
    
    // Try different shapes at this position
    let placed = false
    const shapesToTry = 5 // Try up to 5 different shapes at each position
    
    for (let attempt = 0; attempt < shapesToTry && !placed; attempt++) {
      const shape = shuffledShapes[(shapeIndex + attempt) % shuffledShapes.length]
      if (!shape) continue
      
      // Check if shape fits at this position
      if (doesShapeOverlap(shape, gridX, gridY, occupiedCells, gridCols, gridRows, margin)) {
        continue
      }
      
      // Shape fits! Place the room
      const width = shape.boundingWidth
      const height = shape.boundingHeight
      
      // Mark cells as occupied (with padding)
      markShapeAsOccupied(shape, gridX, gridY, occupiedCells)
      
      // Add padding around the shape
      for (const cell of shape.cells) {
        const worldX = gridX + cell.x
        const worldY = gridY + cell.y
        for (let dy = -roomPadding; dy <= roomPadding; dy++) {
          for (let dx = -roomPadding; dx <= roomPadding; dx++) {
            occupiedCells.add(`${worldX + dx},${worldY + dy}`)
          }
        }
      }
      
      // Determine best door position based on room location
      const preferredDoorSide = getBestDoorSide(gridX, gridY, width, height)
      
      // Find door cell - prefer edge cells facing the map center
      let doorCell = shape.doorCell
      const edgeCells = shape.cells.filter(cell => {
        const isInterior = shape.interiorCells.some(ic => ic.x === cell.x && ic.y === cell.y)
        return !isInterior
      })
      
      // Try to find a door on the preferred side
      const doorCandidates = edgeCells.filter(cell => {
        const hasInteriorNeighbor = shape.interiorCells.some(ic => 
          (Math.abs(ic.x - cell.x) === 1 && ic.y === cell.y) ||
          (Math.abs(ic.y - cell.y) === 1 && ic.x === cell.x)
        )
        if (!hasInteriorNeighbor) return false
        
        switch (preferredDoorSide) {
          case 'bottom': return cell.y === height - 1 || cell.y > height / 2
          case 'top': return cell.y === 0 || cell.y < height / 2
          case 'right': return cell.x === width - 1 || cell.x > width / 2
          case 'left': return cell.x === 0 || cell.x < width / 2
        }
        return true
      })
      
      if (doorCandidates.length > 0) {
        doorCell = doorCandidates[Math.floor(Math.random() * doorCandidates.length)]!
      }
      
      const doorGridX = gridX + doorCell.x
      const doorGridY = gridY + doorCell.y
      
      // Mark room cells on grid
      for (const cell of shape.cells) {
        const gx = gridX + cell.x
        const gy = gridY + cell.y
        
        if (!grid[gy] || !grid[gy][gx]) continue
        
        const isDoorCell = gx === doorGridX && gy === doorGridY
        const isInterior = shape.interiorCells.some(ic => 
          gridX + ic.x === gx && gridY + ic.y === gy
        )
        
        if (isDoorCell) {
          grid[gy][gx] = { x: gx, y: gy, type: 'door', roomId: roomsPlaced, walkable: true }
        } else if (isInterior) {
          grid[gy][gx] = { x: gx, y: gy, type: 'room', roomId: roomsPlaced, walkable: true }
        } else {
          grid[gy][gx] = { x: gx, y: gy, type: 'wall', roomId: roomsPlaced, walkable: false }
        }
      }
      
      // Room HP - same for all rooms
      const baseHp = GAME_CONSTANTS.BASE_DOOR_HP
      
      // Bed position from shape definition
      const bedCell = shape.bedCell
      const bedX = (gridX + bedCell.x) * cellSize + cellSize / 2
      const bedY = (gridY + bedCell.y) * cellSize + cellSize / 2
      
      // Build spots from shape definition (excluding bed position)
      // Each spot has reBuildable: false by default
      const buildSpots = shape.buildSpots.map(spot => ({
        x: (gridX + spot.x) * cellSize + cellSize / 2,
        y: (gridY + spot.y) * cellSize + cellSize / 2,
        isDestroyed: false  // Will be set to true when building is destroyed
      }))
      
      // Door position in pixels
      const doorX = doorGridX * cellSize + cellSize / 2
      const doorY = doorGridY * cellSize + cellSize / 2
      
      // Calculate center based on actual cells
      const avgX = shape.cells.reduce((sum, c) => sum + c.x, 0) / shape.cells.length
      const avgY = shape.cells.reduce((sum, c) => sum + c.y, 0) / shape.cells.length
      
      rooms.push({
        id: roomsPlaced,
        gridX,
        gridY,
        width,
        height,
        centerX: (gridX + avgX) * cellSize + cellSize / 2,
        centerY: (gridY + avgY) * cellSize + cellSize / 2,
        doorHp: baseHp,
        doorMaxHp: baseHp,
        doorLevel: 1,
        doorUpgradeCost: 40,
        doorSoulCost: 0,
        doorRepairCooldown: 0,
        doorIsRepairing: false,
        doorRepairTimer: 0,
        doorReBuildable: false,  // Default: cannot rebuild door after destruction
        doorAnimProgress: 0,  // Start with door open
        doorAnimTarget: 0,    // Target: open
        ownerId: null,
        bedPosition: { x: bedX, y: bedY },
        bedLevel: 1,
        bedUpgradeCost: 25,
        bedSoulCost: 0,
        bedIncome: economyConfig.value.bedBaseIncome,
        buildSpots,
        doorPosition: { x: doorX, y: doorY },
        doorGridX,
        doorGridY,
        // Store shape data for proper rendering
        shapeCells: shape.cells.map(c => ({ x: c.x, y: c.y })),
        interiorCells: shape.interiorCells.map(c => ({ x: c.x, y: c.y }))
      })
      
      roomsPlaced++
      shapeIndex = (shapeIndex + 1) % shuffledShapes.length
      placed = true
    }
  }
  
  // Log result
  console.log(`Room placement: ${roomsPlaced}/${numRooms} rooms placed (diverse shapes)`)
  if (roomsPlaced < numRooms) {
    console.warn(`Could not place all rooms! Try reducing room count or increasing map size.`)
  }
  
  // Final validation: ensure we have enough rooms for players
  const requiredRooms = playerConfig.value.totalCount
  if (rooms.length < requiredRooms) {
    console.error(`Not enough rooms! Generated: ${rooms.length}, Required: ${requiredRooms}`)
  }
}

// Players with smooth movement
const players = reactive<Player[]>([])

const initPlayers = () => {
  players.length = 0
  const pConfig = playerConfig.value
  const mConfig = mapConfig.value
  const colors: string[] = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6']
  const names: string[] = ['You', 'Bot-1', 'Bot-2', 'Bot-3', 'Bot-4', 'Bot-5', 'Bot-6']
  
  // Spawn players in the CENTRAL SPAWN ZONE
  const sz = spawnZone.value
  const spawnCenterX = (sz.gridX + sz.width / 2) * mConfig.cellSize
  const spawnCenterY = (sz.gridY + sz.height / 2) * mConfig.cellSize
  
  // Total players based on difficulty
  const totalPlayers = pConfig.totalCount
  
  for (let i = 0; i < totalPlayers; i++) {
    // Spread players in a circle around center
    const angle = (i / totalPlayers) * Math.PI * 2
    const radius = 40
    const posX = spawnCenterX + Math.cos(angle) * radius
    const posY = spawnCenterY + Math.sin(angle) * radius
    
    players.push({
      id: i,
      name: names[i] || `Bot-${i}`,
      isHuman: i === 0,
      roomId: null,
      alive: true,
      gold: pConfig.startingGold,
      souls: 0,
      hp: pConfig.hp,
      maxHp: pConfig.hp,
      position: { x: posX, y: posY },
      targetPosition: null,
      path: [],
      speed: pConfig.speed,
      state: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      attackCooldown: 0,
      attackRange: pConfig.attackRange,
      damage: pConfig.damage,
      facingRight: true,
      isSleeping: false,
      sleepTimer: 0,
      smoothX: posX,
      smoothY: posY,
      color: colors[i] || '#888888'
    })
  }
}

// Monster with state machine - spawns at random healing point
const getRandomNestPosition = (excludeIndex?: number): Vector2 => {
  // Use randomized healingPoints array instead of config nests
  let availablePoints = healingPoints.filter((_, i) => i !== excludeIndex)
  if (availablePoints.length === 0) availablePoints = [...healingPoints]
  
  const randomIndex = Math.floor(Math.random() * availablePoints.length)
  const hp = availablePoints[randomIndex]!
  return {
    x: hp.position.x,
    y: hp.position.y
  }
}

// Support for multiple monsters based on difficulty
const monsters = reactive<Monster[]>([])

// Create a single monster with random type from pool
const createMonster = (monsterId: number, spawnPos: Vector2): Monster => {
  const mConfig = monsterConfig.value
  
  // Get random monster type from pool
  const monsterType = getRandomMonsterType()
  
  // Create monster with the random type
  const monster = createMonsterFromType(
    monsterId,
    monsterType,
    spawnPos,
    healingPoints.map(hp => ({ x: hp.position.x, y: hp.position.y })),
    mConfig.baseLevelTime,
    mConfig.levelTimeIncrement
  )
  
  // Override some values from difficulty config
  monster.maxHp = monsterType.maxHp // Use type's base HP
  monster.hp = monster.maxHp
  monster.speed = monsterType.speed
  monster.baseSpeed = monsterType.speed
  
  return monster
}

// Initialize monsters based on difficulty
const initMonsters = () => {
  monsters.length = 0
  const count = monsterConfig.value.count
  
  for (let i = 0; i < count; i++) {
    const spawnPos = getRandomNestPosition(i > 0 ? i - 1 : undefined)
    monsters.push(createMonster(i, spawnPos))
  }
}

// Helper to get first monster (for backward compatibility in UI)
const getFirstMonster = () => monsters[0]

// Defense buildings
const buildings = reactive<DefenseBuilding[]>([])
const vanguards = reactive<VanguardUnit[]>([])
const particles = reactive<Particle[]>([])
const projectiles = reactive<Projectile[]>([])
const floatingTexts = reactive<FloatingText[]>([])
let floatingTextId = 0
let vanguardIdCounter = 0

// Healing Points with Mana Power system - initialized dynamically
// Healing points spawn at random positions near the 4 corners of the map
const healingPoints = reactive<HealingPoint[]>([])

const initHealingPoints = () => {
  healingPoints.length = 0
  const hpConfig = healingPointConfig.value
  const cellSize = mapConfig.value.cellSize
  const gridCols = mapConfig.value.gridCols
  const gridRows = mapConfig.value.gridRows
  
  // Define corner zones for random placement (dynamic based on map size)
  const zoneWidth = Math.max(8, Math.floor(gridCols * 0.15))
  const zoneHeight = Math.max(8, Math.floor(gridRows * 0.15))
  
  const cornerZones = [
    { name: 'top-left', minX: 2, maxX: zoneWidth, minY: 2, maxY: zoneHeight },
    { name: 'top-right', minX: gridCols - zoneWidth, maxX: gridCols - 2, minY: 2, maxY: zoneHeight },
    { name: 'bottom-left', minX: 2, maxX: zoneWidth, minY: gridRows - zoneHeight, maxY: gridRows - 2 },
    { name: 'bottom-right', minX: gridCols - zoneWidth, maxX: gridCols - 2, minY: gridRows - zoneHeight, maxY: gridRows - 2 },
  ]
  
  // Shuffle corners for random placement
  const shuffledCorners = cornerZones.sort(() => Math.random() - 0.5)
  
  // Get the configured nests (may have fewer entries than corners)
  const configNests = healingPointNests.value
  const nestCount = Math.min(configNests.length, shuffledCorners.length)
  
  for (let i = 0; i < nestCount; i++) {
    const corner = shuffledCorners[i]!
    const configNest = configNests[i]!
    
    // Random position within the corner zone
    const randomX = corner.minX + Math.floor(Math.random() * (corner.maxX - corner.minX - configNest.width))
    const randomY = corner.minY + Math.floor(Math.random() * (corner.maxY - corner.minY - configNest.height))
    
    healingPoints.push({
      id: i,
      position: {
        x: (randomX + configNest.width / 2) * cellSize,
        y: (randomY + configNest.height / 2) * cellSize
      },
      gridX: randomX,
      gridY: randomY,
      width: configNest.width,
      height: configNest.height,
      manaPower: hpConfig.maxMana,
      maxManaPower: hpConfig.maxMana,
      manaRegenRate: hpConfig.manaRegenRate
    })
  }
}

const humanPlayer = computed(() => players.find(p => p.isHuman)!)

// Get the room owned by human player (for repair button)
const playerOwnedRoom = computed(() => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null || humanPlayer.value.roomId === undefined) return null
  return rooms[humanPlayer.value.roomId] || null
})

// Check if a door is passable for a specific entity
const isDoorPassable = (room: Room, entityId: number, isMonster: boolean = false): boolean => {
  // Door broken = always passable
  if (room.doorHp <= 0) return true
  
  // Monster cannot pass through intact doors
  if (isMonster) return false
  
  // Owner can always enter their own room
  if (room.ownerId === entityId) return true
  
  // Unowned rooms are open
  if (room.ownerId === null) return true
  
  // Check if someone is sleeping in the room (door locked)
  const sleepingPlayers = players.filter(p => p.alive && p.roomId === room.id && p.isSleeping)
  if (sleepingPlayers.length > 0) {
    // Only the sleeping player can pass
    return sleepingPlayers.some(p => p.id === entityId)
  }
  
  return true
}

// Create walkable grid for pathfinding (considers door states and room access)
// isVanguard: vanguard units can pass through all doors and buildings
const createWalkableGrid = (entityId: number, isMonster: boolean = false, isVanguard: boolean = false): GridCell[][] => {
  const walkableGrid: GridCell[][] = []
  
  for (let y = 0; y < grid.length; y++) {
    const row: GridCell[] = []
    for (let x = 0; x < grid[y]!.length; x++) {
      const cell = grid[y]![x]!
      let newCell = { ...cell }
      
      // Handle door cells
      if (cell.type === 'door' && cell.roomId !== undefined) {
        const room = rooms[cell.roomId]
        if (room) {
          // Vanguard can pass through ANY door freely
          if (isVanguard) {
            newCell.walkable = true
          }
          // Monster can walk TO door cells to attack them, but can't pass through intact doors
          // When door is broken, monster can pass through
          else if (isMonster) {
            newCell.walkable = true // Monster can always path TO the door cell
          } else {
            newCell.walkable = isDoorPassable(room, entityId, false)
          }
        }
      }
      // Handle room interior cells
      else if (cell.type === 'room' && cell.roomId !== undefined) {
        const room = rooms[cell.roomId]
        if (room) {
          // Vanguard can enter ANY room freely
          if (isVanguard) {
            newCell.walkable = true
          }
          // Monster can only enter if door is broken
          else if (isMonster) {
            newCell.walkable = room.doorHp <= 0
          } else {
            // Can only walk in room if we own it or it's accessible
            const canAccessRoom = isDoorPassable(room, entityId, false)
            newCell.walkable = canAccessRoom
          }
        }
      }
      // Wall cells are never walkable
      else if (cell.type === 'wall') {
        newCell.walkable = false
      }
      
      row.push(newCell)
    }
    walkableGrid.push(row)
  }
  
  return walkableGrid
}

// Add message
const addMessage = (msg: string) => {
  messageLog.value.unshift(`[${Math.floor(Date.now() / 1000) % 1000}] ${msg}`)
  if (messageLog.value.length > 15) messageLog.value.pop()
}

// Spawn particles
const spawnParticles = (pos: Vector2, type: Particle['type'], count: number, color: string) => {
  for (let i = 0; i < count; i++) {
    particles.push({
      position: { x: pos.x, y: pos.y },
      velocity: { x: (Math.random() - 0.5) * 120, y: (Math.random() - 0.5) * 120 - 60 },
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      color,
      size: 4 + Math.random() * 5,
      type
    })
  }
}

// Screen shake effect
const triggerScreenShake = (intensity: number, duration: number) => {
  cameraShake.intensity = intensity
  cameraShake.duration = duration
}

// Update screen shake
const updateScreenShake = (deltaTime: number) => {
  if (cameraShake.duration > 0) {
    cameraShake.duration -= deltaTime
    cameraShake.x = (Math.random() - 0.5) * 2 * cameraShake.intensity
    cameraShake.y = (Math.random() - 0.5) * 2 * cameraShake.intensity
    
    // Decay intensity over time
    cameraShake.intensity *= 0.95
  } else {
    cameraShake.x = 0
    cameraShake.y = 0
    cameraShake.intensity = 0
  }
}

// Spawn floating text for damage/gold feedback
const spawnFloatingText = (pos: Vector2, text: string, color: string, size: number = 16) => {
  floatingTexts.push({
    id: floatingTextId++,
    position: { x: pos.x, y: pos.y },
    text,
    color,
    life: 1.2,
    maxLife: 1.2,
    velocity: { x: (Math.random() - 0.5) * 30, y: -60 },
    size
  })
}

// Calculate gold per second based on bed income (doubling scaling)
const getGoldPerSecond = (room: Room): number => {
  return room.bedIncome || GAME_CONSTANTS.BED_BASE_INCOME
}

// Calculate building stats based on level - uses entity-specific scales
const getBuildingDamage = (baseDamage: number, level: number, buildingType: string = 'turret'): number => {
  const config = getBuildingConfig(buildingType as BuildingType)
  const damageScale = ('damageScale' in config && config.damageScale) ? config.damageScale : 1.1
  return Math.floor(baseDamage * Math.pow(damageScale, level - 1))
}

const getBuildingRange = (baseRange: number, level: number, buildingType: string = 'turret'): number => {
  const config = getBuildingConfig(buildingType as BuildingType)
  const rangeScale = ('rangeScale' in config && config.rangeScale) ? config.rangeScale : 1.2
  return Math.floor(baseRange * Math.pow(rangeScale, level - 1))
}

/**
 * Check if any healing point has enough mana for healing
 */
const hasAnyHealingPointWithMana = (): boolean => {
  const hConfig = healingPointConfig.value
  const minManaToStart = hConfig.maxMana * hConfig.minManaPercent
  return healingPoints.some(hp => hp.manaPower >= minManaToStart)
}

/**
 * Check if monster should reactivate fleeing mode after taking damage
 * This is called when monster takes damage and was previously interrupted from healing
 * If HP is still below heal threshold (20%) AND there's a healing point with mana, trigger fleeing again
 */
const checkMonsterFleeReactivation = (monster: Monster): void => {
  const mConfig = monsterConfig.value
  const hpRatio = monster.hp / monster.maxHp
  
  // If healing was interrupted and HP is still below threshold, check if can re-flee
  if (monster.healingInterrupted && hpRatio < mConfig.healThreshold) {
    // Only re-trigger fleeing if there's a healing point with enough mana
    if (hasAnyHealingPointWithMana()) {
      monster.isRetreating = true
      monster.isFullyHealing = true
      monster.healingInterrupted = false // Reset flag
      monster.targetPlayerId = null
      monster.targetVanguardId = null
      monster.targetTimer = 0
      monster.speed = monster.baseSpeed * mConfig.retreatSpeedBonus
      monster.monsterState = 'retreat'
      spawnFloatingText(monster.position, '🏃 Trốn!', '#fbbf24', 14)
      addMessage(t('messages.monsterRetreating'))
    }
    // If no healing point has mana, keep healingInterrupted = true
    // Monster will continue fighting until a healing point regenerates mana
  }
}

// Camera drag handlers - LEFT CLICK to drag camera
const isMouseDown = ref(false)
const hasDragged = ref(false) // Track if mouse actually moved (vs just click)
const DRAG_THRESHOLD = 5 // Pixels of movement before considered a drag

const handleMouseDown = (e: MouseEvent) => {
  if (e.button === 0) { // Left click
    isMouseDown.value = true
    hasDragged.value = false
    dragStart.x = e.clientX
    dragStart.y = e.clientY
    cameraStart.x = camera.x
    cameraStart.y = camera.y
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (isMouseDown.value) {
    const dx = dragStart.x - e.clientX
    const dy = dragStart.y - e.clientY
    const dragDistance = Math.sqrt(dx * dx + dy * dy)
    
    // Only start dragging if moved beyond threshold
    if (dragDistance > DRAG_THRESHOLD) {
      hasDragged.value = true
      isDragging.value = true
      cameraManualMode.value = true
      const pad = GAME_CONSTANTS.CAMERA_PADDING
      camera.x = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_WIDTH - viewportWidth.value + pad, cameraStart.x + dx))
      camera.y = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight.value + pad, cameraStart.y + dy))
    }
  }
}

const handleMouseUp = () => {
  isMouseDown.value = false
  isDragging.value = false
}

// Continuous movement input state (for smooth movement)
const moveInput = reactive({ up: false, down: false, left: false, right: false })

// Keyboard handler for WASD/Arrow keys
const handleKeyDown = (e: KeyboardEvent) => {
  if (gamePhase.value !== 'playing') return
  if (!humanPlayer.value?.alive || humanPlayer.value.isSleeping) return
  
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup': moveInput.up = true; e.preventDefault(); break
    case 's': case 'arrowdown': moveInput.down = true; e.preventDefault(); break
    case 'a': case 'arrowleft': moveInput.left = true; e.preventDefault(); break
    case 'd': case 'arrowright': moveInput.right = true; e.preventDefault(); break
  }
}

const handleKeyUp = (e: KeyboardEvent) => {
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup': moveInput.up = false; break
    case 's': case 'arrowdown': moveInput.down = false; break
    case 'a': case 'arrowleft': moveInput.left = false; break
    case 'd': case 'arrowright': moveInput.right = false; break
  }
}

// Touch/button handlers for mobile are now handled by the joystick
const stopMove = () => {
  moveInput.up = false
  moveInput.down = false
  moveInput.left = false
  moveInput.right = false
}

// Joystick state for mobile controls
const joystickRef = ref<HTMLDivElement | null>(null)
const joystickActive = ref(false)
const joystickPosition = reactive({ x: 0, y: 0 }) // -1 to 1 normalized position
const joystickStartTouch = reactive({ x: 0, y: 0 })
const JOYSTICK_RADIUS = 45 // Radius of the outer joystick circle
const JOYSTICK_DEAD_ZONE = 0.15 // Dead zone threshold

const handleJoystickStart = (e: TouchEvent | MouseEvent) => {
  e.preventDefault()
  joystickActive.value = true
  
  if (e instanceof TouchEvent && e.touches[0]) {
    joystickStartTouch.x = e.touches[0].clientX
    joystickStartTouch.y = e.touches[0].clientY
  } else if (e instanceof MouseEvent) {
    joystickStartTouch.x = e.clientX
    joystickStartTouch.y = e.clientY
  }
}

const handleJoystickMove = (e: TouchEvent | MouseEvent) => {
  if (!joystickActive.value) return
  e.preventDefault()
  
  let clientX = 0, clientY = 0
  if (e instanceof TouchEvent && e.touches[0]) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else if (e instanceof MouseEvent) {
    clientX = e.clientX
    clientY = e.clientY
  }
  
  // Calculate delta from joystick center
  const dx = clientX - joystickStartTouch.x
  const dy = clientY - joystickStartTouch.y
  
  // Calculate distance and clamp to radius
  const dist = Math.sqrt(dx * dx + dy * dy)
  const clampedDist = Math.min(dist, JOYSTICK_RADIUS)
  
  // Normalize direction
  if (dist > 0) {
    const normalizedX = (dx / dist) * clampedDist
    const normalizedY = (dy / dist) * clampedDist
    
    // Set joystick position for visual feedback (in pixels, clamped)
    joystickPosition.x = normalizedX
    joystickPosition.y = normalizedY
    
    // Convert to normalized -1 to 1 range for input
    const inputX = normalizedX / JOYSTICK_RADIUS
    const inputY = normalizedY / JOYSTICK_RADIUS
    
    // Apply dead zone and update movement input
    moveInput.left = inputX < -JOYSTICK_DEAD_ZONE
    moveInput.right = inputX > JOYSTICK_DEAD_ZONE
    moveInput.up = inputY < -JOYSTICK_DEAD_ZONE
    moveInput.down = inputY > JOYSTICK_DEAD_ZONE
  }
}

const handleJoystickEnd = () => {
  joystickActive.value = false
  joystickPosition.x = 0
  joystickPosition.y = 0
  stopMove()
}

// Touch handlers for canvas panning - SINGLE FINGER drag
const isTouchDown = ref(false)
const hasTouchDragged = ref(false)
const touchStart = reactive({ x: 0, y: 0 })

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 1 && e.touches[0]) {
    isTouchDown.value = true
    hasTouchDragged.value = false
    touchStart.x = e.touches[0].clientX
    touchStart.y = e.touches[0].clientY
    dragStart.x = e.touches[0].clientX
    dragStart.y = e.touches[0].clientY
    cameraStart.x = camera.x
    cameraStart.y = camera.y
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (isTouchDown.value && e.touches.length === 1 && e.touches[0]) {
    const dx = touchStart.x - e.touches[0].clientX
    const dy = touchStart.y - e.touches[0].clientY
    const dragDistance = Math.sqrt(dx * dx + dy * dy)
    
    if (dragDistance > DRAG_THRESHOLD) {
      hasTouchDragged.value = true
      isDragging.value = true
      cameraManualMode.value = true
      const pad = GAME_CONSTANTS.CAMERA_PADDING
      camera.x = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_WIDTH - viewportWidth.value + pad, cameraStart.x + dx))
      camera.y = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight.value + pad, cameraStart.y + dy))
    }
  }
}

const handleTouchEnd = () => {
  // If didn't drag, simulate a click at touch position
  if (isTouchDown.value && !hasTouchDragged.value && canvasRef.value) {
    // Create synthetic click event for UI interaction
    const rect = canvasRef.value.getBoundingClientRect()
    const scaleX = viewportWidth.value / rect.width
    const scaleY = viewportHeight.value / rect.height
    const x = (touchStart.x - rect.left) * scaleX
    const y = (touchStart.y - rect.top) * scaleY
    handleTouchTap(x, y)
  }
  isTouchDown.value = false
  isDragging.value = false
}

// Handle touch tap (similar to canvas click but for touch)
const handleTouchTap = (x: number, y: number) => {
  if (!canvasRef.value) return
  
  const worldX = x + camera.x
  const worldY = y + camera.y
  
  const cellX = Math.floor(worldX / GAME_CONSTANTS.CELL_SIZE)
  const cellY = Math.floor(worldY / GAME_CONSTANTS.CELL_SIZE)
  
  if (!grid[cellY]?.[cellX]) return
  const cell = grid[cellY][cellX]
  
  if (gamePhase.value === 'playing' && humanPlayer.value?.alive) {
    const myRoom = humanPlayer.value.roomId !== null ? rooms.find(r => r.id === humanPlayer.value!.roomId) : null
    
    // Door interaction
    if (cell.type === 'door' && cell.roomId !== undefined) {
      const clickedRoom = rooms.find(r => r.id === cell.roomId)
      if (clickedRoom && clickedRoom.ownerId === humanPlayer.value.id) {
        const distToDoor = distance(humanPlayer.value.position, clickedRoom.doorPosition)
        // Allow from anywhere when sleeping
        if (humanPlayer.value.isSleeping || distToDoor < GAME_CONSTANTS.CELL_SIZE * 4) {
          openUpgradeModal({ type: 'door', room: clickedRoom })
          return
        }
      }
    }
    
    // Bed/building/build spot interactions (same as handleCanvasClick)
    if (myRoom) {
      const distToBedClick = distance({ x: worldX, y: worldY }, myRoom.bedPosition)
      if (distToBedClick < 40) {
        const playerDistToBed = distance(humanPlayer.value.position, myRoom.bedPosition)
        // Allow when sleeping OR close enough
        if (humanPlayer.value.isSleeping || playerDistToBed < GAME_CONSTANTS.BED_INTERACT_RANGE) {
          if (humanPlayer.value.isSleeping) {
            openUpgradeModal({ type: 'bed', room: myRoom })
            return
          } else {
            humanPlayer.value.isSleeping = true
            humanPlayer.value.state = 'sleeping'
            humanPlayer.value.position.x = myRoom.bedPosition.x
            humanPlayer.value.position.y = myRoom.bedPosition.y
            humanPlayer.value.targetPosition = null
            humanPlayer.value.path = []
            playSfx('click')
            addMessage('Started sleeping - earning gold!')
            return
          }
        }
        return
      }
      
      // Building upgrade
      for (const building of buildings) {
        if (building.ownerId !== humanPlayer.value.id || building.hp <= 0) continue
        const bPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
        const distToBuilding = distance({ x: worldX, y: worldY }, bPos)
        if (distToBuilding < 35) {
          const playerDistToBuilding = distance(humanPlayer.value.position, bPos)
          if (playerDistToBuilding < GAME_CONSTANTS.CELL_SIZE * 3 || humanPlayer.value.isSleeping) {
            openUpgradeModal({ type: 'building', building })
            return
          }
        }
      }
      
      // Build spot
      for (const spot of myRoom.buildSpots) {
        if (!spot) continue
        // Skip destroyed spots (cannot rebuild)
        if (spot.isDestroyed) continue
        
        const distToSpot = distance({ x: worldX, y: worldY }, spot)
        if (distToSpot < 30) {
          const existingBuilding = buildings.find(b => 
            b.hp > 0 &&
            Math.abs(gridToWorld({ x: b.gridX, y: b.gridY }, GAME_CONSTANTS.CELL_SIZE).x - spot.x) < 30 &&
            Math.abs(gridToWorld({ x: b.gridX, y: b.gridY }, GAME_CONSTANTS.CELL_SIZE).y - spot.y) < 30
          )
          if (!existingBuilding) {
            selectedBuildSpot.value = { 
              x: Math.floor(spot.x / GAME_CONSTANTS.CELL_SIZE), 
              y: Math.floor(spot.y / GAME_CONSTANTS.CELL_SIZE),
              roomId: myRoom.id
            }
            showBuildPopup.value = true
            playSfx('click')
            return
          }
        }
      }
    }
  }
}

// Handle canvas click - UI ONLY interactions, no movement
const handleCanvasClick = (e: MouseEvent) => {
  // Ignore if was dragging camera (moved beyond threshold)
  if (hasDragged.value || !canvasRef.value) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const scaleX = viewportWidth.value / rect.width
  const scaleY = viewportHeight.value / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY
  
  const worldX = x + camera.x
  const worldY = y + camera.y
  
  const cellX = Math.floor(worldX / GAME_CONSTANTS.CELL_SIZE)
  const cellY = Math.floor(worldY / GAME_CONSTANTS.CELL_SIZE)
  
  if (!grid[cellY]?.[cellX]) return
  const cell = grid[cellY][cellX]
  
  // Game is always in playing phase - only UI interactions allowed via click
  if (gamePhase.value === 'playing' && humanPlayer.value?.alive) {
    // Check if player owns a room - use their owned room for building/upgrading
    const myRoom = humanPlayer.value.roomId !== null ? rooms.find(r => r.id === humanPlayer.value!.roomId) : null
    
    // DOOR CLICK INTERACTION: Click on any door cell to show upgrade modal (UI only)
    if (cell.type === 'door' && cell.roomId !== undefined) {
      const clickedRoom = rooms.find(r => r.id === cell.roomId)
      if (clickedRoom && clickedRoom.ownerId === humanPlayer.value.id) {
        // Player owns this door - show upgrade modal
        // Allow from anywhere when sleeping, otherwise check distance
        const distToDoor = distance(humanPlayer.value.position, clickedRoom.doorPosition)
        if (humanPlayer.value.isSleeping || distToDoor < GAME_CONSTANTS.CELL_SIZE * 4) {
          openUpgradeModal({ type: 'door', room: clickedRoom })
          return
        }
        // If too far, do nothing (no auto-move)
        return
      }
    }
    
    // MODAL UPGRADE INTERACTION: Click on bed to show upgrade modal (or sleep if not sleeping)
    if (myRoom) {
      const distToBedClick = distance({ x: worldX, y: worldY }, myRoom.bedPosition)
      if (distToBedClick < 40) {
        const playerDistToBed = distance(humanPlayer.value.position, myRoom.bedPosition)
        // Allow bed interaction when sleeping OR when close enough
        if (humanPlayer.value.isSleeping || playerDistToBed < GAME_CONSTANTS.BED_INTERACT_RANGE) {
          // If sleeping, show upgrade modal. Otherwise start sleeping.
          if (humanPlayer.value.isSleeping) {
            // Show upgrade modal for bed
            openUpgradeModal({ type: 'bed', room: myRoom })
            return
          } else {
            // Start sleeping
            humanPlayer.value.isSleeping = true
            humanPlayer.value.state = 'sleeping'
            humanPlayer.value.position.x = myRoom.bedPosition.x
            humanPlayer.value.position.y = myRoom.bedPosition.y
            humanPlayer.value.targetPosition = null
            humanPlayer.value.path = []
            playSfx('click')
            addMessage(t('messages.startedSleeping'))
            return
          }
        }
        // If too far to bed, do nothing (no auto-move)
        return
      }
      
      // MODAL UPGRADE: Click on existing building to show upgrade/sell modal (UI only)
      for (const building of buildings) {
        if (building.ownerId !== humanPlayer.value.id || building.hp <= 0) continue
        const bPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
        const distToBuilding = distance({ x: worldX, y: worldY }, bPos)
        if (distToBuilding < 35) {
          const playerDistToBuilding = distance(humanPlayer.value.position, bPos)
          if (playerDistToBuilding < GAME_CONSTANTS.CELL_SIZE * 3 || humanPlayer.value.isSleeping) {
            // Show upgrade modal for building (allow from anywhere when sleeping)
            openUpgradeModal({ type: 'building', building })
            return
          }
        }
      }
      
      // Check if clicking on build spot in OWN room (can build while awake or sleeping)
      for (const spot of myRoom.buildSpots) {
        if (!spot) continue
        // Skip destroyed spots (cannot rebuild)
        if (spot.isDestroyed) continue
        
        const distToSpot = distance({ x: worldX, y: worldY }, spot)
        if (distToSpot < 30) {
          // Check if spot already has ALIVE building (hp > 0)
          const existingBuilding = buildings.find(b => 
            b.hp > 0 &&
            Math.abs(gridToWorld({ x: b.gridX, y: b.gridY }, GAME_CONSTANTS.CELL_SIZE).x - spot.x) < 30 &&
            Math.abs(gridToWorld({ x: b.gridX, y: b.gridY }, GAME_CONSTANTS.CELL_SIZE).y - spot.y) < 30
          )
          if (!existingBuilding) {
            selectedBuildSpot.value = { 
              x: Math.floor(spot.x / GAME_CONSTANTS.CELL_SIZE), 
              y: Math.floor(spot.y / GAME_CONSTANTS.CELL_SIZE),
              roomId: myRoom.id
            }
            showBuildPopup.value = true
            playSfx('click')
            return
          } else {
            // Spot has building - try to upgrade it instead
            addMessage(t('messages.spotHasBuilding'))
            return
          }
        }
      }
    }
    
    // NO CLICK-TO-MOVE - movement is only via directional controls
    // Click on canvas does nothing for movement
  }
}

// Go to sleep (when near bed) - auto positions on bed and CLAIMS ROOM
const goToSleep = () => {
  if (!humanPlayer.value || humanPlayer.value.isSleeping) return
  
  // Find the room the player is currently in based on their position
  const cellX = Math.floor(humanPlayer.value.position.x / GAME_CONSTANTS.CELL_SIZE)
  const cellY = Math.floor(humanPlayer.value.position.y / GAME_CONSTANTS.CELL_SIZE)
  const cell = grid[cellY]?.[cellX]
  
  // Must be inside a room cell
  if (!cell || (cell.type !== 'room' && cell.type !== 'door')) {
    addMessage(t('messages.mustBeInRoom'))
    return
  }
  
  const currentRoomId = cell.roomId
  if (currentRoomId === undefined) return
  
  const currentRoom = rooms[currentRoomId]
  if (!currentRoom) return
  
  // Check if room is available or already owned by this player
  if (currentRoom.ownerId !== null && currentRoom.ownerId !== humanPlayer.value.id) {
    addMessage(t('messages.roomAlreadyClaimed'))
    return
  }
  
  const distToBed = distance(humanPlayer.value.position, currentRoom.bedPosition)
  if (distToBed < GAME_CONSTANTS.BED_INTERACT_RANGE) {
    // CLAIM THE ROOM by sleeping!
    if (currentRoom.ownerId === null) {
      currentRoom.ownerId = humanPlayer.value.id
      humanPlayer.value.roomId = currentRoom.id
      addMessage(t('messages.claimedRoom', { roomId: currentRoom.id }))
    }
    
    // Auto-position player on the bed
    humanPlayer.value.position.x = currentRoom.bedPosition.x
    humanPlayer.value.position.y = currentRoom.bedPosition.y
    humanPlayer.value.smoothX = currentRoom.bedPosition.x
    humanPlayer.value.smoothY = currentRoom.bedPosition.y
    humanPlayer.value.isSleeping = true
    humanPlayer.value.sleepTimer = 0
    humanPlayer.value.state = 'sleeping'
    humanPlayer.value.path = []
    humanPlayer.value.targetPosition = null
    playSfx('click')
    addMessage(t('messages.startedSleepingWithGold', { gold: getGoldPerSecond(currentRoom) }))
  } else {
    addMessage(t('messages.getCloserToBed'))
  }
}

// Mobile control: move player in direction
// Continuous movement update - called every frame
const updatePlayerMovement = (deltaTime: number) => {
  if (!humanPlayer.value || !humanPlayer.value.alive || humanPlayer.value.isSleeping) return
  if (gamePhase.value !== 'playing') return
  
  // Check if any movement input is active
  const hasInput = moveInput.up || moveInput.down || moveInput.left || moveInput.right
  if (!hasInput) {
    // No input - let pathfinding finish if there's a path
    return
  }
  
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
  const speed = humanPlayer.value.speed * deltaTime
  let newX = humanPlayer.value.position.x + dx * speed
  let newY = humanPlayer.value.position.y + dy * speed
  
  // Clamp to world bounds
  newX = Math.max(GAME_CONSTANTS.CELL_SIZE, Math.min(GAME_CONSTANTS.WORLD_WIDTH - GAME_CONSTANTS.CELL_SIZE, newX))
  newY = Math.max(GAME_CONSTANTS.CELL_SIZE, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - GAME_CONSTANTS.CELL_SIZE, newY))
  
  // Check collision at new position
  const cellX = Math.floor(newX / GAME_CONSTANTS.CELL_SIZE)
  const cellY = Math.floor(newY / GAME_CONSTANTS.CELL_SIZE)
  
  if (!grid[cellY]?.[cellX]) return
  const cell = grid[cellY][cellX]
  
  // WALL COLLISION: Block wall cells
  if (cell.type === 'wall') {
    // Try sliding along walls
    const cellXOnly = Math.floor((humanPlayer.value.position.x + dx * speed) / GAME_CONSTANTS.CELL_SIZE)
    const cellYOnly = Math.floor((humanPlayer.value.position.y + dy * speed) / GAME_CONSTANTS.CELL_SIZE)
    
    // Try X only
    const cellAtX = grid[Math.floor(humanPlayer.value.position.y / GAME_CONSTANTS.CELL_SIZE)]?.[cellXOnly]
    if (cellAtX && cellAtX.type !== 'wall') {
      newX = humanPlayer.value.position.x + dx * speed
      newY = humanPlayer.value.position.y
    } 
    // Try Y only
    else {
      const cellAtY = grid[cellYOnly]?.[Math.floor(humanPlayer.value.position.x / GAME_CONSTANTS.CELL_SIZE)]
      if (cellAtY && cellAtY.type !== 'wall') {
        newX = humanPlayer.value.position.x
        newY = humanPlayer.value.position.y + dy * speed
      } else {
        return // Completely blocked
      }
    }
  }
  
  // Check room entry
  const finalCellX = Math.floor(newX / GAME_CONSTANTS.CELL_SIZE)
  const finalCellY = Math.floor(newY / GAME_CONSTANTS.CELL_SIZE)
  const finalCell = grid[finalCellY]?.[finalCellX]
  
  if (finalCell && (finalCell.type === 'room' || finalCell.type === 'door') && finalCell.roomId !== undefined) {
    const room = rooms[finalCell.roomId]
    if (room && !isDoorPassable(room, humanPlayer.value.id, false)) {
      return // Door locked
    }
  }
  
  // Apply movement
  if (finalCell && (finalCell.walkable || finalCell.type === 'door' || finalCell.type === 'room')) {
    humanPlayer.value.position.x = newX
    humanPlayer.value.position.y = newY
    humanPlayer.value.state = 'walking'
    humanPlayer.value.path = [] // Clear pathfinding - using direct movement
    humanPlayer.value.targetPosition = null
    
    // Update facing direction
    if (dx > 0) humanPlayer.value.facingRight = true
    else if (dx < 0) humanPlayer.value.facingRight = false
    
    // Update animation
    humanPlayer.value.animationTimer += deltaTime
    if (humanPlayer.value.animationTimer >= GAME_CONSTANTS.ANIMATION_SPEED) {
      humanPlayer.value.animationFrame = (humanPlayer.value.animationFrame + 1) % 4
      humanPlayer.value.animationTimer = 0
    }
  }
}

// Reset camera to follow player
const resetCameraToPlayer = () => {
  cameraManualMode.value = false
  addMessage(t('messages.cameraFollowing'))
}

// Navigate camera to a specific player's room
const navigateToPlayer = (player: Player) => {
  cameraManualMode.value = true
  const targetX = player.smoothX - viewportWidth.value / 2
  const targetY = player.smoothY - viewportHeight.value / 2
  const pad = GAME_CONSTANTS.CAMERA_PADDING
  camera.x = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_WIDTH - viewportWidth.value + pad, targetX))
  camera.y = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight.value + pad, targetY))
}

// Navigate camera to monster's current position
const navigateToMonster = () => {
  cameraManualMode.value = true
  const m = getFirstMonster()
  if (!m) return
  const targetX = m.position.x - viewportWidth.value / 2
  const targetY = m.position.y - viewportHeight.value / 2
  const pad = GAME_CONSTANTS.CAMERA_PADDING
  const wWidth = mapConfig.value.gridCols * mapConfig.value.cellSize
  const wHeight = mapConfig.value.gridRows * mapConfig.value.cellSize
  camera.x = Math.max(-pad, Math.min(wWidth - viewportWidth.value + pad, targetX))
  camera.y = Math.max(-pad, Math.min(wHeight - viewportHeight.value + pad, targetY))
}

// Focus camera on a specific monster (for navbar monster cards)
const focusOnMonster = (monster: Monster) => {
  cameraManualMode.value = true
  const targetX = monster.position.x - viewportWidth.value / 2
  const targetY = monster.position.y - viewportHeight.value / 2
  const pad = GAME_CONSTANTS.CAMERA_PADDING
  const wWidth = mapConfig.value.gridCols * mapConfig.value.cellSize
  const wHeight = mapConfig.value.gridRows * mapConfig.value.cellSize
  camera.x = Math.max(-pad, Math.min(wWidth - viewportWidth.value + pad, targetX))
  camera.y = Math.max(-pad, Math.min(wHeight - viewportHeight.value + pad, targetY))
}

// Build defense (only in rooms)
// ATM mua bằng LINH HỒN, các loại khác mua bằng VÀNG
const buildDefense = (type: DefenseBuilding['type']) => {
  if (!selectedBuildSpot.value || !humanPlayer.value) return
  
  // ATM uses souls, others use gold
  if (type === 'atm') {
    const soulCost = GAME_CONSTANTS.SOUL_COSTS.atm
    if (humanPlayer.value.souls < soulCost) {
      addMessage(t('messages.notEnoughSouls'))
      return
    }
    humanPlayer.value.souls -= soulCost
  } else {
    // Get cost from COSTS (gold)
    const cost = GAME_CONSTANTS.COSTS[type as keyof typeof GAME_CONSTANTS.COSTS] || 0
    if (humanPlayer.value.gold < cost) {
      addMessage(t('messages.notEnoughGold'))
      return
    }
    humanPlayer.value.gold -= cost
  }
  
  const stats = GAME_CONSTANTS.BUILDINGS[type]
  const { x, y, roomId } = selectedBuildSpot.value
  
  const building: DefenseBuilding = {
    id: buildings.length,
    type,
    level: 1,
    gridX: x,
    gridY: y,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    baseDamage: stats.damage,
    range: stats.range,
    baseRange: stats.range,
    cooldown: stats.cooldown,
    currentCooldown: 0,
    ownerId: humanPlayer.value.id,
    animationFrame: 0,
    rotation: 0,
    upgradeCost: stats.upgradeCost,
    soulCost: 0, // No soul cost at level 1
    goldRate: 'goldRate' in stats ? stats.goldRate : undefined,
    soulRate: 'soulRate' in stats ? stats.soulRate : undefined,
    // SMG specific
    burstCount: type === 'smg' ? GAME_CONSTANTS.SMG.BURST_COUNT : undefined,
    burstIndex: type === 'smg' ? 0 : undefined,
    burstCooldown: type === 'smg' ? 0 : undefined,
  }
  
  buildings.push(building)
  
  // Spawn vanguard units for vanguard buildings
  if (type === 'vanguard') {
    spawnVanguardUnits(building)
  }
  
  playSfx('build')
  spawnParticles(gridToWorld({ x, y }, GAME_CONSTANTS.CELL_SIZE), 'build', 12, '#22c55e')
  spawnFloatingText(gridToWorld({ x, y }, GAME_CONSTANTS.CELL_SIZE), `+${type}!`, '#22c55e', 14)
  addMessage(t('messages.builtInRoom', { type: getBuildingTypeName(type), roomId: roomId }))
  
  showBuildPopup.value = false
  selectedBuildSpot.value = null
}

// Calculate number of vanguard units based on building level
const getVanguardUnitCount = (level: number): number => {
  return 1 + Math.floor(level / 2) // 1 at L1, 2 at L3, 3 at L5, 4 at L7...
}

// Spawn vanguard units for a building
const spawnVanguardUnits = (building: DefenseBuilding) => {
  if (building.type !== 'vanguard') return
  
  const unitCount = getVanguardUnitCount(building.level)
  const buildingPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
  
  // Calculate stats based on building level
  const baseHp = GAME_CONSTANTS.VANGUARD.BASE_HP
  const baseDamage = GAME_CONSTANTS.VANGUARD.BASE_DAMAGE
  const hpScale = GAME_CONSTANTS.VANGUARD.HP_SCALE
  const damageScale = GAME_CONSTANTS.VANGUARD.DAMAGE_SCALE
  
  const unitHp = Math.floor(baseHp * Math.pow(hpScale, building.level - 1))
  const unitDamage = Math.floor(baseDamage * Math.pow(damageScale, building.level - 1))
  
  // Remove existing dead units for this building
  const existingUnits = vanguards.filter(v => v.buildingId === building.id)
  const aliveCount = existingUnits.filter(v => v.state !== 'dead').length
  const deadUnits = existingUnits.filter(v => v.state === 'dead')
  
  // Update dead units' stats when upgrading
  deadUnits.forEach(unit => {
    unit.maxHp = unitHp
    unit.damage = unitDamage
  })
  
  // Spawn new units if needed
  for (let i = aliveCount + deadUnits.length; i < unitCount; i++) {
    const offset = { x: (i % 3 - 1) * 30, y: Math.floor(i / 3) * 30 }
    const unit: VanguardUnit = {
      id: vanguardIdCounter++,
      buildingId: building.id,
      ownerId: building.ownerId,
      hp: unitHp,
      maxHp: unitHp,
      damage: unitDamage,
      speed: GAME_CONSTANTS.PLAYER_SPEED,
      position: { x: buildingPos.x + offset.x, y: buildingPos.y + offset.y },
      targetPosition: null,
      path: [],
      state: 'roaming',
      targetMonsterId: false,
      attackCooldown: 0,
      respawnTimer: 0,
      animationFrame: 0,
      facingRight: true
    }
    vanguards.push(unit)
  }
  
  // Update alive units' stats on upgrade
  existingUnits.filter(v => v.state !== 'dead').forEach(unit => {
    unit.maxHp = unitHp
    unit.hp = unitHp // Full heal on upgrade
    unit.damage = unitDamage
  })
}

// Upgrade bed - cost doubles, income doubles each level
const upgradeBed = () => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null) return
  const room = rooms.find(r => r.id === humanPlayer.value!.roomId)
  if (!room) return
  
  // Check gold cost
  if (humanPlayer.value.gold < room.bedUpgradeCost) {
    addMessage(t('messages.notEnoughGoldNeed', { cost: room.bedUpgradeCost }))
    return
  }
  
  // Check soul cost (from level 5+)
  const soulCost = room.bedSoulCost || 0
  if (soulCost > 0 && humanPlayer.value.souls < soulCost) {
    addMessage(t('messages.notEnoughSoulsNeed', { souls: soulCost }))
    return
  }
  
  humanPlayer.value.gold -= room.bedUpgradeCost
  if (soulCost > 0) {
    humanPlayer.value.souls -= soulCost
  }
  
  room.bedLevel++
  room.bedIncome = room.bedIncome * 2 // Double income
  
  // Calculate next upgrade cost
  const nextLevel = room.bedLevel
  room.bedUpgradeCost = Math.floor(25 * Math.pow(2, nextLevel - 1)) // Base 25g, doubles each level
  room.bedSoulCost = nextLevel >= 4 ? Math.floor(200 * Math.pow(2, nextLevel - 4)) : 0 // 200 souls from level 5+
  
  playSfx('build')
  addMessage(t('messages.bedUpgraded', { level: room.bedLevel, income: room.bedIncome }))
  spawnFloatingText(room.bedPosition, `Bed LV${room.bedLevel}!`, '#fbbf24', 14)
  showUpgradeModal.value = false
}

// Upgrade door - increases HP by 50%, doubles cost each level
const upgradeDoor = () => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null) return
  const room = rooms.find(r => r.id === humanPlayer.value!.roomId)
  if (!room) return
  
  if (room.doorLevel >= 10) {
    addMessage(t('messages.doorMaxLevel'))
    return
  }
  
  // Check gold cost
  if (humanPlayer.value.gold < room.doorUpgradeCost) {
    addMessage(t('messages.notEnoughGold'))
    return
  }
  
  // Check soul cost (from level 5+)
  const soulCost = room.doorSoulCost || 0
  if (soulCost > 0 && humanPlayer.value.souls < soulCost) {
    addMessage(t('messages.notEnoughSoulsNeed', { souls: soulCost }))
    return
  }
  
  humanPlayer.value.gold -= room.doorUpgradeCost
  if (soulCost > 0) {
    humanPlayer.value.souls -= soulCost
  }
  
  room.doorLevel++
  room.doorMaxHp = Math.floor(room.doorMaxHp * 1.5) // +50% HP
  room.doorHp = room.doorMaxHp // Full heal on upgrade!
  
  // Calculate next upgrade cost
  const nextLevel = room.doorLevel
  room.doorUpgradeCost = Math.floor(40 * Math.pow(2, nextLevel - 1)) // Base 40g, doubles each level
  room.doorSoulCost = nextLevel >= 4 ? Math.floor(215 * Math.pow(2, nextLevel - 4)) : 0 // 215 souls from level 5+
  
  playSfx('build')
  addMessage(t('messages.doorUpgraded', { level: room.doorLevel, hp: room.doorMaxHp }))
  spawnFloatingText(room.doorPosition, `Door LV${room.doorLevel}!`, '#60a5fa', 14)
  showUpgradeModal.value = false
}

// Door cannot be rebuilt once destroyed - removed rebuildDoor function

// Start door repair from button (using player's owned room)
const startDoorRepairFromButton = () => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null || humanPlayer.value.roomId === undefined) return
  const room = rooms[humanPlayer.value.roomId]
  if (!room || room.ownerId !== humanPlayer.value.id) return
  
  if (room.doorRepairCooldown > 0) {
    addMessage(t('messages.doorRepairCooldown', { time: Math.ceil(room.doorRepairCooldown) }))
    return
  }
  
  if (room.doorHp >= room.doorMaxHp) {
    addMessage(t('messages.doorFullHp'))
    return
  }
  
  if (room.doorHp <= 0) {
    addMessage('Cửa đã bị phá hủy, cần xây lại!')
    return
  }
  
  room.doorIsRepairing = true
  room.doorRepairTimer = 0
  playSfx('build')
  addMessage(t('messages.doorRepairing'))
}

// Upgrade building from modal - turret: +10% damage, +20% range, double cost
const upgradeBuilding = () => {
  if (!humanPlayer.value || !upgradeTarget.value || upgradeTarget.value.type !== 'building') return
  const building = upgradeTarget.value.building
  if (!building) return
  
  if (building.level >= 10) {
    addMessage(t('messages.buildingMaxLevel', { type: getBuildingTypeName(building.type) }))
    showUpgradeModal.value = false
    return
  }
  
  // ATM: Nâng cấp bằng LINH HỒN (gấp đôi mỗi level)
  if (building.type === 'atm') {
    const soulCost = building.upgradeCost // ATM upgradeCost là souls
    if (humanPlayer.value.souls < soulCost) {
      addMessage(t('messages.needSoulsToUpgrade', { cost: soulCost }))
      return
    }
    humanPlayer.value.souls -= soulCost
  } else {
    // Các loại khác: Check souls at level 5+
    if (building.level >= 4) {
      const soulCost = GAME_CONSTANTS.SOUL_UPGRADE_COST * (building.level - 3)
      if (humanPlayer.value.souls < soulCost) {
        addMessage(t('messages.needSoulsForLevel', { cost: soulCost, level: building.level + 1 }))
        return
      }
      humanPlayer.value.souls -= soulCost
    }
    
    // Check gold
    if (humanPlayer.value.gold < building.upgradeCost) {
      addMessage(t('messages.needGoldToUpgrade', { cost: building.upgradeCost }))
      return
    }
    humanPlayer.value.gold -= building.upgradeCost
  }
  
  building.level++
  
  // Turret: use entity-specific scales from DEFAULT_TURRET_CONFIG
  if (building.type === 'turret') {
    building.damage = getBuildingDamage(building.baseDamage, building.level, 'turret')
    building.range = getBuildingRange(building.baseRange, building.level, 'turret')
  } else if (building.type === 'smg') {
    // SMG: use entity-specific scales from DEFAULT_SMG_CONFIG (damageScale: 1.5, rangeScale: 1.3)
    building.damage = getBuildingDamage(building.baseDamage, building.level, 'smg')
    building.range = getBuildingRange(building.baseRange, building.level, 'smg')
    // SMG requires additional soul cost from level 5+
    if (building.level >= GAME_CONSTANTS.SMG.SOUL_REQUIRED_LEVEL) {
      building.soulCost = GAME_CONSTANTS.SMG.SOUL_COST
    }
  } else if (building.type === 'atm') {
    // ATM: double gold rate
    building.goldRate = GAME_CONSTANTS.ATM_GOLD_LEVELS[Math.min(building.level - 1, 5)] || building.level
  } else if (building.type === 'soul_collector') {
    // Soul Collector: double soul rate
    building.soulRate = GAME_CONSTANTS.SOUL_COLLECTOR_LEVELS[Math.min(building.level - 1, 5)] || building.level
  } else if (building.type === 'vanguard') {
    // Vanguard: spawn/update units with better stats
    spawnVanguardUnits(building)
    addMessage(t('messages.vanguardUpgraded', { units: getVanguardUnitCount(building.level) }))
  } else {
    // Other buildings: standard scaling - use entity-specific scales
    building.damage = getBuildingDamage(building.baseDamage, building.level, building.type as BuildingType)
    building.range = getBuildingRange(building.baseRange, building.level, building.type as BuildingType)
  }
  
  // Double the upgrade cost
  building.upgradeCost = building.upgradeCost * 2
  
  playSfx('build')
  const bPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
  spawnFloatingText(bPos, `LV${building.level}!`, '#60a5fa', 14)
  spawnParticles(bPos, 'build', 8, '#60a5fa')
  addMessage(t('messages.buildingUpgraded', { type: getBuildingTypeName(building.type), level: building.level }))
  showUpgradeModal.value = false
}

// Sell building from modal (refund 40% of current upgrade cost)
const sellBuilding = () => {
  if (!humanPlayer.value || !upgradeTarget.value || upgradeTarget.value.type !== 'building') return
  const building = upgradeTarget.value.building
  if (!building) return
  
  // Refund 40% of current upgrade cost
  const refund = Math.floor(building.upgradeCost * 0.4)
  
  humanPlayer.value.gold += refund
  
  // Remove building
  const bPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
  spawnFloatingText(bPos, `+${refund}g`, '#22c55e', 14)
  spawnParticles(bPos, 'build', 8, '#ef4444')
  
  const idx = buildings.indexOf(building)
  if (idx !== -1) buildings.splice(idx, 1)
  
  playSfx('click')
  addMessage(t('messages.soldBuilding', { type: getBuildingTypeName(building.type), refund: refund }))
  showUpgradeModal.value = false
}

// Open upgrade modal with delay to prevent accidental touches
const openUpgradeModal = (target: { type: 'door' | 'bed' | 'building'; building?: DefenseBuilding; room?: Room }) => {
  upgradeTarget.value = target
  modalInteractive.value = false // Disable interaction initially
  showUpgradeModal.value = true
  playSfx('click')
  
  // Enable interaction after a short delay (300ms) to prevent touch-through
  setTimeout(() => {
    modalInteractive.value = true
  }, 300)
}

// Close upgrade modal
const closeUpgradeModal = () => {
  showUpgradeModal.value = false
  upgradeTarget.value = null
  modalInteractive.value = false
}

// AI select room - AI will go to a room and sleep (claiming via sleeping)
const aiSelectRooms = () => {
  const aiPlayers = players.filter(p => !p.isHuman && p.roomId === null && !p.isSleeping)
  const availableRooms = rooms.filter(r => r.ownerId === null)
  
  aiPlayers.forEach(ai => {
    if (availableRooms.length === 0) return
    const roomIndex = Math.floor(Math.random() * availableRooms.length)
    const room = availableRooms.splice(roomIndex, 1)[0]
    if (!room) return
    
    // Go to bed position (AI will claim room when reaching bed)
    ai.targetPosition = { x: room.bedPosition.x, y: room.bedPosition.y }
    const walkableGrid = createWalkableGrid(ai.id, false)
    ai.path = findPath(walkableGrid, ai.position, ai.targetPosition, GAME_CONSTANTS.CELL_SIZE)
    ai.state = 'walking'
  })
}

// AI claim room when reaching bed during countdown
const aiClaimRoomIfNearBed = (player: Player) => {
  if (player.isHuman || player.roomId !== null || player.isSleeping) return
  
  // Find the room the AI is in
  const cellX = Math.floor(player.position.x / GAME_CONSTANTS.CELL_SIZE)
  const cellY = Math.floor(player.position.y / GAME_CONSTANTS.CELL_SIZE)
  const cell = grid[cellY]?.[cellX]
  
  if (!cell || (cell.type !== 'room' && cell.type !== 'door')) return
  if (cell.roomId === undefined) return
  
  const room = rooms[cell.roomId]
  if (!room || room.ownerId !== null) return
  
  const distToBed = distance(player.position, room.bedPosition)
  if (distToBed < GAME_CONSTANTS.BED_INTERACT_RANGE) {
    // Claim room and sleep!
    room.ownerId = player.id
    player.roomId = room.id
    player.position.x = room.bedPosition.x
    player.position.y = room.bedPosition.y
    player.smoothX = room.bedPosition.x
    player.smoothY = room.bedPosition.y
    player.isSleeping = true
    player.sleepTimer = 0
    player.state = 'sleeping'
    player.path = []
    player.targetPosition = null
  }
}

// Track late players for monster targeting priority
const latePlayers = reactive<number[]>([]) // Player IDs who didn't sleep in time

// Enforce penalty for players not sleeping when game starts
const enforceLatePlayerPenalty = () => {
  latePlayers.length = 0
  
  players.forEach(player => {
    if (!player.alive) return
    
    // Players NOT sleeping when game starts are "late"
    if (!player.isSleeping) {
      latePlayers.push(player.id)
      
      // Eject from any room they might be standing in
      const cellX = Math.floor(player.position.x / GAME_CONSTANTS.CELL_SIZE)
      const cellY = Math.floor(player.position.y / GAME_CONSTANTS.CELL_SIZE)
      const cell = grid[cellY]?.[cellX]
      
      if (cell && (cell.type === 'room' || cell.type === 'door') && cell.roomId !== undefined) {
        // Move player to corridor (center of map)
        const ejectionX = 20 * GAME_CONSTANTS.CELL_SIZE
        const ejectionY = 12 * GAME_CONSTANTS.CELL_SIZE
        player.position.x = ejectionX
        player.position.y = ejectionY
        player.smoothX = ejectionX
        player.smoothY = ejectionY
        player.path = []
        player.targetPosition = null
      }
      
      if (player.isHuman) {
        addMessage(t('messages.caughtOutside'))
      } else {
        addMessage(t('messages.playerCaughtOutside', { name: player.name }))
      }
    }
  })
  
  if (latePlayers.length > 0) {
    addMessage(t('messages.monsterTargetingLate'))
  }
}

// Monster AI - STATE-BASED SYSTEM with random targeting and 30s timeout
// Refactored to support multiple monsters
const updateMonsterAI = (deltaTime: number) => {
  const mConfig = monsterConfig.value
  const hConfig = healingPointConfig.value
  const cellSize = mapConfig.value.cellSize
  
  for (const monster of monsters) {
    // Update attack cooldown
    if (monster.attackCooldown > 0) {
      monster.attackCooldown -= deltaTime
    }
    
    // Update skill cooldown
    if (monster.skill && monster.skill.currentCooldown > 0) {
      monster.skill.currentCooldown -= deltaTime
      if (monster.skill.currentCooldown < 0) {
        monster.skill.currentCooldown = 0
      }
    }
    
    // Check passive ability for "Vong hồn kỵ sỹ" (Phantom Knight)
    // When below 50% HP, switch to ranged mode (200 range)
    const passiveInfo = getMonsterPassiveInfo(monster.name)
    if (passiveInfo.hasPassive && passiveInfo.threshold && passiveInfo.range) {
      const hpPercent = monster.hp / monster.maxHp
      if (!monster.passiveActive && hpPercent <= passiveInfo.threshold) {
        // Activate passive
        monster.passiveActive = true
        monster.isRanged = true
        monster.attackRange = passiveInfo.range
        addMessage(`⚔️ ${monster.name} kích hoạt "Nội tại võ thuật bóng ma" - chuyển sang đánh xa!`)
        spawnFloatingText(monster.position, '🏹 Đánh xa!', '#fbbf24', 14)
      } else if (monster.passiveActive && hpPercent > passiveInfo.threshold) {
        // Deactivate passive if healed above threshold
        monster.passiveActive = false
        monster.isRanged = false
        monster.attackRange = monster.baseAttackRange
      }
    }
    
    // Monster skill AI - different behavior based on monster type
    // Only use skill when ATTACKING a target
    const isAttackingTarget = monster.monsterState === 'attack' || 
                              monster.targetPlayerId !== null || 
                              monster.targetVanguardId !== null ||
                              monster.state === 'attacking'
    
    if (monster.skill && monster.skill.currentCooldown <= 0 && !monster.isRetreating && isAttackingTarget) {
      // "Ác ma" - Gầm thét âm vong: AoE damage to structures in range
      if (monster.name === 'Ác ma') {
        const nearbyStructures = buildings.filter(b => {
          const dist = distance(monster.position, { 
            x: b.gridX * cellSize + cellSize / 2, 
            y: b.gridY * cellSize + cellSize / 2 
          })
          return dist <= monster.skill!.range && b.hp > 0
        })
        
        if (nearbyStructures.length > 0) {
          monster.skill.currentCooldown = monster.skill.cooldown
          
          for (const building of nearbyStructures) {
            building.hp -= monster.skill.damage
            spawnFloatingText(
              { x: building.gridX * cellSize + cellSize / 2, y: building.gridY * cellSize + cellSize / 2 },
              `-${monster.skill.damage} 💀`,
              '#ef4444',
              14
            )
            
            if (building.hp <= 0) {
              building.hp = 0
              addMessage(`⚠️ ${building.type} bị phá hủy bởi ${monster.skill.name}!`)
            }
          }
          
          spawnFloatingText(monster.position, `🔊 ${monster.skill.name}!`, '#ff6b6b', 16)
          spawnParticles(monster.position, 'explosion', 10, '#ef4444')
          addMessage(`👹 ${monster.name} sử dụng "${monster.skill.name}" gây ${monster.skill.damage} sát thương!`)
          
          // Screen shake effect for roar
          triggerScreenShake(8, 0.4)
        }
      }
      // "Vong hồn kỵ sỹ" - Ám xạ cung: Instantly destroy a random structure with arrow animation
      else if (monster.name === 'Vong hồn kỵ sỹ') {
        // Find all structures that are alive
        const aliveStructures = buildings.filter(b => b.hp > 0)
        
        if (aliveStructures.length > 0) {
          monster.skill.currentCooldown = monster.skill.cooldown
          
          // Pick a random structure to destroy
          const targetIdx = Math.floor(Math.random() * aliveStructures.length)
          const targetStructure = aliveStructures[targetIdx]
          
          if (targetStructure) {
            const targetPos = { 
              x: targetStructure.gridX * cellSize + cellSize / 2, 
              y: targetStructure.gridY * cellSize + cellSize / 2 
            }
            
            // Create arrow projectile flying to target
            projectiles.push({
              id: Date.now(),
              position: { ...monster.position },
              target: targetPos,
              speed: 400,
              damage: 0, // Damage handled separately
              ownerId: -1, // Monster projectile
              color: '#6366f1', // Indigo arrow
              size: 8,
              isHoming: false,
              // Custom properties for arrow
              isSkillArrow: true,
              skillTargetBuildingId: targetStructure.id
            } as Projectile & { isSkillArrow?: boolean, skillTargetBuildingId?: number })
            
            // Visual effect at monster
            spawnFloatingText(monster.position, `🏹 ${monster.skill.name}!`, '#6366f1', 16)
            spawnParticles(monster.position, 'spark', 5, '#6366f1')
            addMessage(`🏹 ${monster.name} sử dụng "${monster.skill.name}" nhắm vào ${targetStructure.type}!`)
          }
        }
      }
    }
    
    // Update level up time for UI display
    monster.levelUpTime = mConfig.baseLevelTime + (mConfig.levelTimeIncrement * monster.level)
    
    // Monster leveling - stats from monsterPool.ts (type-specific)
    const levelUpTime = mConfig.baseLevelTime + (mConfig.levelTimeIncrement * monster.level)
    monster.levelTimer += deltaTime
    if (monster.levelTimer >= levelUpTime) {
      monster.levelTimer = 0
      monster.level++
      
      // Get type-specific scaling from monsterPool.ts
      const typeConfig = getMonsterTypeConfig(monster.name)
      const hpScale = typeConfig?.hpScale ?? 1.3
      const damageScale = typeConfig?.damageScale ?? 1.4
      const baseMaxHp = typeConfig?.maxHp ?? monster.maxHp
      
      // Apply scaling using values from monster type definition
      monster.damage = Math.floor(monster.baseDamage * Math.pow(damageScale, monster.level - 1))
      monster.maxHp = Math.floor(baseMaxHp * Math.pow(hpScale, monster.level - 1))
      monster.hp = monster.maxHp // FULL HEAL on level up!
      
      // Skill cooldown reduction: -10% per 3 levels
      if (monster.skill && monster.skill.cooldown > 0) {
        const cooldownReductionTiers = Math.floor(monster.level / 3) // Every 3 levels
        const cooldownMultiplier = Math.pow(0.9, cooldownReductionTiers) // 10% reduction per tier
        const baseCooldown = typeConfig?.skill.cooldown ?? 20 // Get from type config
        monster.skill.cooldown = Math.max(5, Math.floor(baseCooldown * cooldownMultiplier)) // Min 5s cooldown
      }
      
      addMessage(t('messages.monsterSpawned', { level: monster.level, damage: monster.damage, hp: monster.maxHp }))
      spawnFloatingText(monster.position, `LV ${monster.level}!`, '#ff6b6b', 20)
    }
    
    // Find nearest monster nest with sufficient mana for healing
    // NEW LOGIC: Prioritize mana amount first, then distance
    // minMana is only used when STARTING to find a healing point (10%)
    const minManaToStart = hConfig.maxMana * hConfig.minManaPercent
    
    const findBestHealingPoint = (): HealingPoint | null => {
      // Filter points with enough mana to START healing (>= 10%)
      const availablePoints = healingPoints.filter(hp => hp.manaPower >= minManaToStart)
      if (availablePoints.length === 0) return null
      
      // Sort by mana (highest first), then by distance (closest first) for tie-breaking
      availablePoints.sort((a, b) => {
        // Primary: Higher mana is better
        const manaDiff = b.manaPower - a.manaPower
        if (Math.abs(manaDiff) > minManaToStart) {
          // Significant mana difference - prioritize mana
          return manaDiff
        }
        // Similar mana - use distance as tie-breaker
        const distA = distance(monster.position, a.position)
        const distB = distance(monster.position, b.position)
        return distA - distB
      })
      
      return availablePoints[0]!
    }
    
    // Get the locked healing point by ID
    const getLockedHealingPoint = (): HealingPoint | null => {
      if (monster.targetHealingPointId === null) return null
      return healingPoints.find(hp => hp.id === monster.targetHealingPointId) || null
    }
    
    // =========================================================================
    // HEALING WITH MANA SYSTEM: Healing consumes mana, immediate re-engage
    // Monster locks onto ONE healing point until fully healed or mana FULLY depleted
    // Once locked, monster stays until: (1) fully healed OR (2) mana = 0
    // healingInterrupted = true means no healing point has mana, skip retreat
    // =========================================================================
    
    // STATE: RETREAT - when HP is low, go to nearest nest with mana
    // Skip retreat if healingInterrupted (all healing points exhausted)
    if ((monster.hp / monster.maxHp < mConfig.healThreshold || monster.isFullyHealing) && !monster.healingInterrupted) {
      monster.monsterState = 'retreat'
      
      // Use locked healing point if available, otherwise find new one
      let targetHealingPoint = getLockedHealingPoint()
      
      // Check if locked point is below minimum mana threshold (< 10%)
      // Monster IMMEDIATELY stops retreating and resumes attack when mana depleted
      // IMPORTANT: Monster does NOT look for another healing point - it fights!
      const minManaThresholdForRetreat = targetHealingPoint 
        ? targetHealingPoint.maxManaPower * hConfig.minManaPercent 
        : 0
      if (targetHealingPoint && targetHealingPoint.manaPower < minManaThresholdForRetreat) {
        // Locked point mana below threshold - STOP retreating immediately, resume attack
        spawnFloatingText(monster.position, '⚡ Mana < 10%!', '#fbbf24', 14)
        monster.isFullyHealing = false
        monster.isRetreating = false
        monster.targetHealingPointId = null
        monster.speed = monster.baseSpeed
        monster.healingInterrupted = true
        monster.monsterState = 're-engage'
        addMessage(t('messages.healingPointDepleted'))
        // Fall through to normal AI behavior - monster will attack
        targetHealingPoint = null
      }
      
      // If no locked point, find a new one (only if not healing interrupted)
      if (!targetHealingPoint && !monster.healingInterrupted) {
        targetHealingPoint = findBestHealingPoint()
        if (targetHealingPoint) {
          // Lock onto this healing point
          monster.targetHealingPointId = targetHealingPoint.id
        }
      }
      
      // If no healing point has sufficient mana, stop retreating and resume combat
      // Note: Skip if healingInterrupted is already true (already handled above)
      if (!targetHealingPoint && !monster.healingInterrupted) {
        if (monster.isFullyHealing || monster.isRetreating) {
          addMessage(t('messages.healingPointsExhausted'))
          spawnFloatingText(monster.position, '⚡ No Mana!', '#ef4444', 14)
        }
        monster.isFullyHealing = false
        monster.isRetreating = false
        monster.targetHealingPointId = null
        monster.speed = monster.baseSpeed
        monster.monsterState = 're-engage'
        // Mark healing as interrupted - monster won't try to retreat again until mana is available
        monster.healingInterrupted = true
        // Fall through to normal AI behavior below
      } else if (targetHealingPoint) {
        // Set retreat state if not already retreating
        if (!monster.isRetreating && !monster.isFullyHealing) {
          monster.isRetreating = true
          monster.isFullyHealing = true
          monster.healIdleTimer = 0
          monster.speed = monster.baseSpeed * mConfig.retreatSpeedBonus
          monster.targetPlayerId = null
          monster.targetTimer = 0
          addMessage(t('messages.monsterRetreating'))
        }
        
        const distToHeal = distance(monster.position, targetHealingPoint.position)
        const HEAL_RANGE = 80 // Distance to start healing
        
        if (distToHeal > HEAL_RANGE) {
          // Walking to locked healing point
          monster.state = 'walking'
          monster.targetPosition = targetHealingPoint.position
          
          // Recalculate path only if needed
          if (monster.path.length === 0) {
            const walkableGrid = createWalkableGrid(-1, true)
            monster.path = findPath(walkableGrid, monster.position, targetHealingPoint.position, cellSize)
          }
        } else {
          // STATE: HEAL - at the locked healing point, regenerate using mana
          // Check if mana is below minimum threshold (10%) - stop healing immediately
          const minManaThreshold = targetHealingPoint.maxManaPower * hConfig.minManaPercent
          if (targetHealingPoint.manaPower < minManaThreshold) {
            spawnFloatingText(monster.position, '⚡ Mana < 10%!', '#fbbf24', 14)
            monster.isFullyHealing = false
            monster.isRetreating = false
            monster.targetHealingPointId = null
            monster.speed = monster.baseSpeed
            // Mark healing as interrupted - monster will NOT look for another healing point
            // It will resume attack immediately, regardless of whether other healing points have mana
            monster.healingInterrupted = true
            monster.monsterState = 're-engage'
            addMessage(t('messages.healingPointDepleted'))
            continue // Skip to next monster
          }
          
          monster.monsterState = 'heal'
          monster.state = 'healing'
          monster.path = []
          monster.targetPosition = null
          
          // Calculate heal amount using config
          const potentialHeal = monster.maxHp * mConfig.healRate * deltaTime
          const hpNeeded = monster.maxHp - monster.hp
          const healAmount = Math.min(potentialHeal, hpNeeded, targetHealingPoint.manaPower)
          
          // Apply healing and consume mana
          monster.hp += healAmount
          targetHealingPoint.manaPower -= healAmount
          
          // Show mana consumption occasionally
          if (Math.random() < 0.05) {
            const manaPercent = Math.round((targetHealingPoint.manaPower / targetHealingPoint.maxManaPower) * 100)
            spawnFloatingText(targetHealingPoint.position, `💧 ${manaPercent}%`, '#60a5fa', 10)
          }
          
          spawnParticles(monster.position, 'heal', 1, '#22c55e')
          
          // Check if fully healed - resume hunting
          if (monster.hp >= monster.maxHp) {
            monster.hp = monster.maxHp
            monster.isFullyHealing = false
            monster.isRetreating = false
            monster.healingInterrupted = false
            monster.targetHealingPointId = null
            monster.speed = monster.baseSpeed
            monster.targetPlayerId = null
            monster.monsterState = 're-engage'
            addMessage(t('messages.monsterFullyHealed'))
            spawnFloatingText(monster.position, '💪 Full HP!', '#22c55e', 14)
          }
        }
        continue // Skip to next monster
      }
    }
    
    // Reset retreat state if HP is above threshold
    monster.isRetreating = false
    monster.targetHealingPointId = null
    monster.speed = monster.baseSpeed
    
    // Track target timer (30s max per target) - config driven
    if (monster.targetPlayerId !== null) {
      monster.targetTimer += deltaTime
      
      // DISENGAGE after timeout
      if (monster.targetTimer >= mConfig.targetTimeout) {
        addMessage(t('messages.monsterDisengaging'))
        // Add current target to last targets list
        if (!monster.lastTargets.includes(monster.targetPlayerId)) {
          monster.lastTargets.push(monster.targetPlayerId)
          // Keep only last 2 targets to avoid
          if (monster.lastTargets.length > 2) {
            monster.lastTargets.shift()
          }
        }
        monster.targetPlayerId = null
        monster.targetTimer = 0
        monster.monsterState = 'disengage'
      }
    }
    
    // RANDOM TARGET SELECTION (avoiding recent targets)
    const selectRandomTarget = (): Player | null => {
      const alivePlayers = players.filter(p => p.alive && !monster.lastTargets.includes(p.id))
      if (alivePlayers.length === 0) {
        // If all recent targets dead or no other options, allow re-targeting
        const allAlive = players.filter(p => p.alive)
        if (allAlive.length === 0) return null
        return allAlive[Math.floor(Math.random() * allAlive.length)] || null
      }
      return alivePlayers[Math.floor(Math.random() * alivePlayers.length)] || null
    }
    
    // =========================================================================
    // VANGUARD PRIORITY: Monster attacks vanguards that hit it first!
    // =========================================================================
    if (monster.targetVanguardId !== null) {
      const targetVanguard = vanguards.find(v => v.id === monster.targetVanguardId && v.state !== 'dead')
      
      if (targetVanguard) {
        const distToVanguard = distance(monster.position, targetVanguard.position)
        
        // Attack vanguard in range
        if (distToVanguard < mConfig.attackRange) {
          monster.state = 'attacking'
          monster.path = []
          monster.facingRight = targetVanguard.position.x > monster.position.x
          
          if (monster.attackCooldown <= 0) {
            targetVanguard.hp -= monster.damage
            monster.attackCooldown = mConfig.attackCooldown
            playSfx('hit')
            spawnParticles(targetVanguard.position, 'blood', 8, '#a855f7')
            spawnFloatingText(targetVanguard.position, `-${monster.damage}`, '#ef4444', 14)
            
            if (targetVanguard.hp <= 0) {
              targetVanguard.hp = 0
              targetVanguard.state = 'dead'
              targetVanguard.respawnTimer = timingConfig.value.vanguardRespawnTime
              spawnFloatingText(targetVanguard.position, '☠ Vanguard Down!', '#ef4444', 14)
              monster.targetVanguardId = null // Clear vanguard target
            }
          }
          continue
        } else {
          // Chase the vanguard
          monster.state = 'walking'
          const walkableGrid = createWalkableGrid(-1, true)
          if (monster.path.length === 0 || Math.random() < 0.05) {
            monster.path = findPath(walkableGrid, monster.position, targetVanguard.position, cellSize)
          }
          
          if (monster.path.length > 0) {
            const nextPos = monster.path[0]!
            monster.facingRight = nextPos.x > monster.position.x
            monster.position = moveTowards(monster.position, nextPos, monster.speed, deltaTime)
            if (distance(monster.position, nextPos) < 5) {
              monster.path.shift()
            }
          }
          continue
        }
      } else {
        // Target vanguard died or not found
        monster.targetVanguardId = null
      }
    }
    
    // STATE: SEARCH - find a new target
    if (monster.targetPlayerId === null || monster.monsterState === 'search' || monster.monsterState === 're-engage' || monster.monsterState === 'disengage') {
      const newTarget = selectRandomTarget()
      if (newTarget) {
        monster.targetPlayerId = newTarget.id
        monster.targetTimer = 0
        monster.monsterState = 'attack'
        addMessage(t('messages.monsterTargeting', { name: newTarget.name }))
      } else {
        monster.state = 'idle'
        monster.monsterState = 'search'
        continue
      }
    }
    
    // Get current target
    const targetPlayer = players.find(p => p.id === monster.targetPlayerId && p.alive)
    if (!targetPlayer) {
      // Target died or invalid - clear and search again
      monster.targetPlayerId = null
      monster.targetTimer = 0
      monster.monsterState = 'search'
      continue
    }
    
    // STATE: ATTACK - pursue and attack the target
    monster.monsterState = 'attack'
    const distToTarget = distance(monster.position, targetPlayer.position)
    
    // Check if player is protected by a door (in a room with door still intact)
    const playerRoom = targetPlayer.roomId !== null ? rooms.find(r => r.id === targetPlayer.roomId) : null
    const playerProtectedByDoor = playerRoom && playerRoom.doorHp > 0
    
    // ========================================================================
    // PHANTOM KNIGHT RANGED MODE AI
    // When passive is active (below 50% HP), maintain distance and attack from range
    // ========================================================================
    if (monster.passiveActive && monster.isRanged && monster.attackRange) {
      const rangedAttackRange = monster.attackRange // 200
      const minSafeDistance = rangedAttackRange * 0.6 // 120 - minimum distance to maintain
      const maxAttackDistance = rangedAttackRange * 0.95 // 190 - max distance to still hit
      
      // Determine the primary target position (door if protected, player if not)
      let primaryTarget: Vector2
      let targetIsDoor = false
      
      if (playerProtectedByDoor && playerRoom) {
        // Target the door first
        primaryTarget = playerRoom.doorPosition
        targetIsDoor = true
      } else {
        // Target the player directly
        primaryTarget = targetPlayer.position
      }
      
      const distToPrimaryTarget = distance(monster.position, primaryTarget)
      
      // Check for obstacles (buildings) in path - attack them from range too
      const nearestObstacle = buildings.find(b => {
        if (b.hp <= 0) return false
        const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, cellSize)
        const distToBuilding = distance(monster.position, bPos)
        return distToBuilding < rangedAttackRange && distToBuilding < distToPrimaryTarget
      })
      
      if (nearestObstacle) {
        const bPos = gridToWorld({ x: nearestObstacle.gridX, y: nearestObstacle.gridY }, cellSize)
        const distToObstacle = distance(monster.position, bPos)
        
        // Attack obstacle from range
        if (distToObstacle >= minSafeDistance && distToObstacle <= maxAttackDistance) {
          monster.state = 'attacking'
          monster.facingRight = bPos.x > monster.position.x
          
          if (monster.attackCooldown <= 0) {
            nearestObstacle.hp -= monster.damage
            monster.attackCooldown = mConfig.attackCooldown
            playSfx('hit')
            spawnParticles(bPos, 'spark', 8, '#ff9900')
            spawnFloatingText(bPos, `-${monster.damage}`, '#ef4444', 14)
            spawnFloatingText(monster.position, '🏹', '#fbbf24', 12)
            
            if (nearestObstacle.hp <= 0) {
              nearestObstacle.hp = 0
              addMessage(t('messages.monsterDestroyedBuilding', { type: getBuildingTypeName(nearestObstacle.type) }))
              spawnFloatingText(bPos, '💥', '#ff6b6b', 18)
              spawnParticles(bPos, 'explosion', 15, '#ff6b6b')
            }
          }
        } else if (distToObstacle < minSafeDistance) {
          // Too close to obstacle - retreat
          const dx = monster.position.x - bPos.x
          const dy = monster.position.y - bPos.y
          const length = Math.sqrt(dx * dx + dy * dy)
          if (length > 0) {
            monster.position.x += (dx / length) * monster.speed * 1.5 * deltaTime
            monster.position.y += (dy / length) * monster.speed * 1.5 * deltaTime
            monster.state = 'walking'
            monster.facingRight = bPos.x > monster.position.x
          }
        } else {
          // Too far from obstacle - approach
          const dx = bPos.x - monster.position.x
          const dy = bPos.y - monster.position.y
          const length = Math.sqrt(dx * dx + dy * dy)
          if (length > 0) {
            monster.position.x += (dx / length) * monster.speed * deltaTime
            monster.position.y += (dy / length) * monster.speed * deltaTime
            monster.state = 'walking'
            monster.facingRight = bPos.x > monster.position.x
          }
        }
        continue
      }
      
      // No obstacles - attack primary target (door or player)
      if (targetIsDoor && playerRoom) {
        // Attack door from range
        if (distToPrimaryTarget >= minSafeDistance && distToPrimaryTarget <= maxAttackDistance) {
          monster.state = 'attacking'
          monster.facingRight = primaryTarget.x > monster.position.x
          
          if (monster.attackCooldown <= 0) {
            const doorDamage = Math.floor(monster.damage * 1.5)
            playerRoom.doorHp -= doorDamage
            monster.attackCooldown = mConfig.attackCooldown
            playSfx('hit')
            spawnParticles(primaryTarget, 'spark', 10, '#fbbf24')
            spawnFloatingText(primaryTarget, `-${doorDamage}`, '#ef4444', 16)
            spawnFloatingText(monster.position, '🏹', '#fbbf24', 12)
            
            if (playerRoom.doorHp <= 0) {
              playerRoom.doorHp = 0
              addMessage(t('messages.roomDoorDestroyed', { roomId: playerRoom.id }))
              spawnFloatingText(primaryTarget, '💥 DESTROYED!', '#ff6b6b', 20)
            }
          }
        } else if (distToPrimaryTarget < minSafeDistance) {
          // Too close to door - retreat
          const dx = monster.position.x - primaryTarget.x
          const dy = monster.position.y - primaryTarget.y
          const length = Math.sqrt(dx * dx + dy * dy)
          if (length > 0) {
            monster.position.x += (dx / length) * monster.speed * 1.5 * deltaTime
            monster.position.y += (dy / length) * monster.speed * 1.5 * deltaTime
            monster.state = 'walking'
            monster.facingRight = primaryTarget.x > monster.position.x
          }
        } else {
          // Too far from door - approach to attack range
          const dx = primaryTarget.x - monster.position.x
          const dy = primaryTarget.y - monster.position.y
          const length = Math.sqrt(dx * dx + dy * dy)
          if (length > 0) {
            monster.position.x += (dx / length) * monster.speed * deltaTime
            monster.position.y += (dy / length) * monster.speed * deltaTime
            monster.state = 'walking'
            monster.facingRight = primaryTarget.x > monster.position.x
          }
        }
      } else {
        // Attack player from range (door is broken or player outside)
        if (distToPrimaryTarget >= minSafeDistance && distToPrimaryTarget <= maxAttackDistance) {
          monster.state = 'attacking'
          monster.facingRight = primaryTarget.x > monster.position.x
          
          if (monster.attackCooldown <= 0) {
            targetPlayer.hp -= monster.damage
            monster.attackCooldown = mConfig.attackCooldown
            playSfx('hit')
            spawnParticles(targetPlayer.position, 'blood', 10, '#ef4444')
            spawnFloatingText(targetPlayer.position, `-${monster.damage}`, '#ef4444', 18)
            spawnFloatingText(monster.position, '🏹', '#fbbf24', 12)
            
            if (targetPlayer.hp <= 0) {
              targetPlayer.hp = 0
              targetPlayer.alive = false
              targetPlayer.state = 'dying'
              addMessage(t('messages.playerKilled', { name: targetPlayer.name }))
              monster.targetPlayerId = null
              monster.targetTimer = 0
              if (targetPlayer.isHuman) endGame(false)
            }
          }
        } else if (distToPrimaryTarget < minSafeDistance) {
          // Too close to player - retreat
          const dx = monster.position.x - primaryTarget.x
          const dy = monster.position.y - primaryTarget.y
          const length = Math.sqrt(dx * dx + dy * dy)
          if (length > 0) {
            monster.position.x += (dx / length) * monster.speed * 1.5 * deltaTime
            monster.position.y += (dy / length) * monster.speed * 1.5 * deltaTime
            monster.state = 'walking'
            monster.facingRight = primaryTarget.x > monster.position.x
          }
        } else {
          // Too far - approach to attack range
          const dx = primaryTarget.x - monster.position.x
          const dy = primaryTarget.y - monster.position.y
          const length = Math.sqrt(dx * dx + dy * dy)
          if (length > 0) {
            monster.position.x += (dx / length) * monster.speed * deltaTime
            monster.position.y += (dy / length) * monster.speed * deltaTime
            monster.state = 'walking'
            monster.facingRight = primaryTarget.x > monster.position.x
          }
        }
      }
      continue
    }
    
    // ========================================================================
    // NORMAL MELEE MONSTER AI (Ác ma or Phantom Knight before passive)
    // ========================================================================
    
    // Check if monster can directly attack this player (use monster's attack range)
    // But ONLY if player is NOT protected by a door
    const effectiveAttackRange = monster.attackRange || mConfig.attackRange
    if (distToTarget < effectiveAttackRange && !playerProtectedByDoor) {
      monster.state = 'attacking'
      monster.path = []
      if (monster.attackCooldown <= 0) {
        targetPlayer.hp -= monster.damage
        monster.attackCooldown = mConfig.attackCooldown
        playSfx('hit')
        spawnParticles(targetPlayer.position, 'blood', 10, '#ef4444')
        spawnFloatingText(targetPlayer.position, `-${monster.damage}`, '#ef4444', 18)
        
        if (targetPlayer.hp <= 0) {
          targetPlayer.hp = 0
          targetPlayer.alive = false
          targetPlayer.state = 'dying'
          addMessage(t('messages.playerKilled', { name: targetPlayer.name }))
          monster.targetPlayerId = null
          monster.targetTimer = 0
          if (targetPlayer.isHuman) endGame(false)
        }
      }
      continue
    }
    
    // Check if we need to break through a door to reach the player
    // (playerRoom and playerProtectedByDoor already defined above)
    
    // OBSTACLE DESTRUCTION: Check if any building blocks the path to target
    const obstacleInRange = buildings.find(b => {
      if (b.hp <= 0) return false
      const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, cellSize)
      const distToBuilding = distance(monster.position, bPos)
      return distToBuilding < cellSize * 1.5
    })
    
    if (obstacleInRange) {
      const bPos = gridToWorld({ x: obstacleInRange.gridX, y: obstacleInRange.gridY }, cellSize)
      monster.state = 'attacking'
      monster.path = []
      monster.facingRight = bPos.x > monster.position.x
      
      if (monster.attackCooldown <= 0) {
        obstacleInRange.hp -= monster.damage
        monster.attackCooldown = mConfig.attackCooldown
        playSfx('hit')
        spawnParticles(bPos, 'spark', 8, '#ff9900')
        spawnFloatingText(bPos, `-${monster.damage}`, '#ef4444', 14)
        
        if (obstacleInRange.hp <= 0) {
          obstacleInRange.hp = 0
          addMessage(t('messages.monsterDestroyedBuilding', { type: getBuildingTypeName(obstacleInRange.type) }))
          spawnFloatingText(bPos, '💥', '#ff6b6b', 18)
          spawnParticles(bPos, 'explosion', 15, '#ff6b6b')
          
          // Mark the build spot as destroyed (cannot rebuild)
          const ownerRoom = rooms.find(r => r.buildSpots.some(spot => 
            Math.abs(spot.x - bPos.x) < 30 && Math.abs(spot.y - bPos.y) < 30
          ))
          if (ownerRoom) {
            const destroyedSpot = ownerRoom.buildSpots.find(spot =>
              Math.abs(spot.x - bPos.x) < 30 && Math.abs(spot.y - bPos.y) < 30
            )
            if (destroyedSpot) {
              destroyedSpot.isDestroyed = true
            }
          }
        }
      }
      continue
    }

    if (playerRoom && playerRoom.doorHp > 0) {
      const doorPos = playerRoom.doorPosition
      const distToDoor = distance(monster.position, doorPos)
      
      if (distToDoor < cellSize * 1.2) {
        monster.state = 'attacking'
        monster.path = []
        if (monster.attackCooldown <= 0) {
          const doorDamage = Math.floor(monster.damage * 1.5)
          playerRoom.doorHp -= doorDamage
          monster.attackCooldown = mConfig.attackCooldown
          playSfx('hit')
          spawnParticles(doorPos, 'spark', 10, '#fbbf24')
          spawnFloatingText(doorPos, `-${doorDamage}`, '#ef4444', 16)
          
          if (playerRoom.doorHp <= 0) {
            playerRoom.doorHp = 0
            addMessage(t('messages.roomDoorDestroyed', { roomId: playerRoom.id }))
            spawnFloatingText(doorPos, '💥 DESTROYED!', '#ff6b6b', 20)
          }
        }
      } else {
        if (monster.state !== 'walking' || monster.path.length === 0) {
          const walkableGrid = createWalkableGrid(-1, true)
          monster.path = findPath(walkableGrid, monster.position, doorPos, cellSize)
          if (monster.path.length > 0) {
            monster.state = 'walking'
            monster.targetPosition = doorPos
          }
        }
      }
    } else {
      // Player is accessible - move towards player
      if (monster.state !== 'walking' || monster.path.length === 0) {
        const walkableGrid = createWalkableGrid(-1, true)
        monster.path = findPath(walkableGrid, monster.position, targetPlayer.position, cellSize)
        if (monster.path.length > 0) {
          monster.state = 'walking'
          monster.targetPosition = targetPlayer.position
        } else {
          monster.state = 'idle'
        }
      }
    }
  }
}

// Player AI - ADVANCED behavior using Utility-Based Scoring & Situational Logic
const updatePlayerAI = (player: Player, _deltaTime: number) => {
  if (!player.alive || player.isHuman) return
  
  const myRoom = player.roomId !== null ? rooms.find(r => r.id === player.roomId) : null
  
  // =========================================================================
  // ADVANCED BOT AI - UTILITY SCORING SYSTEM
  // Evaluates game state and chooses best action dynamically
  // =========================================================================
  if (player.isSleeping && myRoom) {
    // Gather game state information
    const myBuildings = buildings.filter(b => b.ownerId === player.id && b.hp > 0)
    const myTurrets = myBuildings.filter(b => b.type === 'turret')
    const myATMs = myBuildings.filter(b => b.type === 'atm')
    const mySoulCollectors = myBuildings.filter(b => b.type === 'soul_collector')
    
    // Calculate threat level based on multiple monsters
    const doorHpPercent = myRoom.doorHp / myRoom.doorMaxHp
    const firstMonster = getFirstMonster()
    const monsterTargetingMe = monsters.some(m => m.targetPlayerId === player.id)
    const monsterLevel = firstMonster?.level ?? 1 // Use highest level if multiple monsters
    const isUnderAttack = monsterTargetingMe && doorHpPercent < 1
    
    // Threat assessment
    type ThreatLevel = 'critical' | 'high' | 'medium' | 'low'
    let threatLevel: ThreatLevel = 'low'
    if (doorHpPercent < 0.3 && monsterTargetingMe) threatLevel = 'critical'
    else if (doorHpPercent < 0.4 || (monsterTargetingMe && monsterLevel >= 3)) threatLevel = 'high'
    else if (doorHpPercent < 0.6 || monsterLevel >= 4) threatLevel = 'medium'
    
    // Calculate structure levels
    const maxTurretLevel = myTurrets.length > 0 ? Math.max(...myTurrets.map(t => t.level)) : 0
    
    // Find empty build spot - PRIORITIZE spots closer to door for turrets
    const cellSize = mapConfig.value.cellSize
    const findEmptySpot = (prioritizeNearDoor: boolean = false): Vector2 | null => {
      const emptySpots = myRoom.buildSpots.filter(spot => {
        // Skip destroyed spots (marked with red X)
        if (spot.isDestroyed) return false
        return !buildings.some(b => {
          if (b.hp <= 0) return false // Destroyed buildings don't block
          const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, cellSize)
          return distance(bPos, spot) < 30
        })
      })
      
      if (emptySpots.length === 0) return null
      
      if (prioritizeNearDoor) {
        // Sort by distance to door - closest first
        emptySpots.sort((a, b) => {
          const distA = distance(a, myRoom.doorPosition)
          const distB = distance(b, myRoom.doorPosition)
          return distA - distB
        })
      }
      
      return emptySpots[0] || null
    }
    
    // Find best spot specifically for turret - near door for maximum effectiveness
    const findBestTurretSpot = (): Vector2 | null => {
      const emptySpots = myRoom.buildSpots.filter(spot => {
        // Skip destroyed spots (marked with red X)
        if (spot.isDestroyed) return false
        return !buildings.some(b => {
          if (b.hp <= 0) return false
          const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, cellSize)
          return distance(bPos, spot) < 30
        })
      })
      
      if (emptySpots.length === 0) return null
      
      // Score each spot based on strategic value
      const scoredSpots = emptySpots.map(spot => {
        let score = 100
        
        // Primary: Distance to door (closer = better for defense)
        const distToDoor = distance(spot, myRoom.doorPosition)
        score -= distToDoor * 0.5 // Penalty for being far from door
        
        // Bonus: If within turret range of door position
        const turretRange = GAME_CONSTANTS.BUILDINGS.turret.range
        if (distToDoor <= turretRange) {
          score += 50 // Big bonus for covering the door
        }
        
        // Bonus: Not too close to existing turrets (spread fire)
        const nearbyTurrets = myTurrets.filter(t => {
          const tPos = gridToWorld({ x: t.gridX, y: t.gridY }, cellSize)
          return distance(spot, tPos) < 80
        })
        if (nearbyTurrets.length === 0) {
          score += 20 // Bonus for good spacing
        }
        
        return { spot, score }
      })
      
      // Sort by score descending
      scoredSpots.sort((a, b) => b.score - a.score)
      
      return scoredSpots[0]?.spot || null
    }
    
    // =====================================================================
    // UTILITY SCORING - Each action gets a score based on current situation
    // =====================================================================
    interface ActionScore {
      action: string
      score: number
      execute: () => boolean
    }
    
    const actions: ActionScore[] = []
    
    // ------------------------------------------------------------------
    // ACTION 1: REPAIR DOOR (Emergency - highest priority when damaged)
    // ------------------------------------------------------------------
    if (!myRoom.doorIsRepairing && myRoom.doorRepairCooldown <= 0 && doorHpPercent < 0.8 && myRoom.doorHp > 0) {
      let score = (1 - doorHpPercent) * 200 // Higher damage = higher score
      if (threatLevel === 'critical') score *= 3
      else if (threatLevel === 'high') score *= 2
      if (isUnderAttack) score *= 1.5
      
      actions.push({
        action: 'repair_door',
        score,
        execute: () => {
          const result = BotAI.executeRepairDoor(myRoom)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 2: UPGRADE DOOR (Priority in high threat)
    // ------------------------------------------------------------------
    if (player.gold >= myRoom.doorUpgradeCost && myRoom.doorLevel < 10) {
      let score = 80
      if (threatLevel === 'critical') score *= 2.5
      else if (threatLevel === 'high') score *= 2
      else if (threatLevel === 'medium') score *= 1.5
      // Lower priority if door level is already high relative to monster
      if (myRoom.doorLevel >= monsterLevel + 2) score *= 0.5
      
      actions.push({
        action: 'upgrade_door',
        score,
        execute: () => {
          const result = BotAI.executeUpgradeDoor(player, myRoom)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 3: UPGRADE BED (Economy scaling - HIGH PRIORITY)
    // ------------------------------------------------------------------
    if (player.gold >= myRoom.bedUpgradeCost) {
      let score = 100 // Increased base score for bed priority
      // Bed lagging behind other structures = very high priority
      const maxStructureLevel = Math.max(myRoom.doorLevel, maxTurretLevel)
      if (myRoom.bedLevel < maxStructureLevel) score += 60
      // Early game bed upgrades are crucial for economy
      if (myRoom.bedLevel < 3) score += 40
      // Low threat = focus on economy
      if (threatLevel === 'low') score *= 1.5
      else if (threatLevel === 'medium') score *= 1.2
      // High threat = delay economy slightly but still important
      else if (threatLevel === 'high') score *= 0.7
      else if (threatLevel === 'critical') score *= 0.3
      
      actions.push({
        action: 'upgrade_bed',
        score,
        execute: () => {
          const result = BotAI.executeUpgradeBed(player, myRoom)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 4: BUILD TURRET (Defense - priority when few turrets)
    // Use findBestTurretSpot for strategic placement near door
    // ------------------------------------------------------------------
    const turretSpot = findBestTurretSpot()
    if (myTurrets.length < 4 && player.gold >= GAME_CONSTANTS.COSTS.turret && turretSpot) {
      let score = 60
      // First turret is critical
      if (myTurrets.length === 0) score += 80
      else if (myTurrets.length === 1) score += 40
      // High threat = more turrets
      if (threatLevel === 'high' || threatLevel === 'critical') score *= 1.5
      
      actions.push({
        action: 'build_turret',
        score,
        execute: () => {
          const result = BotAI.executeBuildStructure(player, buildings, 'turret', turretSpot, GAME_CONSTANTS.CELL_SIZE)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 5: UPGRADE TURRET (Defense scaling)
    // ------------------------------------------------------------------
    const soulCostForUpgrade = (level: number) => level >= 4 ? GAME_CONSTANTS.SOUL_UPGRADE_COST * (level - 3) : 0
    const upgradableTurret = myTurrets.find(t => {
      if (t.level >= 10) return false
      if (player.gold < t.upgradeCost) return false
      const soulCost = soulCostForUpgrade(t.level)
      if (soulCost > 0 && player.souls < soulCost) return false
      return true
    })
    if (upgradableTurret) {
      let score = 50
      // High threat = upgrade turrets
      if (threatLevel === 'high' || threatLevel === 'critical') score *= 1.5
      // Prioritize if turret level is low relative to monster
      if (upgradableTurret.level < monsterLevel) score += 30
      
      actions.push({
        action: 'upgrade_turret',
        score,
        execute: () => {
          const result = BotAI.executeUpgradeTurret(player, upgradableTurret, getBuildingDamage, getBuildingRange, GAME_CONSTANTS.CELL_SIZE)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 5B: BUILD SMG (High DPS multi-shot weapon)
    // SMG fires burst of 10 bullets, great for sustained damage
    // ------------------------------------------------------------------
    const mySMGs = buildings.filter(b => b.ownerId === player.id && b.type === 'smg' && b.hp > 0)
    const smgSpot = findBestTurretSpot() // Use same strategic placement as turrets
    if (mySMGs.length < 2 && player.gold >= GAME_CONSTANTS.COSTS.smg && smgSpot) {
      let score = 55
      // SMG is good after having basic turrets
      if (myTurrets.length >= 2) score += 30
      // First SMG is valuable for burst damage
      if (mySMGs.length === 0) score += 25
      // High threat = more weapons
      if (threatLevel === 'high' || threatLevel === 'critical') score *= 1.4
      
      actions.push({
        action: 'build_smg',
        score,
        execute: () => {
          const spot = findBestTurretSpot()
          if (!spot) return false
          const result = BotAI.executeBuildStructure(player, buildings, 'smg', spot, GAME_CONSTANTS.CELL_SIZE)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 5C: UPGRADE SMG (Damage and range scaling)
    // ------------------------------------------------------------------
    const upgradableSMG = mySMGs.find(s => {
      if (s.level >= 10) return false
      if (player.gold < s.upgradeCost) return false
      const soulCost = soulCostForUpgrade(s.level)
      if (soulCost > 0 && player.souls < soulCost) return false
      return true
    })
    if (upgradableSMG) {
      let score = 48
      // High threat = upgrade weapons
      if (threatLevel === 'high' || threatLevel === 'critical') score *= 1.5
      // Prioritize if SMG level is low relative to monster
      if (upgradableSMG.level < monsterLevel) score += 25
      
      actions.push({
        action: 'upgrade_smg',
        score,
        execute: () => {
          // Check souls requirement for level 4+
          if (upgradableSMG.level >= 4) {
            const soulCost = GAME_CONSTANTS.SOUL_UPGRADE_COST * (upgradableSMG.level - 3)
            if (player.souls < soulCost) return false
            player.souls -= soulCost
          }
          if (player.gold < upgradableSMG.upgradeCost) return false
          player.gold -= upgradableSMG.upgradeCost
          upgradableSMG.level++
          upgradableSMG.damage = getBuildingDamage(upgradableSMG.baseDamage, upgradableSMG.level, 'smg')
          upgradableSMG.range = getBuildingRange(upgradableSMG.baseRange, upgradableSMG.level, 'smg')
          upgradableSMG.upgradeCost *= 2
          const pos = gridToWorld({ x: upgradableSMG.gridX, y: upgradableSMG.gridY }, GAME_CONSTANTS.CELL_SIZE)
          spawnFloatingText(pos, `↑ LV${upgradableSMG.level}!`, '#f97316', 12)
          return true
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 6: BUILD SOUL COLLECTOR (Economy - needed for ATM)
    // ------------------------------------------------------------------
    const economySpot = findEmptySpot()
    if (mySoulCollectors.length === 0 && player.gold >= GAME_CONSTANTS.COSTS.soul_collector && economySpot) {
      let score = 40
      // Only build if we have basic defense
      if (myTurrets.length >= 2 && myRoom.doorLevel >= 2) score += 30
      // Low threat = economy focus
      if (threatLevel === 'low') score *= 1.5
      else if (threatLevel === 'critical') score *= 0.2
      
      actions.push({
        action: 'build_soul_collector',
        score,
        execute: () => {
          const spot = findEmptySpot() // Re-check spot at execution time
          if (!spot) return false
          const result = BotAI.executeBuildStructure(player, buildings, 'soul_collector', spot, GAME_CONSTANTS.CELL_SIZE)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 7: BUILD ATM (Late-game economy - costs SOULS)
    // ------------------------------------------------------------------
    if (myATMs.length === 0 && mySoulCollectors.length > 0 && player.souls >= GAME_CONSTANTS.SOUL_COSTS.atm && economySpot) {
      let score = 45
      // Low threat = economy focus
      if (threatLevel === 'low') score *= 1.5
      else if (threatLevel === 'critical') score *= 0.2
      
      actions.push({
        action: 'build_atm',
        score,
        execute: () => {
          const spot = findEmptySpot() // Re-check spot at execution time
          if (!spot) return false
          const result = BotAI.executeBuildStructure(player, buildings, 'atm', spot, GAME_CONSTANTS.CELL_SIZE)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 8: UPGRADE SOUL COLLECTOR
    // ------------------------------------------------------------------
    const upgradableSoulCollector = mySoulCollectors.find(s => {
      if (s.level >= 10) return false
      if (player.gold < s.upgradeCost) return false
      const soulCost = soulCostForUpgrade(s.level)
      if (soulCost > 0 && player.souls < soulCost) return false
      return true
    })
    if (upgradableSoulCollector) {
      let score = 30
      if (threatLevel === 'low') score *= 1.5
      else if (threatLevel === 'critical') score *= 0.2
      
      actions.push({
        action: 'upgrade_soul_collector',
        score,
        execute: () => {
          // Upgrade soul collector (similar to turret upgrade)
          if (player.gold < upgradableSoulCollector.upgradeCost) return false
          player.gold -= upgradableSoulCollector.upgradeCost
          upgradableSoulCollector.level++
          upgradableSoulCollector.soulRate = GAME_CONSTANTS.SOUL_COLLECTOR_LEVELS[Math.min(upgradableSoulCollector.level - 1, 5)] || upgradableSoulCollector.level
          upgradableSoulCollector.upgradeCost *= 2
          const pos = gridToWorld({ x: upgradableSoulCollector.gridX, y: upgradableSoulCollector.gridY }, GAME_CONSTANTS.CELL_SIZE)
          spawnFloatingText(pos, `↑ LV${upgradableSoulCollector.level}!`, '#a855f7', 12)
          return true
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 9: UPGRADE ATM
    // ------------------------------------------------------------------
    const upgradableATM = myATMs.find(a => {
      if (a.level >= 10) return false
      if (player.gold < a.upgradeCost) return false
      const soulCost = soulCostForUpgrade(a.level)
      if (soulCost > 0 && player.souls < soulCost) return false
      return true
    })
    if (upgradableATM) {
      let score = 35
      if (threatLevel === 'low') score *= 1.5
      else if (threatLevel === 'critical') score *= 0.2
      
      actions.push({
        action: 'upgrade_atm',
        score,
        execute: () => {
          const result = BotAI.executeUpgradeATM(player, upgradableATM, GAME_CONSTANTS.CELL_SIZE)
          if (result.success && result.floatingText) {
            spawnFloatingText(result.floatingText.position, result.floatingText.text, result.floatingText.color, result.floatingText.size)
          }
          return result.success
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 10: BUILD VANGUARD (Mobile defense units)
    // ------------------------------------------------------------------
    const myVanguards = buildings.filter(b => b.ownerId === player.id && b.type === 'vanguard' && b.hp > 0)
    const vanguardSpot = findEmptySpot()
    if (myVanguards.length < 2 && player.gold >= GAME_CONSTANTS.VANGUARD.GOLD_COST && vanguardSpot) {
      let score = 55
      // First vanguard is valuable for mobile defense
      if (myVanguards.length === 0) score += 30
      // Build vanguard when we have basic defenses
      if (myTurrets.length >= 1 && myRoom.doorLevel >= 2) score += 20
      // High threat = more defensive units
      if (threatLevel === 'high' || threatLevel === 'critical') score *= 1.3
      // Low threat = less priority
      if (threatLevel === 'low') score *= 0.8
      
      actions.push({
        action: 'build_vanguard',
        score,
        execute: () => {
          const spot = findEmptySpot()
          if (!spot) return false
          if (player.gold < GAME_CONSTANTS.VANGUARD.GOLD_COST) return false
          
          player.gold -= GAME_CONSTANTS.VANGUARD.GOLD_COST
          
          const gridX = Math.floor(spot.x / GAME_CONSTANTS.CELL_SIZE)
          const gridY = Math.floor(spot.y / GAME_CONSTANTS.CELL_SIZE)
          
          const building: DefenseBuilding = {
            id: buildings.length,
            type: 'vanguard',
            level: 1,
            gridX,
            gridY,
            hp: GAME_CONSTANTS.BUILDINGS.vanguard.hp,
            maxHp: GAME_CONSTANTS.BUILDINGS.vanguard.hp,
            damage: 0,
            baseDamage: 0,
            range: 0,
            baseRange: 0,
            cooldown: 0,
            currentCooldown: 0,
            ownerId: player.id,
            animationFrame: 0,
            rotation: 0,
            upgradeCost: GAME_CONSTANTS.VANGUARD.UPGRADE_COST
          }
          
          buildings.push(building)
          spawnVanguardUnits(building)
          
          spawnParticles(spot, 'build', 12, '#6366f1')
          spawnFloatingText(spot, '+Vanguard!', '#6366f1', 14)
          return true
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 11: UPGRADE VANGUARD (More units + better stats)
    // ------------------------------------------------------------------
    const upgradableVanguard = myVanguards.find(v => v.level < 7 && player.gold >= v.upgradeCost)
    if (upgradableVanguard) {
      let score = 45
      // Upgrade valuable when have vanguards
      if (threatLevel === 'high' || threatLevel === 'critical') score *= 1.4
      // Higher level = more units
      if (upgradableVanguard.level < 3) score += 20 // Get to 2 units
      
      actions.push({
        action: 'upgrade_vanguard',
        score,
        execute: () => {
          if (player.gold < upgradableVanguard.upgradeCost) return false
          player.gold -= upgradableVanguard.upgradeCost
          upgradableVanguard.level++
          upgradableVanguard.upgradeCost *= 2
          spawnVanguardUnits(upgradableVanguard)
          const pos = gridToWorld({ x: upgradableVanguard.gridX, y: upgradableVanguard.gridY }, GAME_CONSTANTS.CELL_SIZE)
          spawnFloatingText(pos, `↑ LV${upgradableVanguard.level}!`, '#6366f1', 14)
          return true
        }
      })
    }
    
    // =====================================================================
    // EXECUTE BEST ACTION (One action per cycle)
    // =====================================================================
    if (actions.length > 0) {
      // Sort by score descending
      actions.sort((a, b) => b.score - a.score)
      
      // Add slight randomness to mimic human-like decisions (±10% variance)
      const topActions = actions.filter(a => a.score >= actions[0]!.score * 0.9)
      const selectedAction = topActions[Math.floor(Math.random() * topActions.length)]!
      
      // Execute the best action
      selectedAction.execute()
    }
    
    // Continue sleeping (earning gold)
    return
  }
  
  // If currently walking, continue until destination reached
  if (player.state === 'walking' && player.path.length > 0) {
    return
  }
  
  // =========================================================================
  // PHASE 1: No room assigned - RANDOMLY select and claim a room
  // (Prevents predictable patterns, improves replayability)
  // =========================================================================
  if (myRoom === null) {
    // Get all available (unclaimed) rooms
    const availableRooms = rooms.filter(r => r.ownerId === null)
    
    if (availableRooms.length > 0) {
      // RANDOM SELECTION: Pick a random room from available ones
      const randomIndex = Math.floor(Math.random() * availableRooms.length)
      const selectedRoom = availableRooms[randomIndex]!
      
      // Claim the room
      player.roomId = selectedRoom.id
      selectedRoom.ownerId = player.id
      
      // Navigate to room's door
      const walkableGrid = createWalkableGrid(player.id, false)
      player.path = findPath(walkableGrid, player.position, selectedRoom.doorPosition, GAME_CONSTANTS.CELL_SIZE)
      if (player.path.length > 0) {
        player.state = 'walking'
        player.targetPosition = selectedRoom.doorPosition
      }
    }
    return
  }
  
  // Safety check: if room doesn't exist, reset roomId
  if (!myRoom) {
    player.roomId = null
    return
  }
  
  // =========================================================================
  // PHASE 2: Check if inside room, navigate if not
  // =========================================================================
  const cellX = Math.floor(player.position.x / GAME_CONSTANTS.CELL_SIZE)
  const cellY = Math.floor(player.position.y / GAME_CONSTANTS.CELL_SIZE)
  const playerInRoom = cellX >= myRoom.gridX && cellX < myRoom.gridX + myRoom.width &&
                       cellY >= myRoom.gridY && cellY < myRoom.gridY + myRoom.height
  
  // Navigate to room if not inside
  if (!playerInRoom) {
    const walkableGrid = createWalkableGrid(player.id, false)
    const distToDoor = distance(player.position, myRoom.doorPosition)
    if (distToDoor > GAME_CONSTANTS.CELL_SIZE) {
      player.path = findPath(walkableGrid, player.position, myRoom.doorPosition, GAME_CONSTANTS.CELL_SIZE)
    } else {
      player.path = findPath(walkableGrid, player.position, myRoom.bedPosition, GAME_CONSTANTS.CELL_SIZE)
    }
    if (player.path.length > 0) {
      player.state = 'walking'
      player.targetPosition = player.path[player.path.length - 1] || null
    }
    return
  }
  
  // =========================================================================
  // PHASE 3: Inside room - GO TO SLEEP IMMEDIATELY to earn gold!
  // Bot will upgrade things WHILE sleeping (handled above)
  // =========================================================================
  
  // Bot priority: GO TO SLEEP FIRST to start earning gold!
  const distToBed = distance(player.position, myRoom.bedPosition)
  if (distToBed < GAME_CONSTANTS.BED_INTERACT_RANGE) {
    // At bed - start sleeping!
    player.isSleeping = true
    player.state = 'sleeping'
  } else {
    // Walk to bed
    const walkableGrid = createWalkableGrid(player.id, false)
    player.path = findPath(walkableGrid, player.position, myRoom.bedPosition, GAME_CONSTANTS.CELL_SIZE)
    if (player.path.length > 0) {
      player.state = 'walking'
      player.targetPosition = myRoom.bedPosition
    }
  }
}

// Update Vanguard units AI
const updateVanguardAI = (deltaTime: number) => {
  const VANGUARD = GAME_CONSTANTS.VANGUARD
  
  vanguards.forEach(unit => {
    // Handle respawn timer for dead units
    if (unit.state === 'dead') {
      unit.respawnTimer -= deltaTime
      if (unit.respawnTimer <= 0) {
        // Respawn unit at parent building
        const building = buildings.find(b => b.id === unit.buildingId && b.hp > 0)
        if (building) {
          const buildingPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
          unit.position = { x: buildingPos.x + Math.random() * 30 - 15, y: buildingPos.y + Math.random() * 30 - 15 }
          unit.hp = unit.maxHp
          unit.state = 'roaming'
          unit.path = []
          unit.targetMonsterId = false
          spawnFloatingText(unit.position, 'Respawn!', '#22c55e', 12)
        }
      }
      return
    }
    
    // Check if parent building destroyed
    const parentBuilding = buildings.find(b => b.id === unit.buildingId)
    if (!parentBuilding || parentBuilding.hp <= 0) {
      unit.state = 'dead'
      unit.respawnTimer = Infinity // Never respawn if building destroyed
      return
    }
    
    // Attack cooldown
    unit.attackCooldown -= deltaTime
    
    // Find nearest alive monster
    const findNearestMonster = (): Monster | null => {
      const aliveMonsters = monsters.filter(m => m.hp > 0)
      if (aliveMonsters.length === 0) return null
      let nearest = aliveMonsters[0]!
      let nearestDist = distance(unit.position, nearest.position)
      for (const m of aliveMonsters) {
        const d = distance(unit.position, m.position)
        if (d < nearestDist) {
          nearestDist = d
          nearest = m
        }
      }
      return nearest
    }
    
    const targetMonster = findNearestMonster()
    const distToMonster = targetMonster ? distance(unit.position, targetMonster.position) : Infinity
    const monsterAlive = targetMonster !== null && targetMonster.hp > 0
    
    // STATE: CHASING/ATTACKING - pursue monster (increased detection range)
    const effectiveDetectionRange = VANGUARD.DETECTION_RANGE * 2 // Double detection range for better engagement
    
    if (monsterAlive && targetMonster && distToMonster < effectiveDetectionRange) {
      unit.targetMonsterId = true
      
      // In attack range
      if (distToMonster < VANGUARD.ATTACK_RANGE) {
        unit.state = 'attacking'
        unit.path = []
        unit.facingRight = targetMonster.position.x > unit.position.x
        
        if (unit.attackCooldown <= 0) {
          // Attack monster!
          targetMonster.hp -= unit.damage
          unit.attackCooldown = VANGUARD.ATTACK_COOLDOWN
          
          // Monster reacts - prioritize this vanguard
          targetMonster.targetVanguardId = unit.id
          
          // Check if monster should reactivate fleeing
          checkMonsterFleeReactivation(targetMonster)
          
          playSfx('hit')
          spawnParticles(targetMonster.position, 'blood', 6, '#a855f7')
          spawnFloatingText(targetMonster.position, `-${unit.damage}`, '#a855f7', 12)
          
          if (targetMonster.hp <= 0) {
            // Check if all monsters dead
            const allDead = monsters.every(m => m.hp <= 0)
            if (allDead) endGame(true)
          }
        }
      } else {
        // Move towards monster - IMPROVED PATHFINDING
        unit.state = 'chasing'
        
        // Only recalculate path if:
        // 1. Path is empty
        // 2. Monster moved significantly (> 100px from last target)
        // 3. Every 0.5 seconds for path refresh
        const shouldRecalcPath = unit.path.length === 0 || 
          (unit.targetPosition && distance(targetMonster.position, unit.targetPosition) > 100)
        
        if (shouldRecalcPath) {
          const walkableGrid = createWalkableGrid(-1, false, true) // isVanguard=true
          const newPath = findPath(walkableGrid, unit.position, targetMonster.position, mapConfig.value.cellSize)
          
          if (newPath.length > 0) {
            unit.path = newPath
            unit.targetPosition = { ...targetMonster.position }
          }
        }
        
        // Follow path or move directly
        if (unit.path.length > 0) {
          const nextPos = unit.path[0]!
          unit.facingRight = nextPos.x > unit.position.x
          const newPosition = moveTowards(unit.position, nextPos, unit.speed, deltaTime)
          unit.position.x = newPosition.x
          unit.position.y = newPosition.y
          
          if (distance(unit.position, nextPos) < 8) {
            unit.path.shift()
          }
        } else {
          // Direct movement if no path found - always move toward monster
          const newPosition = moveTowards(unit.position, targetMonster.position, unit.speed, deltaTime)
          unit.position.x = newPosition.x
          unit.position.y = newPosition.y
          unit.facingRight = targetMonster.position.x > unit.position.x
        }
      }
    } else {
      // STATE: ROAMING - patrol around looking for monsters
      unit.state = 'roaming'
      unit.targetMonsterId = false
      
      // Random roaming - pick new target when close or no path
      const needNewTarget = !unit.targetPosition || 
        distance(unit.position, unit.targetPosition) < 30 ||
        unit.path.length === 0
      
      if (needNewTarget) {
        // Pick random position biased toward map center (where action is)
        const centerX = GAME_CONSTANTS.WORLD_WIDTH / 2
        const centerY = GAME_CONSTANTS.WORLD_HEIGHT / 2
        const roamRange = 500
        
        // Bias toward center with some randomness
        unit.targetPosition = {
          x: Math.max(100, Math.min(GAME_CONSTANTS.WORLD_WIDTH - 100, 
              centerX + (Math.random() - 0.5) * roamRange)),
          y: Math.max(100, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - 100, 
              centerY + (Math.random() - 0.5) * roamRange))
        }
        
        const walkableGrid = createWalkableGrid(-1, false, true) // isVanguard=true
        unit.path = findPath(walkableGrid, unit.position, unit.targetPosition, GAME_CONSTANTS.CELL_SIZE)
      }
      
      // Follow path
      if (unit.path.length > 0) {
        const nextPos = unit.path[0]!
        unit.facingRight = nextPos.x > unit.position.x
        const newPosition = moveTowards(unit.position, nextPos, unit.speed * 0.6, deltaTime) // Slightly slower roaming
        unit.position.x = newPosition.x
        unit.position.y = newPosition.y
        
        if (distance(unit.position, nextPos) < 8) {
          unit.path.shift()
        }
      } else if (unit.targetPosition) {
        // Direct movement to target if no path
        const newPosition = moveTowards(unit.position, unit.targetPosition, unit.speed * 0.6, deltaTime)
        unit.position.x = newPosition.x
        unit.position.y = newPosition.y
        unit.facingRight = unit.targetPosition.x > unit.position.x
      }
    }
    
    // Animation
    if (unit.state === 'chasing' || unit.state === 'roaming') {
      unit.animationFrame += deltaTime * 8
    }
  })
}

// Update healing points - regenerate mana over time
const updateHealingPoints = (deltaTime: number) => {
  const hConfig = healingPointConfig.value
  const minManaToStart = hConfig.maxMana * hConfig.minManaPercent
  
  for (const hp of healingPoints) {
    // Regenerate mana at configured rate (50 mana/second)
    if (hp.manaPower < hp.maxManaPower) {
      const oldMana = hp.manaPower
      hp.manaPower = Math.min(hp.maxManaPower, hp.manaPower + hp.manaRegenRate * deltaTime)
      
      // Check if this healing point just crossed the minimum threshold
      // If so, reset healingInterrupted for all monsters so they can try to flee again
      if (oldMana < minManaToStart && hp.manaPower >= minManaToStart) {
        for (const monster of monsters) {
          if (monster.healingInterrupted && monster.hp > 0) {
            const mConfig = monsterConfig.value
            const hpRatio = monster.hp / monster.maxHp
            // Only reset if HP is still below threshold
            if (hpRatio < mConfig.healThreshold) {
              monster.healingInterrupted = false
              // Will trigger retreat on next frame
            }
          }
        }
      }
    }
  }
}

// Update buildings
const updateBuildings = (deltaTime: number) => {
  const cellSize = mapConfig.value.cellSize
  
  buildings.forEach(building => {
    if (building.hp <= 0) return
    if (building.type !== 'turret' && building.type !== 'smg') return  // Only turrets and SMG shoot
    
    building.currentCooldown -= deltaTime
    if (building.type === 'smg' && building.burstCooldown !== undefined) {
      building.burstCooldown -= deltaTime
    }
    building.animationFrame += deltaTime * 8
    
    const buildingPos = gridToWorld({ x: building.gridX, y: building.gridY }, cellSize)
    // Calculate actual damage and range based on level - use entity-specific scales
    const actualDamage = getBuildingDamage(building.baseDamage, building.level, building.type as BuildingType)
    const actualRange = getBuildingRange(building.baseRange, building.level, building.type as BuildingType)
    
    // Find nearest alive monster in range
    let targetMonster: Monster | null = null
    let minDist = Infinity
    for (const m of monsters) {
      if (m.hp <= 0) continue
      const d = distance(buildingPos, m.position)
      if (d < actualRange && d < minDist) {
        minDist = d
        targetMonster = m
      }
    }
    
    if (targetMonster) {
      const dx = targetMonster.position.x - buildingPos.x
      const dy = targetMonster.position.y - buildingPos.y
      building.rotation = Math.atan2(dy, dx)
      
      // SMG burst fire logic
      if (building.type === 'smg') {
        // If we have bullets left in burst and burst cooldown is ready
        if (building.burstIndex !== undefined && building.burstIndex > 0 && building.burstCooldown !== undefined && building.burstCooldown <= 0) {
          // Fire one bullet from burst
          projectiles.push({
            position: { ...buildingPos },
            target: { ...targetMonster.position },
            speed: 600,
            damage: actualDamage,
            ownerId: building.ownerId,
            color: '#f59e0b', // Orange for SMG
            size: 4,
            isHoming: true,
            targetMonsterId: targetMonster.id
          })
          building.burstIndex--
          building.burstCooldown = GAME_CONSTANTS.SMG.BURST_INTERVAL
          playSfx('attack')
        }
        // Start new burst when cooldown is ready and no burst in progress
        else if (building.currentCooldown <= 0 && building.burstIndex === 0) {
          building.burstIndex = building.burstCount || GAME_CONSTANTS.SMG.BURST_COUNT
          building.burstCooldown = 0 // Fire immediately
          building.currentCooldown = building.cooldown
        }
      }
      // Normal turret fire
      else if (building.currentCooldown <= 0) {
        projectiles.push({
          position: { ...buildingPos },
          target: { ...targetMonster.position },
          speed: 500,
          damage: actualDamage,
          ownerId: building.ownerId,
          color: '#3b82f6',
          size: 5,
          isHoming: true, // Homing projectile - tracks monster
          targetMonsterId: targetMonster.id // Track which monster to target
        })
        building.currentCooldown = building.cooldown
        playSfx('attack')
      }
    }
  })
}

// Update projectiles
const updateProjectiles = (deltaTime: number) => {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i] as (Projectile & { isSkillArrow?: boolean, skillTargetBuildingId?: number })
    if (!proj) continue
    
    // Handle skill arrow from Phantom Knight
    if (proj.isSkillArrow && proj.skillTargetBuildingId !== undefined) {
      const moved = moveTowards(proj.position, proj.target, 400, deltaTime) // Arrow speed 400
      proj.position.x = moved.x
      proj.position.y = moved.y
      
      // Check if arrow reached target
      if (distance(proj.position, proj.target) < 15) {
        const targetBuilding = buildings.find(b => b.id === proj.skillTargetBuildingId)
        if (targetBuilding && targetBuilding.hp > 0) {
          // Destroy the structure
          targetBuilding.hp = 0
          
          spawnFloatingText(
            proj.target,
            `💥 PHÁT HỦY!`,
            '#dc2626',
            18
          )
          spawnParticles(proj.target, 'explosion', 15, '#6366f1')
        }
        projectiles.splice(i, 1)
        continue
      }
      continue
    }
    
    // Find target monster - use targetMonsterId if set, otherwise first alive monster
    const targetMonster = proj.targetMonsterId !== undefined
      ? monsters.find(m => m.id === proj.targetMonsterId)
      : monsters.find(m => m.hp > 0)
    
    // Homing projectiles track the monster's current position
    if (proj.isHoming && targetMonster && targetMonster.hp > 0) {
      proj.target.x = targetMonster.position.x
      proj.target.y = targetMonster.position.y
    }
    
    const moved = moveTowards(proj.position, proj.target, proj.speed, deltaTime)
    proj.position.x = moved.x
    proj.position.y = moved.y
    
    // Check hit against all monsters
    let hitMonster: Monster | null = null
    for (const m of monsters) {
      if (m.hp <= 0) continue
      if (distance(proj.position, m.position) < 40) {
        hitMonster = m
        break
      }
    }
    
    if (hitMonster) {
      hitMonster.hp -= proj.damage
      spawnParticles(proj.position, 'explosion', 8, proj.color)
      spawnFloatingText(proj.position, `-${proj.damage}`, '#3b82f6', 14)
      projectiles.splice(i, 1)
      
      // Check if monster should reactivate fleeing
      checkMonsterFleeReactivation(hitMonster)
      
      // Check if all monsters dead
      if (hitMonster.hp <= 0) {
        const allDead = monsters.every(m => m.hp <= 0)
        if (allDead) endGame(true)
      }
      continue
    }
    
    // Non-homing projectiles disappear when reaching original target
    if (!proj.isHoming && distance(proj.position, proj.target) < 10) projectiles.splice(i, 1)
  }
}

// Update particles
const updateParticles = (deltaTime: number) => {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    if (!p) continue
    p.position.x += p.velocity.x * deltaTime
    p.position.y += p.velocity.y * deltaTime
    p.velocity.y += 250 * deltaTime
    p.life -= deltaTime
    if (p.life <= 0) particles.splice(i, 1)
  }
}

// Update floating texts
const updateFloatingTexts = (deltaTime: number) => {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i]
    if (!ft) continue
    ft.position.x += ft.velocity.x * deltaTime
    ft.position.y += ft.velocity.y * deltaTime
    ft.velocity.y *= 0.95 // Slow down
    ft.life -= deltaTime
    if (ft.life <= 0) floatingTexts.splice(i, 1)
  }
}

// Smooth movement interpolation
const smoothMove = (entity: Player, deltaTime: number) => {
  const factor = 1 - Math.pow(1 - GAME_CONSTANTS.SMOOTH_FACTOR, deltaTime * 60)
  entity.smoothX += (entity.position.x - entity.smoothX) * factor
  entity.smoothY += (entity.position.y - entity.smoothY) * factor
}

// Move entity along path
const moveAlongPath = (entity: Player | Monster, deltaTime: number) => {
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
  
  if (distance(entity.position, target) < 8) entity.path.shift()
}

// Camera follow human player (only if not in manual mode)
const updateCamera = () => {
  if (!humanPlayer.value) return
  
  // Skip auto-follow if user manually moved the camera
  if (!cameraManualMode.value) {
    const targetX = humanPlayer.value.smoothX - viewportWidth.value / 2
    const targetY = humanPlayer.value.smoothY - viewportHeight.value / 2
    
    camera.x += (targetX - camera.x) * 0.05
    camera.y += (targetY - camera.y) * 0.05
  }
  
  const pad = cameraManualMode.value ? GAME_CONSTANTS.CAMERA_PADDING : 0
  camera.x = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_WIDTH - viewportWidth.value + pad, camera.x))
  camera.y = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight.value + pad, camera.y))
  
  // Update near bed detection - show sleep button when inside ANY room and near bed
  if (humanPlayer.value.alive && !humanPlayer.value.isSleeping) {
    // Find the room the player is currently standing in
    const cellX = Math.floor(humanPlayer.value.position.x / GAME_CONSTANTS.CELL_SIZE)
    const cellY = Math.floor(humanPlayer.value.position.y / GAME_CONSTANTS.CELL_SIZE)
    const cell = grid[cellY]?.[cellX]
    
    if (cell && (cell.type === 'room' || cell.type === 'door') && cell.roomId !== undefined) {
      const currentRoom = rooms[cell.roomId]
      if (currentRoom) {
        // Check if room is available or owned by player
        const canClaimOrOwns = currentRoom.ownerId === null || currentRoom.ownerId === humanPlayer.value.id
        const distToBed = distance(humanPlayer.value.position, currentRoom.bedPosition)
        
        if (canClaimOrOwns) {
          isNearBed.value = distToBed < GAME_CONSTANTS.BED_INTERACT_RANGE * 1.5 // Larger range for visibility
          currentNearRoom.value = currentRoom
        } else {
          isNearBed.value = false
          currentNearRoom.value = null
        }
      } else {
        isNearBed.value = false
        currentNearRoom.value = null
      }
    } else {
      isNearBed.value = false
      currentNearRoom.value = null
    }
  } else {
    isNearBed.value = false
    currentNearRoom.value = null
  }
}

// Game loop
const gameLoop = (timestamp: number) => {
  // Don't update game if paused
  if (isPaused.value) {
    animationId = requestAnimationFrame(gameLoop)
    return
  }
  
  const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1)
  lastTime = timestamp
  
  // Countdown controls when monster starts hunting (game already running)
  if (!monsterActive.value && countdown.value > 0) {
    countdown.value -= deltaTime
    
    // AI selects rooms early
    if (countdown.value < GAME_CONSTANTS.COUNTDOWN_TIME - 2) aiSelectRooms()
    
    // AI claim rooms when reaching beds
    players.forEach(p => aiClaimRoomIfNearBed(p))
    
    if (countdown.value <= 0) {
      monsterActive.value = true
      addMessage(t('messages.monsterHunting'))
      playSfx('click')
      
      // LATE PLAYER ENFORCEMENT - players not sleeping get targeted!
      enforceLatePlayerPenalty()
    }
  }
  
  if (gamePhase.value === 'playing') {
    // Update human player continuous movement first
    updatePlayerMovement(deltaTime)
    
    players.forEach(player => {
      if (!player.alive) return
      
      // Gold from sleeping - discrete per second with exponential scaling
      if (player.isSleeping && player.roomId !== null) {
        const room = rooms.find(r => r.id === player.roomId)
        if (room) {
          // Update sleep timer
          player.sleepTimer += deltaTime
          
          // Get gold rate from bed income (doubles each upgrade)
          const goldRate = getGoldPerSecond(room)
          // Initialize accumulator if needed
          if (goldAccumulator[player.id] === undefined) goldAccumulator[player.id] = 0
          const playerAccum = goldAccumulator[player.id]!
          goldAccumulator[player.id] = playerAccum + deltaTime
          // Add gold every second
          if (goldAccumulator[player.id]! >= 1) {
            const secondsPassed = Math.floor(goldAccumulator[player.id]!)
            const goldToAdd = goldRate * secondsPassed
            player.gold += goldToAdd
            goldAccumulator[player.id] = goldAccumulator[player.id]! - secondsPassed
            // Show floating gold text
            if (player.isHuman) {
              spawnFloatingText(player.position, `+${goldToAdd}$`, '#fbbf24', 14)
            }
          }
        }
      } else {
        // Reset accumulator and sleep timer when not sleeping
        goldAccumulator[player.id] = 0
        player.sleepTimer = 0
      }
      
      if (player.state === 'walking') moveAlongPath(player, deltaTime)
      smoothMove(player, deltaTime)
      
      if (!player.isHuman && gamePhase.value === 'playing') {
        updatePlayerAI(player, deltaTime)
      }
    })
    
    // Update rooms (door repair, cooldowns, door animation)
    rooms.forEach(room => {
      // Door repair cooldown
      if (room.doorRepairCooldown > 0) {
        room.doorRepairCooldown -= deltaTime
      }
      
      // Door repair in progress
      if (room.doorIsRepairing) {
        room.doorRepairTimer += deltaTime
        const healPerSecond = (room.doorMaxHp * GAME_CONSTANTS.DOOR_REPAIR_PERCENT) / GAME_CONSTANTS.DOOR_REPAIR_DURATION
        room.doorHp = Math.min(room.doorMaxHp, room.doorHp + healPerSecond * deltaTime)
        
        if (room.doorRepairTimer >= GAME_CONSTANTS.DOOR_REPAIR_DURATION) {
          room.doorIsRepairing = false
          room.doorRepairTimer = 0
          room.doorRepairCooldown = GAME_CONSTANTS.DOOR_REPAIR_COOLDOWN
          
          // Notify owner
          const owner = players.find(p => p.id === room.ownerId)
          if (owner?.isHuman) {
            addMessage(t('messages.doorRepairComplete'))
          }
        }
      }
      
      // Door animation - smooth open/close
      const hasSleepingPlayer = players.some(p => p.alive && p.roomId === room.id && p.isSleeping)
      room.doorAnimTarget = (hasSleepingPlayer && room.doorHp > 0) ? 1 : 0
      
      const animSpeed = 3.0 // Animation speed (per second)
      if (room.doorAnimProgress < room.doorAnimTarget) {
        room.doorAnimProgress = Math.min(room.doorAnimTarget, room.doorAnimProgress + animSpeed * deltaTime)
      } else if (room.doorAnimProgress > room.doorAnimTarget) {
        room.doorAnimProgress = Math.max(room.doorAnimTarget, room.doorAnimProgress - animSpeed * deltaTime)
      }
    })
    
    // Update ATM and Soul Collector income
    buildings.forEach(building => {
      if (building.hp <= 0) return
      const owner = players.find(p => p.id === building.ownerId)
      if (!owner) return
      
      if (building.type === 'atm' && building.goldRate) {
        // ATM generates gold per second
        if (goldAccumulator[building.id + 1000] === undefined) goldAccumulator[building.id + 1000] = 0
        goldAccumulator[building.id + 1000] = goldAccumulator[building.id + 1000]! + deltaTime
        if (goldAccumulator[building.id + 1000]! >= 1) {
          const goldToAdd = building.goldRate
          owner.gold += goldToAdd
          goldAccumulator[building.id + 1000] = goldAccumulator[building.id + 1000]! - 1
          if (owner.isHuman) {
            const bPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
            spawnFloatingText(bPos, `+${goldToAdd}$`, '#22c55e', 12)
          }
        }
      }
      
      if (building.type === 'soul_collector' && building.soulRate) {
        // Soul Collector generates souls per second
        if (goldAccumulator[building.id + 2000] === undefined) goldAccumulator[building.id + 2000] = 0
        goldAccumulator[building.id + 2000] = goldAccumulator[building.id + 2000]! + deltaTime
        if (goldAccumulator[building.id + 2000]! >= 1) {
          const soulsToAdd = building.soulRate
          owner.souls += soulsToAdd
          goldAccumulator[building.id + 2000] = goldAccumulator[building.id + 2000]! - 1
          if (owner.isHuman) {
            const bPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
            spawnFloatingText(bPos, `+${soulsToAdd}✧`, '#a855f7', 12)
          }
        }
      }
    })
    
    // Monster only active after countdown ends
    if (monsterActive.value) {
      // Move all walking monsters
      for (const monster of monsters) {
        if (monster.state === 'walking') moveAlongPath(monster, deltaTime)
      }
      updateMonsterAI(deltaTime)
    }
    
    // Vanguards always active
    updateVanguardAI(deltaTime)
    
    // Healing points mana regeneration
    updateHealingPoints(deltaTime)
    
    // Buildings always active (can shoot during countdown too)
    updateBuildings(deltaTime)
    updateProjectiles(deltaTime)
    
    updateParticles(deltaTime)
    updateFloatingTexts(deltaTime)
    updateScreenShake(deltaTime)
    updateCamera()
  }
  
  render()
  if (!gameOver.value) animationId = requestAnimationFrame(gameLoop)
}

// Render
const render = () => {
  if (!ctx || !canvasRef.value) return
  
  const canvas = canvasRef.value
  
  // Disable image smoothing for crisp pixel art
  ctx.imageSmoothingEnabled = false
  
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  ctx.save()
  // Apply camera position + screen shake
  ctx.translate(-camera.x + cameraShake.x, -camera.y + cameraShake.y)
  
  const cellSize = GAME_CONSTANTS.CELL_SIZE
  
  // Draw grid
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (!cell) continue
      const px = x * cellSize
      const py = y * cellSize
      
      // Skip if out of view
      if (px + cellSize < camera.x || px > camera.x + viewportWidth.value) continue
      if (py + cellSize < camera.y || py > camera.y + viewportHeight.value) continue
      
      // Skip empty cells - don't render them
      if (cell.type === 'empty') continue
      
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 1
      
      switch (cell.type) {
        case 'corridor':
          ctx.fillStyle = '#1a1a2e'
          break
        case 'room': {
          // All rooms have the same color
          ctx.fillStyle = '#2a2a3e'
          break
        }
        case 'wall': {
          // Walls are darker and have a border
          ctx.fillStyle = '#151520'
          break
        }
        case 'door': {
          // Door cells are drawn separately
          ctx.fillStyle = '#1a1a2e'
          break
        }
        case 'heal_zone':
          ctx.fillStyle = '#1a4a1a'
          break
        default:
          ctx.fillStyle = '#0a0a0a'
      }
      ctx.fillRect(px, py, cellSize, cellSize)
      
      // Draw grid lines except for walls
      if (cell.type !== 'wall') {
        ctx.strokeRect(px, py, cellSize, cellSize)
      }
      
      // Wall border effect
      if (cell.type === 'wall') {
        ctx.fillStyle = '#252530'
        ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4)
      }
      
      // Heal zone glow (monster nests) - intensity based on mana level
      if (cell.type === 'heal_zone') {
        // Find the healing point for this cell
        const healPoint = healingPoints.find(hp => 
          x >= hp.gridX && x < hp.gridX + hp.width &&
          y >= hp.gridY && y < hp.gridY + hp.height
        )
        const manaPercent = healPoint ? healPoint.manaPower / healPoint.maxManaPower : 0
        const minManaPercent = GAME_CONSTANTS.HEALING_POINT_MIN_MANA_PERCENT
        const hasEnoughMana = manaPercent >= minManaPercent
        
        // Color intensity based on mana level (red when depleted, green when full)
        const glowIntensity = 0.15 + Math.sin(Date.now() / 400) * 0.1
        if (hasEnoughMana) {
          // Healthy glow - green/blue tint
          ctx.fillStyle = `rgba(34, 197, 94, ${glowIntensity * manaPercent})`
        } else {
          // Depleted - red warning
          ctx.fillStyle = `rgba(239, 68, 68, ${glowIntensity * 0.5})`
        }
        ctx.fillRect(px, py, cellSize, cellSize)
        
        // Nest icon with mana indicator - draw a crystal shape
        ctx.fillStyle = hasEnoughMana ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.6)'
        const cx = px + cellSize / 2
        const cy = py + cellSize / 2
        ctx.beginPath()
        ctx.moveTo(cx, cy - 12)
        ctx.lineTo(cx + 8, cy)
        ctx.lineTo(cx, cy + 12)
        ctx.lineTo(cx - 8, cy)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = hasEnoughMana ? '#22c55e' : '#ef4444'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      
      // Central spawn zone marker
      if (isInSpawnZone(x, y)) {
        ctx.fillStyle = `rgba(96, 165, 250, ${0.1 + Math.sin(Date.now() / 500) * 0.05})`
        ctx.fillRect(px, py, cellSize, cellSize)
      }
    }
  }
  
  // Draw spawn zone border
  const sz = spawnZone.value
  const szPx = sz.gridX * cellSize
  const szPy = sz.gridY * cellSize
  const szWidth = sz.width * cellSize
  const szHeight = sz.height * cellSize
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)'
  ctx.lineWidth = 3
  ctx.setLineDash([10, 5])
  ctx.strokeRect(szPx, szPy, szWidth, szHeight)
  ctx.setLineDash([])
  
  // Draw spawn zone label
  ctx.fillStyle = 'rgba(96, 165, 250, 0.8)'
  ctx.font = 'bold 14px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('★ SPAWN ZONE ★', szPx + szWidth / 2, szPy + szHeight / 2)
  
  // Draw healing point mana bars
  healingPoints.forEach(hp => {
    if (!ctx) return
    const centerX = hp.position.x
    const barWidth = hp.width * cellSize - 20
    const barHeight = 12
    const barX = hp.gridX * cellSize + 10
    const barY = (hp.gridY + hp.height) * cellSize + 5
    
    const manaPercent = hp.manaPower / hp.maxManaPower
    const minManaPercent = GAME_CONSTANTS.HEALING_POINT_MIN_MANA_PERCENT
    const hasEnoughMana = manaPercent >= minManaPercent
    
    // Background
    ctx.fillStyle = '#222'
    ctx.fillRect(barX, barY, barWidth, barHeight)
    
    // Mana bar - blue when healthy, red when depleted
    ctx.fillStyle = hasEnoughMana ? '#3b82f6' : '#ef4444'
    ctx.fillRect(barX, barY, barWidth * manaPercent, barHeight)
    
    // Border
    ctx.strokeStyle = hasEnoughMana ? '#60a5fa' : '#f87171'
    ctx.lineWidth = 2
    ctx.strokeRect(barX, barY, barWidth, barHeight)
    
    // Mana text
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const manaText = `${Math.floor(hp.manaPower)}/${hp.maxManaPower}`
    ctx.fillText(manaText, barX + barWidth / 2, barY + barHeight / 2)
    
    // Healing point label
    ctx.fillStyle = hasEnoughMana ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)'
    ctx.font = 'bold 12px Arial'
    ctx.fillText(hasEnoughMana ? '◆ NEST' : '✖ DEPLETED', centerX, hp.gridY * cellSize - 8)
  })
  
  // Draw rooms with details
  rooms.forEach(room => {
    if (!ctx) return
    
    // Check if door should be closed (someone sleeping inside)
    const hasSleepingPlayer = players.some(p => p.alive && p.roomId === room.id && p.isSleeping)
    const isDoorClosed = hasSleepingPlayer && room.doorHp > 0
    
    // Draw room border following actual shape (for L, U, T shapes)
    const ownerColor = room.ownerId !== null ? players[room.ownerId]?.color || '#555' : '#333'
    ctx.strokeStyle = ownerColor
    ctx.lineWidth = 4
    
    // For each cell in shape, draw edges that don't have neighbors (outer border)
    room.shapeCells.forEach(cell => {
      if (!ctx) return
      const worldX = room.gridX + cell.x
      const worldY = room.gridY + cell.y
      const cellPx = worldX * cellSize
      const cellPy = worldY * cellSize
      
      // Check which neighbors exist in the shape
      const hasTop = room.shapeCells.some(c => c.x === cell.x && c.y === cell.y - 1)
      const hasBottom = room.shapeCells.some(c => c.x === cell.x && c.y === cell.y + 1)
      const hasLeft = room.shapeCells.some(c => c.x === cell.x - 1 && c.y === cell.y)
      const hasRight = room.shapeCells.some(c => c.x === cell.x + 1 && c.y === cell.y)
      
      // Draw edges where there's no neighbor (outer border)
      ctx.beginPath()
      if (!hasTop) {
        ctx.moveTo(cellPx, cellPy)
        ctx.lineTo(cellPx + cellSize, cellPy)
      }
      if (!hasBottom) {
        ctx.moveTo(cellPx, cellPy + cellSize)
        ctx.lineTo(cellPx + cellSize, cellPy + cellSize)
      }
      if (!hasLeft) {
        ctx.moveTo(cellPx, cellPy)
        ctx.lineTo(cellPx, cellPy + cellSize)
      }
      if (!hasRight) {
        ctx.moveTo(cellPx + cellSize, cellPy)
        ctx.lineTo(cellPx + cellSize, cellPy + cellSize)
      }
      ctx.stroke()
    })
    
    // Door position (use actual door grid position)
    const doorPx = room.doorGridX * cellSize
    const doorPy = room.doorGridY * cellSize
    const doorHpPercent = room.doorHp / room.doorMaxHp
    
    // Draw door at correct position
    if (room.doorHp <= 0) {
      // Door broken - show rubble/debris
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(doorPx + 8, doorPy + 8, cellSize - 16, cellSize - 16)
      // Draw debris pieces
      ctx.fillStyle = '#4a4a4a'
      ctx.fillRect(doorPx + 12, doorPy + 20, 8, 6)
      ctx.fillRect(doorPx + 25, doorPy + 15, 10, 5)
      ctx.fillRect(doorPx + 18, doorPy + 28, 12, 4)
      ctx.fillStyle = '#3a3a3a'
      ctx.fillRect(doorPx + 30, doorPy + 25, 6, 8)
      // X mark
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(doorPx + 15, doorPy + 15)
      ctx.lineTo(doorPx + cellSize - 15, doorPy + cellSize - 15)
      ctx.moveTo(doorPx + cellSize - 15, doorPy + 15)
      ctx.lineTo(doorPx + 15, doorPy + cellSize - 15)
      ctx.stroke()
    } else if (isDoorClosed) {
      // Door closed - solid wooden door with metal reinforcement
      // Door animation state (for smooth closing)
      const doorProgress = room.doorAnimProgress ?? 1
      const doorWidth = (cellSize - 20) * doorProgress
      
      // Door frame
      ctx.fillStyle = '#3a2a1a'
      ctx.fillRect(doorPx + 10, doorPy + 10, cellSize - 20, cellSize - 20)
      
      // Door panel (animated width)
      ctx.fillStyle = '#6a4a2a'
      ctx.fillRect(doorPx + 10, doorPy + 10, doorWidth, cellSize - 20)
      
      // Wood grain lines
      if (doorProgress > 0.5) {
        ctx.strokeStyle = '#5a3a1a'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(doorPx + 15, doorPy + 15)
        ctx.lineTo(doorPx + 15, doorPy + cellSize - 15)
        ctx.moveTo(doorPx + cellSize/2, doorPy + 15)
        ctx.lineTo(doorPx + cellSize/2, doorPy + cellSize - 15)
        ctx.stroke()
      }
      
      // Metal reinforcement bars
      ctx.fillStyle = '#8a7a6a'
      ctx.fillRect(doorPx + 10, doorPy + 18, Math.min(doorWidth, cellSize - 20), 4)
      ctx.fillRect(doorPx + 10, doorPy + cellSize - 22, Math.min(doorWidth, cellSize - 20), 4)
      
      // Lock/handle
      if (doorProgress > 0.8) {
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(doorPx + cellSize - 18, doorPy + cellSize/2, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#b8860b'
        ctx.beginPath()
        ctx.arc(doorPx + cellSize - 18, doorPy + cellSize/2, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      
      // Border
      ctx.strokeStyle = '#8a6a4a'
      ctx.lineWidth = 3
      ctx.strokeRect(doorPx + 10, doorPy + 10, cellSize - 20, cellSize - 20)
    } else {
      // Door open - just frame with open archway
      const doorProgress = room.doorAnimProgress ?? 0
      
      // Door frame (stone/wood arch)
      ctx.fillStyle = '#4a3a2a'
      ctx.fillRect(doorPx + 8, doorPy + 8, 6, cellSize - 16) // Left pillar
      ctx.fillRect(doorPx + cellSize - 14, doorPy + 8, 6, cellSize - 16) // Right pillar
      ctx.fillRect(doorPx + 8, doorPy + 8, cellSize - 16, 6) // Top beam
      
      // Inner doorway (darker)
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(doorPx + 14, doorPy + 14, cellSize - 28, cellSize - 22)
      
      // If door is animating (partially closed)
      if (doorProgress > 0) {
        const partialWidth = (cellSize - 28) * doorProgress
        ctx.fillStyle = '#6a4a2a'
        ctx.fillRect(doorPx + 14, doorPy + 14, partialWidth, cellSize - 22)
      }
      
      // Frame highlight
      ctx.strokeStyle = doorHpPercent > 0.5 ? '#5a7a5a' : doorHpPercent > 0.2 ? '#7a6a4a' : '#7a4a4a'
      ctx.lineWidth = 2
      ctx.strokeRect(doorPx + 10, doorPy + 10, cellSize - 20, cellSize - 20)
    }
    
    // Door level badge (top-left of door cell)
    if (room.doorHp > 0) {
      ctx.fillStyle = '#1e40af'
      ctx.beginPath()
      ctx.arc(doorPx + 10, doorPy + 10, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${room.doorLevel}`, doorPx + 10, doorPy + 14)
      
      // UPGRADE INDICATOR: Show pulsing glow when player can upgrade
      if (humanPlayer.value && humanPlayer.value.roomId === room.id && room.doorLevel < 6) {
        const playerDistToDoor = distance(humanPlayer.value.position, room.doorPosition)
        if (playerDistToDoor < GAME_CONSTANTS.CELL_SIZE * 3) {
          const pulse = 0.3 + Math.sin(Date.now() / 200) * 0.2
          ctx.strokeStyle = `rgba(96, 165, 250, ${pulse})`
          ctx.lineWidth = 4
          ctx.strokeRect(doorPx + 4, doorPy + 4, cellSize - 8, cellSize - 8)
          // Show upgrade arrow
          ctx.fillStyle = '#60a5fa'
          ctx.font = 'bold 16px Arial'
          ctx.fillText('⬆', doorPx + cellSize - 12, doorPy + 18)
        }
      }
    }
    
    // Door HP bar (small, attached below door cell)
    const doorBarWidth = cellSize - 16
    const doorBarHeight = 6
    const doorBarX = doorPx + 8
    const doorBarY = doorPy + cellSize - 4
    ctx.fillStyle = '#222'
    ctx.fillRect(doorBarX, doorBarY, doorBarWidth, doorBarHeight)
    ctx.fillStyle = doorHpPercent > 0.5 ? '#22c55e' : doorHpPercent > 0.2 ? '#eab308' : '#ef4444'
    ctx.fillRect(doorBarX, doorBarY, doorBarWidth * doorHpPercent, doorBarHeight)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.strokeRect(doorBarX, doorBarY, doorBarWidth, doorBarHeight)
    
    // Bed - redesigned game-style bed
    const bedX = room.bedPosition.x
    const bedY = room.bedPosition.y
    
    // Bed frame (wooden)
    ctx.fillStyle = '#5a3a1a'
    ctx.fillRect(bedX - 28, bedY - 18, 56, 36)
    
    // Bed mattress
    ctx.fillStyle = '#8b6b4b'
    ctx.fillRect(bedX - 24, bedY - 14, 48, 28)
    
    // Pillow
    ctx.fillStyle = '#e8dcc8'
    ctx.fillRect(bedX - 22, bedY - 12, 16, 10)
    
    // Blanket (color based on level)
    const blanketColors = ['#4a6a8a', '#5a7a5a', '#7a5a7a', '#8a6a4a', '#6a4a4a', '#3a3a6a']
    ctx.fillStyle = blanketColors[Math.min(room.bedLevel - 1, blanketColors.length - 1)] || '#4a6a8a'
    ctx.fillRect(bedX - 4, bedY - 12, 26, 24)
    
    // Blanket pattern (stripes for higher levels)
    if (room.bedLevel >= 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(bedX + 2, bedY - 12, 4, 24)
      ctx.fillRect(bedX + 12, bedY - 12, 4, 24)
    }
    
    // Bed legs
    ctx.fillStyle = '#3a2a1a'
    ctx.fillRect(bedX - 26, bedY + 14, 6, 6)
    ctx.fillRect(bedX + 20, bedY + 14, 6, 6)
    
    // Level badge
    ctx.fillStyle = '#1e40af'
    ctx.beginPath()
    ctx.arc(bedX + 24, bedY - 14, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${room.bedLevel}`, bedX + 24, bedY - 10)
    
    // BED UPGRADE INDICATOR: Show pulsing glow when player is sleeping and can upgrade
    if (humanPlayer.value && humanPlayer.value.roomId === room.id && humanPlayer.value.isSleeping) {
      const pulse = 0.3 + Math.sin(Date.now() / 200) * 0.2
      ctx.strokeStyle = `rgba(251, 191, 36, ${pulse})`
      ctx.lineWidth = 3
      ctx.strokeRect(bedX - 30, bedY - 20, 60, 40)
      // Show upgrade arrow
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 14px Arial'
      ctx.fillText('▲', bedX + 32, bedY - 10)
    }
    
    // Build spots - highlight green when player is in this room
    const isPlayerRoom = humanPlayer.value?.roomId === room.id
    room.buildSpots.forEach(spot => {
      if (!ctx) return
      const hasBuilding = buildings.some(b => {
        const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, cellSize)
        return b.hp > 0 && distance(bPos, spot) < 30
      })
      
      // Show destroyed spots differently
      if (spot.isDestroyed) {
        // Draw destroyed/ruined marker
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'
        ctx.fillRect(spot.x - 20, spot.y - 20, 40, 40)
        ctx.strokeStyle = '#7f1d1d'
        ctx.lineWidth = 2
        ctx.setLineDash([3, 3])
        ctx.strokeRect(spot.x - 20, spot.y - 20, 40, 40)
        ctx.setLineDash([])
        // Draw X mark
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(spot.x - 12, spot.y - 12)
        ctx.lineTo(spot.x + 12, spot.y + 12)
        ctx.moveTo(spot.x + 12, spot.y - 12)
        ctx.lineTo(spot.x - 12, spot.y + 12)
        ctx.stroke()
      } else if (!hasBuilding) {
        // Highlight more prominently if this is player's room
        if (isPlayerRoom && gamePhase.value === 'playing') {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'
          ctx.fillRect(spot.x - 20, spot.y - 20, 40, 40)
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 3
        } else {
          ctx.strokeStyle = '#3a5a3a'
          ctx.lineWidth = 2
        }
        ctx.setLineDash([5, 5])
        ctx.strokeRect(spot.x - 20, spot.y - 20, 40, 40)
        ctx.setLineDash([])
        
        // Show + icon for player's room
        if (isPlayerRoom && gamePhase.value === 'playing') {
          ctx.fillStyle = '#22c55e'
          ctx.font = '20px Arial'
          ctx.textAlign = 'center'
          ctx.fillText('+', spot.x, spot.y + 7)
        }
      }
    })
  })
  
  // Draw buildings
  buildings.forEach(building => {
    if (!ctx || building.hp <= 0) return
    const pos = gridToWorld({ x: building.gridX, y: building.gridY }, cellSize)
    
    ctx.save()
    ctx.translate(pos.x, pos.y)
    
    if (building.type === 'turret') {
      ctx.rotate(building.rotation)
    }
    
    const colors: Record<string, string> = { 
      turret: '#3b82f6', 
      atm: '#22c55e', 
      soul_collector: '#a855f7',
      vanguard: '#6366f1',
      smg: '#f97316'
    }
    ctx.fillStyle = colors[building.type] || '#888'
    
    if (building.type === 'turret') {
      ctx.fillRect(-18, -10, 36, 20)
      ctx.fillStyle = '#1e40af'
      ctx.fillRect(12, -6, 18, 12)
    } else if (building.type === 'atm') {
      // ATM - rectangular box with slot
      ctx.fillRect(-20, -16, 40, 32)
      ctx.fillStyle = '#15803d'
      ctx.fillRect(-14, -10, 28, 6)  // Screen
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(-10, 0, 20, 4)    // Gold slot
    } else if (building.type === 'soul_collector') {
      // Soul collector - mystical orb
      ctx.beginPath()
      ctx.arc(0, 0, 20, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#c084fc'
      ctx.beginPath()
      ctx.arc(0, 0, 12, 0, Math.PI * 2)
      ctx.fill()
      // Ghost icon effect - draw a spirit shape
      const pulse = Math.sin(Date.now() / 300) * 3
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.moveTo(0, -8 + pulse)
      ctx.bezierCurveTo(-6, -4 + pulse, -6, 6 + pulse, 0, 8 + pulse)
      ctx.bezierCurveTo(6, 6 + pulse, 6, -4 + pulse, 0, -8 + pulse)
      ctx.fill()
    } else if (building.type === 'vanguard') {
      // Vanguard Barracks - military tent/barracks style
      ctx.fillRect(-22, -18, 44, 36)
      ctx.fillStyle = '#4338ca'
      ctx.fillRect(-18, -14, 36, 28)
      // Flag
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(14, -18)
      ctx.lineTo(14, -30)
      ctx.lineTo(24, -24)
      ctx.lineTo(14, -18)
      ctx.fill()
      // Sword emblem - draw crossed swords
      ctx.strokeStyle = '#c0c0c0'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-8, -6)
      ctx.lineTo(8, 6)
      ctx.moveTo(8, -6)
      ctx.lineTo(-8, 6)
      ctx.stroke()
      // Handle
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(-2, 8, 4, 4)
      // Show unit count
      const unitCount = getVanguardUnitCount(building.level)
      const aliveUnits = vanguards.filter(v => v.buildingId === building.id && v.state !== 'dead').length
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 10px Arial'
      ctx.fillText(`${aliveUnits}/${unitCount}`, 0, 14)
    } else if (building.type === 'smg') {
      // SMG - Multi-barrel gun turret (orange themed)
      // Outer glow ring
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, 18, 0, Math.PI * 2)
      ctx.stroke()
      
      // Base platform - dark orange/brown
      ctx.fillStyle = '#78350f'
      ctx.beginPath()
      ctx.arc(0, 0, 16, 0, Math.PI * 2)
      ctx.fill()
      
      // Inner ring - orange
      ctx.fillStyle = '#ea580c'
      ctx.beginPath()
      ctx.arc(0, 0, 11, 0, Math.PI * 2)
      ctx.fill()
      
      // Rotate barrels toward target
      ctx.save()
      ctx.rotate(building.rotation || 0)
      
      // Barrel housing - dark box
      ctx.fillStyle = '#292524'
      ctx.fillRect(0, -8, 20, 16)
      
      // 3 barrel tubes - orange
      ctx.fillStyle = '#f97316'
      ctx.fillRect(4, -6, 18, 3)   // Top barrel
      ctx.fillRect(4, -1.5, 18, 3) // Middle barrel
      ctx.fillRect(4, 3, 18, 3)    // Bottom barrel
      
      // Barrel tips - bright yellow/orange glow
      ctx.fillStyle = '#fcd34d'
      ctx.beginPath()
      ctx.arc(22, -4.5, 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(22, 0, 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(22, 4.5, 2.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.restore()
      
      // Center core - bright orange
      ctx.fillStyle = '#fb923c'
      ctx.beginPath()
      ctx.arc(0, 0, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()
    
    // Building HP bar
    const hpPercent = building.hp / building.maxHp
    ctx.fillStyle = '#222'
    ctx.fillRect(pos.x - 18, pos.y - 28, 36, 6)
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(pos.x - 18, pos.y - 28, 36 * hpPercent, 6)
    
    // Building level indicator
    ctx.fillStyle = '#1e40af'
    ctx.beginPath()
    ctx.arc(pos.x + 20, pos.y - 20, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${building.level}`, pos.x + 20, pos.y - 17)
    
    // UPGRADE INDICATOR: Show pulsing glow when player is near and can upgrade
    if (humanPlayer.value && building.ownerId === humanPlayer.value.id && building.level < 5) {
      const playerDistToBuilding = distance(humanPlayer.value.position, pos)
      if (playerDistToBuilding < GAME_CONSTANTS.CELL_SIZE * 3) {
        const pulse = 0.3 + Math.sin(Date.now() / 200) * 0.2
        ctx.strokeStyle = `rgba(96, 165, 250, ${pulse})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2)
        ctx.stroke()
        // Show upgrade arrow
        ctx.fillStyle = '#60a5fa'
        ctx.font = 'bold 14px Arial'
        ctx.fillText('⬆', pos.x + 28, pos.y - 28)
      }
    }
  })
  
  // Draw Vanguard Units
  vanguards.forEach(unit => {
    if (!ctx || unit.state === 'dead') return
    
    const x = unit.position.x
    const y = unit.position.y
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(x, y + 12, 10, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    
    const bounce = (unit.state === 'chasing' || unit.state === 'roaming') 
      ? Math.sin(unit.animationFrame * Math.PI / 2) * 2 : 0
    
    ctx.save()
    ctx.translate(x, y + bounce)
    if (!unit.facingRight) ctx.scale(-1, 1)
    
    // Body (knight-like appearance)
    ctx.fillStyle = '#6366f1' // Indigo base
    ctx.beginPath()
    ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // Helmet
    ctx.fillStyle = '#4f46e5'
    ctx.beginPath()
    ctx.arc(0, -6, 10, 0, Math.PI * 2)
    ctx.fill()
    
    // Visor
    ctx.fillStyle = '#1e1b4b'
    ctx.fillRect(-6, -8, 12, 4)
    
    // Sword (attacking stance)
    if (unit.state === 'attacking') {
      ctx.fillStyle = '#c0c0c0'
      ctx.fillRect(10, -12, 4, 20)
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(8, -4, 8, 4) // Guard
    } else {
      // Sword at side
      ctx.fillStyle = '#a1a1aa'
      ctx.fillRect(10, -2, 3, 14)
    }
    
    // Shield
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.ellipse(-10, 2, 6, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#1d4ed8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-13, 0)
    ctx.lineTo(-7, 0)
    ctx.moveTo(-10, -3)
    ctx.lineTo(-10, 3)
    ctx.stroke()
    
    ctx.restore()
    
    // HP bar
    const hpPercent = unit.hp / unit.maxHp
    ctx.fillStyle = '#222'
    ctx.fillRect(x - 14, y - 26, 28, 5)
    ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444'
    ctx.fillRect(x - 14, y - 26, 28 * hpPercent, 5)
    
    // State indicator
    if (unit.state === 'chasing') {
      ctx.fillStyle = '#ef4444'
      ctx.font = '10px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('⚔', x, y - 32)
    } else if (unit.state === 'roaming') {
      ctx.fillStyle = '#3b82f6'
      ctx.font = '10px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('◎', x, y - 32)
    }
  })
  
  // Draw dead vanguards with respawn timer
  vanguards.forEach(unit => {
    if (!ctx || unit.state !== 'dead' || unit.respawnTimer === Infinity) return
    
    const building = buildings.find(b => b.id === unit.buildingId)
    if (!building) return
    
    const buildingPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
    
    // Ghost indicator with timer
    ctx.fillStyle = 'rgba(99, 102, 241, 0.4)'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`✧ ${Math.ceil(unit.respawnTimer)}s`, buildingPos.x, buildingPos.y + 30)
  })
  
  // Draw players
  players.forEach(player => {
    if (!ctx || !player.alive) return
    
    const x = player.smoothX
    const y = player.smoothY
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.ellipse(x, y + 20, 16, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    
    const bounce = player.state === 'walking' ? Math.sin(player.animationFrame * Math.PI / 2) * 4 : 0
    
    ctx.save()
    ctx.translate(x, y + bounce)
    if (!player.facingRight) ctx.scale(-1, 1)
    
    // Body
    ctx.fillStyle = player.color
    ctx.beginPath()
    ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // Face
    ctx.fillStyle = '#fcd34d'
    ctx.beginPath()
    ctx.arc(0, -6, 13, 0, Math.PI * 2)
    ctx.fill()
    
    // Eyes
    ctx.fillStyle = player.isSleeping ? '#000' : '#1f1f1f'
    if (player.isSleeping) {
      // Closed eyes (sleeping)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#1f1f1f'
      ctx.beginPath()
      ctx.moveTo(-7, -8)
      ctx.lineTo(-3, -6)
      ctx.moveTo(3, -6)
      ctx.lineTo(7, -8)
      ctx.stroke()
      
      // Zzz
      ctx.fillStyle = '#60a5fa'
      ctx.font = 'bold 10px Arial'
      ctx.fillText('Z', 12, -22)
      ctx.font = 'bold 8px Arial'
      ctx.fillText('z', 18, -16)
      ctx.font = 'bold 6px Arial'
      ctx.fillText('z', 22, -12)
    } else {
      ctx.beginPath()
      ctx.arc(-5, -8, 3, 0, Math.PI * 2)
      ctx.arc(5, -8, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Attack effect
    if (player.state === 'attacking') {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(12, 0)
      ctx.lineTo(30, -6)
      ctx.stroke()
    }
    
    ctx.restore()
    
    // Name & HP bar
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(player.name, x, y - 40)
    
    const hpPercent = player.hp / player.maxHp
    ctx.fillStyle = '#222'
    ctx.fillRect(x - 20, y - 35, 40, 8)
    ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : '#ef4444'
    ctx.fillRect(x - 20, y - 35, 40 * hpPercent, 8)
  })
  
  // Draw monsters using renderingSystem
  for (const monster of monsters) {
    if (ctx && monster.hp > 0) {
      renderMonster(ctx, monster)
    }
  }
  
  // Draw projectiles
  projectiles.forEach(proj => {
    if (!ctx) return
    const skillProj = proj as (Projectile & { isSkillArrow?: boolean })
    
    // Draw skill arrow differently
    if (skillProj.isSkillArrow) {
      ctx.save()
      const angle = Math.atan2(proj.target.y - proj.position.y, proj.target.x - proj.position.x)
      ctx.translate(proj.position.x, proj.position.y)
      ctx.rotate(angle)
      
      // Arrow shaft
      ctx.fillStyle = '#6366f1'
      ctx.fillRect(-20, -2, 25, 4)
      
      // Arrow head
      ctx.beginPath()
      ctx.moveTo(8, 0)
      ctx.lineTo(-2, -6)
      ctx.lineTo(-2, 6)
      ctx.closePath()
      ctx.fill()
      
      // Glow effect
      ctx.shadowColor = '#6366f1'
      ctx.shadowBlur = 15
      ctx.fillRect(-20, -2, 25, 4)
      ctx.shadowBlur = 0
      
      ctx.restore()
    } else {
      ctx.fillStyle = proj.color
      ctx.shadowColor = proj.color
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(proj.position.x, proj.position.y, proj.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  })
  
  // Draw particles
  particles.forEach(p => {
    if (!ctx) return
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.position.x, p.position.y, p.size * alpha, 0, Math.PI * 2)
    ctx.fill()
  })
  if (ctx) ctx.globalAlpha = 1
  
  // Draw floating texts (damage numbers, gold gains)
  floatingTexts.forEach(ft => {
    if (!ctx) return
    const alpha = ft.life / ft.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = ft.color
    ctx.font = `bold ${ft.size}px Arial`
    ctx.textAlign = 'center'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.strokeText(ft.text, ft.position.x, ft.position.y)
    ctx.fillText(ft.text, ft.position.x, ft.position.y)
  })
  if (ctx) ctx.globalAlpha = 1
  
  if (ctx) ctx.restore()
  
  // DOOR HP BARS - Rendered on top of everything (separate pass for visibility)
  if (ctx) {
    const renderCtx = ctx
    renderCtx.save()
    renderCtx.translate(-camera.x, -camera.y)
    
    rooms.forEach(room => {
      if (room.doorHp <= 0) return // Don't show HP bar for broken doors
      
      const doorPx = room.doorGridX * GAME_CONSTANTS.CELL_SIZE
      const doorPy = room.doorGridY * GAME_CONSTANTS.CELL_SIZE
      const doorHpPercent = room.doorHp / room.doorMaxHp
      
      // Large, visible HP bar above door
      const barWidth = GAME_CONSTANTS.CELL_SIZE + 20
      const barHeight = 10
      const barX = doorPx + GAME_CONSTANTS.CELL_SIZE / 2 - barWidth / 2
      const barY = doorPy - 18
      
      // Background with border
      renderCtx.fillStyle = '#000'
      renderCtx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4)
      renderCtx.fillStyle = '#333'
      renderCtx.fillRect(barX, barY, barWidth, barHeight)
      
      // HP fill
      renderCtx.fillStyle = doorHpPercent > 0.5 ? '#22c55e' : doorHpPercent > 0.2 ? '#eab308' : '#ef4444'
      renderCtx.fillRect(barX, barY, barWidth * doorHpPercent, barHeight)
      
      // Border
      renderCtx.strokeStyle = '#666'
      renderCtx.lineWidth = 2
      renderCtx.strokeRect(barX, barY, barWidth, barHeight)
      
      // HP text
      renderCtx.fillStyle = '#fff'
      renderCtx.font = 'bold 9px Arial'
      renderCtx.textAlign = 'center'
      renderCtx.fillText(`${Math.floor(room.doorHp)}/${room.doorMaxHp}`, doorPx + GAME_CONSTANTS.CELL_SIZE / 2, barY + 8)
      
      // Repair indicator
      if (room.doorIsRepairing) {
        renderCtx.fillStyle = '#22c55e'
        renderCtx.font = 'bold 12px Arial'
        renderCtx.fillText('⚙', doorPx + GAME_CONSTANTS.CELL_SIZE / 2, barY - 8)
      }
    })
    
    renderCtx.restore()
  }
}

// End game
const endGame = (win: boolean) => {
  gameOver.value = true
  victory.value = win
  gamePhase.value = 'ended'
  if (win) playSfx('win')
  else playSfx('lose')
  stopBgm()
}

// Restart
const restartGame = () => {
  // Reset all game state arrays
  buildings.length = 0
  particles.length = 0
  projectiles.length = 0
  floatingTexts.length = 0
  latePlayers.length = 0 // Reset late players tracking
  messageLog.value = []

  // Reset players, rooms, grid
  gamePhase.value = 'playing' // Game starts immediately
  countdown.value = timingConfig.value.countdownTime
  monsterActive.value = false // Monster inactive until countdown ends
  gameOver.value = false
  victory.value = false

  initGrid()
  
  // Reset healing points with new random positions
  healingPoints.length = 0
  initHealingPoints()
  markHealZonesOnGrid() // Mark heal zones after random positions set

  initRooms()
  initPlayers()

  // Reset monsters
  monsters.length = 0
  initMonsters()

  // Camera reset
  camera.x = 0
  camera.y = 0

  startBgm()
  lastTime = performance.now()
  animationId = requestAnimationFrame(gameLoop)
}

// Pause modal state
const showPauseModal = ref(false)
const isPaused = ref(false)

const requestExit = () => {
  showPauseModal.value = true
  isPaused.value = true
  // Pause game loop by not requesting next frame
}

const resumeGame = () => {
  showPauseModal.value = false
  isPaused.value = false
  // Resume game loop
  if (!gameOver.value) {
    lastTime = performance.now()
    animationId = requestAnimationFrame(gameLoop)
  }
}

const confirmExit = () => {
  showPauseModal.value = false
  if (animationId) cancelAnimationFrame(animationId)
  stopBgm()
  emit('back-home')
}

onMounted(() => {
  // Set up responsive viewport
  updateViewportSize()
  window.addEventListener('resize', updateViewportSize)
  
  // Use requestAnimationFrame to ensure container is properly sized
  requestAnimationFrame(() => {
    updateViewportSize()
    
    if (canvasRef.value) {
      ctx = canvasRef.value.getContext('2d')
      initGrid()
      initHealingPoints() // Initialize healing points for monster (random positions)
      markHealZonesOnGrid() // Mark heal zones on grid based on randomized positions
      initRooms()
      initPlayers()
      initMonsters() // Initialize monsters based on difficulty
      initAudio()
      startBgm()
      lastTime = performance.now()
      animationId = requestAnimationFrame(gameLoop)
    }
  })
  
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  stopBgm()
  stopMove() // Clean up movement state
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', updateViewportSize)
})
</script>

<template>
  <div class="relative flex h-screen flex-col bg-neutral-950 text-white overflow-hidden font-game-body">
    <!-- Top Bar - Navbar -->
    <div class="flex items-center justify-between border-b border-neutral-800/50 bg-neutral-900/70 backdrop-blur-sm px-3 py-1.5 z-20">
      <button class="text-neutral-400 hover:text-white transition text-sm px-2 py-1 shrink-0 font-game" @click="requestExit">{{ t('ui.back') }}</button>
      
      <!-- Monster Cards in Navbar (horizontal list, no scroll) -->
      <div class="flex items-center gap-2 flex-1 justify-center">
        <!-- All Monsters -->
        <button 
          v-for="monster in monsters.filter(m => m.hp > 0)" 
          :key="monster.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gradient-to-br from-red-900/80 to-red-950/80 border border-red-500/50 hover:border-red-400 hover:from-red-800/80 transition-all shadow-lg"
          @click="focusOnMonster(monster)"
        >
          <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-red-400/50 shadow-inner"
               :class="monster.name === 'Vong hồn kỵ sỹ' ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-purple-500 to-purple-700'">
            <GameIcons name="monster" :size="18" class="text-white drop-shadow-lg" />
          </div>
          <div class="text-left min-w-[60px]">
            <div class="text-[9px] font-game text-red-200 truncate max-w-[60px]">{{ monster.name }}</div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] font-game text-amber-400">LV{{ monster.level }}</span>
            </div>
            <!-- HP Bar -->
            <div class="w-full h-1.5 bg-red-950 rounded-full overflow-hidden border border-red-800/50 mt-0.5">
              <div class="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all" :style="{ width: (monster.hp / monster.maxHp * 100) + '%' }"></div>
            </div>
            <div class="text-[8px] text-red-300/80 font-game">{{ Math.floor(monster.hp) }}/{{ monster.maxHp }}</div>
            <!-- Level Progress Bar (blue) - below HP -->
            <div class="w-full h-1 bg-blue-950 rounded-full overflow-hidden border border-blue-800/50 mt-0.5">
              <div class="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all" 
                   :style="{ width: (monster.levelUpTime > 0 ? (monster.levelTimer / monster.levelUpTime * 100) : 0) + '%' }"></div>
            </div>
          </div>
        </button>
        
        <!-- Dead monsters indicator -->
        <div v-if="monsters.some(m => m.hp <= 0)" class="text-[10px] text-neutral-500 flex items-center gap-1">
          <GameIcons name="skull" :size="14" />
          <span class="font-game">{{ monsters.filter(m => m.hp <= 0).length }}</span>
        </div>
      </div>
      
      <div class="w-16 shrink-0"></div> <!-- Spacer for balance -->
    </div>

    <!-- Player Resources Panel - Top Right (below navbar) -->
    <div class="absolute top-14 right-3 z-10">
      <div class="game-panel rounded-xl bg-neutral-900/80 backdrop-blur-sm border border-white/10 p-3 min-w-[140px]">
        <div class="text-[10px] text-neutral-400 mb-1.5 font-game">{{ humanPlayer?.name || 'You' }}</div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <GameIcons name="gold" :size="24" />
            <div class="flex-1">
              <div class="text-xl font-game glow-gold">{{ Math.floor(humanPlayer?.gold || 0) }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <GameIcons name="soul" :size="24" />
            <div class="flex-1">
              <div class="text-xl font-game glow-purple">{{ humanPlayer?.souls || 0 }}</div>
            </div>
          </div>
          <div class="border-t border-white/10 pt-2 mt-1">
            <div class="flex items-center gap-2">
              <GameIcons name="heart" :size="18" />
              <div class="flex-1">
                <div class="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div class="h-full bg-red-500 transition-all" :style="{ width: ((humanPlayer?.hp || 0) / (humanPlayer?.maxHp || 100) * 100) + '%' }"></div>
                </div>
                <div class="text-[10px] text-red-400">{{ humanPlayer?.hp || 0 }}/{{ humanPlayer?.maxHp || 100 }}</div>
              </div>
            </div>
          </div>
          <div v-if="humanPlayer?.isSleeping" class="text-xs text-blue-400 flex items-center gap-1">
            <GameIcons name="sleep" :size="16" />
            <span class="font-game">{{ Math.floor(humanPlayer?.sleepTimer || 0) }}s</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Canvas Container -->
    <div 
      ref="containerRef"
      class="flex-1 relative overflow-hidden"
      @contextmenu.prevent
    >
      <canvas 
        ref="canvasRef" 
        :width="viewportWidth" 
        :height="viewportHeight" 
        class="w-full h-full touch-none"
        @click="handleCanvasClick"
        @mousedown="handleMouseDown"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      ></canvas>

      <!-- Monster Countdown Overlay (HTML for crisp text) -->
      <Transition name="popup">
        <div 
          v-if="!monsterActive && gamePhase === 'playing'"
          class="absolute top-0 left-0 right-0 z-30 pointer-events-none"
        >
          <div class="bg-gradient-to-b from-black/90 via-black/70 to-transparent pt-4 pb-12 px-4">
            <div class="flex flex-col items-center justify-center">
              <!-- Warning Icon & Countdown -->
              <div class="flex items-center gap-3 mb-2">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center animate-pulse shadow-lg shadow-amber-500/30">
                  <GameIcons name="timer" :size="28" class="text-white" />
                </div>
                <div class="font-game text-5xl text-amber-400 glow-gold drop-shadow-lg">
                  {{ Math.ceil(countdown) }}s
                </div>
              </div>
              <!-- Warning Text -->
              <div class="font-game-body text-lg text-white/90 text-center drop-shadow-md">
                Quái vật sẽ <span class="text-red-400 font-game">SĂN LÙNG</span> sau thời gian đếm ngược!
              </div>
              <!-- Progress Bar -->
              <div class="w-64 h-2 bg-neutral-800/80 rounded-full mt-3 overflow-hidden border border-amber-500/30">
                <div 
                  class="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-100"
                  :style="{ width: (100 - (countdown / timingConfig.countdownTime * 100)) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Center-Bottom: Joystick Controls - Hidden when sleeping -->
      <div 
        v-if="gamePhase === 'playing' && humanPlayer?.alive && !humanPlayer?.isSleeping"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
      >
        <!-- Joystick Container -->
        <div 
          ref="joystickRef"
          class="relative w-[100px] h-[100px] rounded-full bg-black/50 backdrop-blur-sm border-2 border-white/20 touch-manipulation select-none"
          @mousedown="handleJoystickStart"
          @mousemove="handleJoystickMove"
          @mouseup="handleJoystickEnd"
          @mouseleave="handleJoystickEnd"
          @touchstart="handleJoystickStart"
          @touchmove="handleJoystickMove"
          @touchend="handleJoystickEnd"
          @touchcancel="handleJoystickEnd"
        >
          <!-- Outer ring decoration -->
          <div class="absolute inset-2 rounded-full border border-white/10"></div>
          
          <!-- Direction indicators -->
          <div class="absolute top-1 left-1/2 -translate-x-1/2 text-white/30 text-sm">▲</div>
          <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-white/30 text-sm">▼</div>
          <div class="absolute left-1 top-1/2 -translate-y-1/2 text-white/30 text-sm">◀</div>
          <div class="absolute right-1 top-1/2 -translate-y-1/2 text-white/30 text-sm">▶</div>
          
          <!-- Joystick Knob -->
          <div 
            class="absolute w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg border-2 border-amber-300/50 transition-transform duration-75"
            :class="joystickActive ? 'scale-90' : ''"
            :style="{
              left: `calc(50% - 20px + ${joystickPosition.x}px)`,
              top: `calc(50% - 20px + ${joystickPosition.y}px)`
            }"
          >
            <!-- Knob highlight -->
            <div class="absolute inset-1 rounded-full bg-gradient-to-br from-white/30 to-transparent"></div>
          </div>
        </div>
      </div>

      <!-- BOTTOM-RIGHT: Quick Action Buttons (Circular on mobile) -->
      <div class="absolute bottom-20 right-4 flex flex-col gap-3 z-10">
        <!-- Sleep Button (when near bed) -->
        <Transition name="popup">
          <button 
            v-if="isNearBed && gamePhase === 'playing' && !humanPlayer?.isSleeping"
            class="game-btn w-14 h-14 bg-blue-600/90 hover:bg-blue-500/90 backdrop-blur-sm rounded-full shadow-lg border-2 border-blue-400/50 flex items-center justify-center"
            @click="goToSleep"
            :title="!monsterActive && currentNearRoom?.ownerId === null ? t('ui.claimAndSleep') : t('ui.sleep')"
          >
            <GameIcons name="bed" :size="24" />
          </button>
        </Transition>

        <!-- Camera reset button -->
        <Transition name="popup">
          <button 
            v-if="cameraManualMode"
            class="game-btn w-14 h-14 bg-neutral-800/90 hover:bg-neutral-700/90 backdrop-blur-sm rounded-full shadow-lg border-2 border-white/30 flex items-center justify-center"
            @click="resetCameraToPlayer"
            :title="t('ui.followPlayer')"
          >
            <GameIcons name="target" :size="24" />
          </button>
        </Transition>

        <!-- Door Repair Button (when player owns a room with damaged door) -->
        <Transition name="popup">
          <button 
            v-if="gamePhase === 'playing' && humanPlayer?.alive && playerOwnedRoom && playerOwnedRoom.doorHp > 0 && playerOwnedRoom.doorHp < playerOwnedRoom.doorMaxHp"
            class="game-btn relative w-14 h-14 rounded-full shadow-lg border-2 flex items-center justify-center overflow-hidden"
            :class="[
              playerOwnedRoom.doorRepairCooldown > 0 || playerOwnedRoom.doorIsRepairing
                ? 'bg-neutral-700/90 border-neutral-500 cursor-not-allowed' 
                : 'bg-green-600/90 hover:bg-green-500/90 border-green-400 cursor-pointer'
            ]"
            :disabled="playerOwnedRoom.doorRepairCooldown > 0 || playerOwnedRoom.doorIsRepairing"
            @click="startDoorRepairFromButton"
            title="Sửa cửa"
          >
            <!-- Cooldown Overlay (circular progress) -->
            <svg 
              v-if="playerOwnedRoom.doorRepairCooldown > 0"
              class="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="#374151" 
                stroke-width="10"
              />
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="#22c55e" 
                stroke-width="10"
                stroke-linecap="round"
                :stroke-dasharray="283"
                :stroke-dashoffset="283 * (playerOwnedRoom.doorRepairCooldown / 50)"
                class="transition-all duration-200"
              />
            </svg>
            <!-- Repairing animation -->
            <div v-if="playerOwnedRoom.doorIsRepairing" class="absolute inset-0 bg-green-500/30 animate-pulse rounded-full"></div>
            <!-- Icon -->
            <GameIcons 
              name="settings" 
              :size="24" 
              :class="playerOwnedRoom.doorIsRepairing ? 'animate-spin' : ''"
            />
            <!-- Cooldown text -->
            <div 
              v-if="playerOwnedRoom.doorRepairCooldown > 0" 
              class="absolute inset-0 flex items-center justify-center font-game text-xs text-white bg-black/50 rounded-full"
            >
              {{ Math.ceil(playerOwnedRoom.doorRepairCooldown) }}s
            </div>
          </button>
        </Transition>
      </div>

      <!-- TOP-LEFT: Hero Status Panel -->
      <!-- Mobile: Compact grid of avatars (3 columns) -->
      <div class="absolute top-3 left-3 z-10 sm:hidden">
        <div class="game-panel rounded-xl bg-neutral-900/80 backdrop-blur-sm border border-white/10 p-2">
          <div class="grid grid-cols-3 gap-1.5">
            <button 
              v-for="player in players" 
              :key="player.id"
              class="flex flex-col items-center gap-0.5 p-1 rounded-lg transition-all hover:bg-white/10"
              :class="player.isHuman ? 'ring-1 ring-amber-400/50 bg-amber-500/10' : ''"
              @click="navigateToPlayer(player)"
            >
              <!-- Avatar with status ring -->
              <div 
                class="relative w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0"
                :class="player.alive ? 'border-green-400' : 'border-red-500'"
                :style="{ backgroundColor: player.color + 'cc' }"
              >
                <GameIcons :name="player.isHuman ? 'player' : 'bot'" :size="18" />
                <!-- Status indicator -->
                <div 
                  class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border border-neutral-800"
                  :class="player.alive ? (player.isSleeping ? 'bg-blue-500' : 'bg-green-500') : 'bg-red-600'"
                >
                  <GameIcons v-if="player.alive && player.isSleeping" name="sleep" :size="8" />
                  <GameIcons v-else-if="!player.alive" name="skull" :size="8" />
                </div>
              </div>
              <!-- Name -->
              <div class="text-[8px] font-game truncate w-full text-center" :class="player.alive ? 'text-white' : 'text-red-400'">
                {{ player.isHuman ? 'You' : player.name.replace('Bot-', 'B') }}
              </div>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Desktop: Full cards -->
      <div class="absolute top-3 left-3 hidden sm:flex flex-col gap-1.5 z-10 max-h-[60vh] overflow-y-auto">
        <!-- Player/Hero Cards -->
        <button 
          v-for="player in players" 
          :key="player.id"
          class="game-panel flex items-center gap-2 px-2.5 py-2 rounded-xl backdrop-blur-sm border transition-all hover:scale-[1.02] min-w-[160px]"
          :class="[
            player.alive 
              ? 'bg-neutral-900/80 border-white/10 hover:bg-neutral-800/80' 
              : 'bg-red-950/60 border-red-500/30',
            player.isHuman ? 'ring-2 ring-amber-400/50' : ''
          ]"
          @click="navigateToPlayer(player)"
        >
          <div 
            class="w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0"
            :class="player.alive ? 'border-green-400' : 'border-red-400'"
            :style="{ backgroundColor: player.color + 'cc' }"
          >
            <GameIcons :name="player.isHuman ? 'player' : 'bot'" :size="24" />
          </div>
          <div class="flex-1 text-left min-w-0">
            <div class="text-xs font-game truncate" :class="player.alive ? 'text-white' : 'text-red-300'">
              {{ player.name }}
              <span v-if="player.isHuman" class="text-amber-400">(You)</span>
            </div>
            
            <!-- HP Bar -->
            <div class="flex items-center gap-1 mt-1">
              <GameIcons name="heart" :size="12" />
              <div class="flex-1 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all" 
                  :class="player.hp / player.maxHp > 0.5 ? 'bg-green-500' : player.hp / player.maxHp > 0.2 ? 'bg-yellow-500' : 'bg-red-500'"
                  :style="{ width: (player.hp / player.maxHp * 100) + '%' }"
                ></div>
              </div>
              <span class="text-[9px] text-neutral-400 w-8 font-game">{{ player.hp }}/{{ player.maxHp }}</span>
            </div>
            
            <!-- Status & Resources Row -->
            <div class="flex items-center gap-2 mt-1 text-[10px]">
              <span :class="player.alive ? (player.isSleeping ? 'text-blue-400' : 'text-green-400') : 'text-red-400'">
                <GameIcons v-if="player.alive && player.isSleeping" name="sleep" :size="12" />
                <GameIcons v-else-if="player.alive" name="active" :size="12" />
                <GameIcons v-else name="skull" :size="12" />
              </span>
              <span class="text-amber-400 flex items-center gap-0.5"><GameIcons name="gold" :size="10" />{{ Math.floor(player.gold) }}</span>
              <span class="text-violet-400 flex items-center gap-0.5"><GameIcons name="soul" :size="10" />{{ player.souls }}</span>
            </div>
            
            <!-- Bed Level (if player owns a room) -->
            <div v-if="player.roomId !== null && player.roomId !== undefined" class="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1">
              <GameIcons name="bed" :size="12" /> <span class="font-game">Lv{{ rooms[player.roomId]?.bedLevel || 1 }}</span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Upgrade Modal -->
    <Transition name="popup">
      <div 
        v-if="showUpgradeModal && upgradeTarget" 
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-20"
        :class="{ 'pointer-events-none': !modalInteractive }"
        @click.self="modalInteractive && closeUpgradeModal()"
        @touchstart.self="modalInteractive && closeUpgradeModal()"
      >
        <div 
          class="relative w-full max-w-xs rounded-2xl border border-white/20 bg-neutral-900/95 backdrop-blur-md p-5 shadow-2xl"
          :class="{ 'pointer-events-none': !modalInteractive }"
          @touchstart.stop
          @touchend.stop
          @click.stop
        >
          <button class="absolute right-3 top-3 text-xl text-neutral-500 hover:text-white" @click="closeUpgradeModal">✕</button>
          
          <!-- Door Upgrade -->
          <template v-if="upgradeTarget.type === 'door' && upgradeTarget.room">
            <div class="flex items-center justify-center gap-3 mb-4">
              <GameIcons name="shield" :size="32" />
              <h2 class="font-game text-xl" :class="upgradeTarget.room.doorHp <= 0 ? 'text-red-400' : 'text-blue-400'">
                {{ upgradeTarget.room.doorHp <= 0 ? t('ui.doorDestroyed') : t('ui.door') }}
              </h2>
            </div>
            
            <!-- Current Stats -->
            <div class="bg-neutral-800/50 rounded-xl p-4 mb-4 border" :class="upgradeTarget.room.doorHp <= 0 ? 'border-red-500/30' : 'border-blue-500/20'">
              <div class="flex items-center justify-between mb-3">
                <span class="text-neutral-400 text-sm">{{ t('terms.level') }}</span>
                <span class="font-game text-2xl" :class="upgradeTarget.room.doorHp <= 0 ? 'text-red-400' : 'text-blue-400'">{{ upgradeTarget.room.doorLevel }}</span>
              </div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-neutral-400 text-sm flex items-center gap-1.5">
                  <GameIcons name="health" :size="14" /> HP
                </span>
                <span class="font-game text-lg" :class="upgradeTarget.room.doorHp <= 0 ? 'text-red-400' : 'text-green-300'">{{ Math.floor(upgradeTarget.room.doorHp) }}/{{ upgradeTarget.room.doorMaxHp }}</span>
              </div>
              <!-- HP Bar -->
              <div class="w-full h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-300"
                  :class="upgradeTarget.room.doorHp <= 0 ? 'bg-red-500' : upgradeTarget.room.doorHp / upgradeTarget.room.doorMaxHp > 0.5 ? 'bg-green-500' : upgradeTarget.room.doorHp / upgradeTarget.room.doorMaxHp > 0.25 ? 'bg-yellow-500' : 'bg-red-500'"
                  :style="{ width: (upgradeTarget.room.doorHp / upgradeTarget.room.doorMaxHp * 100) + '%' }"
                ></div>
              </div>
              <div v-if="upgradeTarget.room.doorIsRepairing" class="text-xs text-green-400 mt-2 flex items-center justify-center gap-1">
                <GameIcons name="settings" :size="12" class="animate-spin" /> Đang sửa chữa... {{ Math.floor((upgradeTarget.room.doorRepairTimer / GAME_CONSTANTS.DOOR_REPAIR_DURATION) * 100) }}%
              </div>
            </div>
            
            <div class="flex flex-col gap-2">
              <!-- Door DESTROYED - Cannot rebuild -->
              <template v-if="upgradeTarget.room.doorHp <= 0">
                <div class="bg-red-900/30 rounded-xl p-4 mb-2 border border-red-500/30">
                  <div class="flex items-center justify-center gap-2 text-red-400 mb-2">
                    <span class="text-2xl">💀</span>
                    <span class="font-game text-lg">CỬA ĐÃ BỊ PHÁ HỦY</span>
                  </div>
                  <div class="text-center text-red-300/70 text-sm">Cửa không thể xây lại sau khi bị phá hủy. Phòng này giờ không còn an toàn!</div>
                </div>
              </template>
              
              <!-- Normal upgrade/repair when door exists -->
              <template v-else>
                <!-- Upgrade Preview -->
                <div v-if="upgradeTarget.room.doorLevel < 10" class="bg-gradient-to-r from-blue-900/30 to-blue-800/20 rounded-xl p-4 mb-2 border border-blue-500/30">
                  <div class="text-xs text-blue-400/80 mb-2 font-game">SAU KHI NÂNG CẤP</div>
                  <div class="flex items-center justify-between">
                    <span class="text-neutral-300 text-sm flex items-center gap-1.5">
                      <GameIcons name="health" :size="14" /> HP tối đa
                    </span>
                    <div class="flex items-center gap-2">
                      <span class="text-neutral-500 line-through">{{ upgradeTarget.room.doorMaxHp }}</span>
                      <span class="text-green-400">→</span>
                      <span class="font-game text-lg text-green-400">{{ Math.floor(upgradeTarget.room.doorMaxHp * 1.5) }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Upgrade button -->
                <button 
                  v-if="upgradeTarget.room.doorLevel < 10"
                  class="game-btn rounded-xl py-3 font-game text-white transition-all shadow-lg flex items-center justify-center gap-2"
                  :class="[
                    (humanPlayer?.gold || 0) >= upgradeTarget.room.doorUpgradeCost && ((upgradeTarget.room.doorSoulCost || 0) <= 0 || (humanPlayer?.souls || 0) >= (upgradeTarget.room.doorSoulCost || 0))
                      ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 ring-2 ring-green-400/50'
                      : 'bg-gradient-to-r from-blue-600 to-blue-500 opacity-50 cursor-not-allowed'
                  ]"
                  :disabled="(humanPlayer?.gold || 0) < upgradeTarget.room.doorUpgradeCost || ((upgradeTarget.room.doorSoulCost || 0) > 0 && (humanPlayer?.souls || 0) < (upgradeTarget.room.doorSoulCost || 0))"
                  @click="upgradeDoor">
                  <GameIcons name="gold" :size="18" />
                  <span>Nâng cấp ({{ upgradeTarget.room.doorUpgradeCost }}g)</span>
                  <span v-if="(upgradeTarget.room.doorSoulCost || 0) > 0" class="flex items-center gap-1 ml-1">
                    + <GameIcons name="soul" :size="14" /> {{ upgradeTarget.room.doorSoulCost }}
                  </span>
                </button>
                <div v-else class="bg-green-900/30 rounded-xl p-3 border border-green-500/30">
                  <div class="text-center text-green-400 font-game">{{ t('ui.maxLevel') }}</div>
                </div>
                
                <!-- Repair hint -->
                <div v-if="upgradeTarget.room.doorHp < upgradeTarget.room.doorMaxHp" class="text-center text-xs text-neutral-400 py-2">
                  Sử dụng nút <GameIcons name="settings" :size="14" class="inline" /> ở góc phải để sửa cửa
                </div>
              </template>
              
              <button class="game-btn rounded-xl border border-neutral-600 py-2 text-sm text-neutral-300 hover:bg-white/10 transition" @click="closeUpgradeModal">
                {{ t('ui.cancel') }}
              </button>
            </div>
          </template>
          
          <!-- Bed Upgrade -->
          <template v-else-if="upgradeTarget.type === 'bed' && upgradeTarget.room">
            <div class="flex items-center justify-center gap-3 mb-4">
              <GameIcons name="bed" :size="32" />
              <h2 class="font-game text-xl text-amber-400">{{ t('ui.bed') }}</h2>
            </div>
            
            <!-- Current Stats -->
            <div class="bg-neutral-800/50 rounded-xl p-4 mb-4 border border-amber-500/20">
              <div class="flex items-center justify-between mb-3">
                <span class="text-neutral-400 text-sm">{{ t('terms.level') }}</span>
                <span class="font-game text-2xl text-amber-400">{{ upgradeTarget.room.bedLevel }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-neutral-400 text-sm flex items-center gap-1.5">
                  <GameIcons name="gold" :size="14" /> Thu nhập
                </span>
                <span class="font-game text-lg text-amber-300">{{ upgradeTarget.room.bedIncome }}/giây</span>
              </div>
            </div>
            
            <!-- Upgrade Preview -->
            <div class="bg-gradient-to-r from-amber-900/30 to-amber-800/20 rounded-xl p-4 mb-4 border border-amber-500/30">
              <div class="text-xs text-amber-400/80 mb-2 font-game">SAU KHI NÂNG CẤP</div>
              <div class="flex items-center justify-between">
                <span class="text-neutral-300 text-sm flex items-center gap-1.5">
                  <GameIcons name="gold" :size="14" /> Thu nhập mới
                </span>
                <div class="flex items-center gap-2">
                  <span class="text-neutral-500 line-through">{{ upgradeTarget.room.bedIncome }}</span>
                  <span class="text-green-400">→</span>
                  <span class="font-game text-lg text-green-400">{{ upgradeTarget.room.bedIncome * 2 }}/giây</span>
                </div>
              </div>
            </div>
            
            <div class="flex flex-col gap-2">
              <button 
                class="game-btn rounded-xl py-3 font-game text-white transition-all shadow-lg flex items-center justify-center gap-2"
                :class="[
                  (humanPlayer?.gold || 0) >= upgradeTarget.room.bedUpgradeCost && ((upgradeTarget.room.bedSoulCost || 0) <= 0 || (humanPlayer?.souls || 0) >= (upgradeTarget.room.bedSoulCost || 0))
                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 ring-2 ring-green-400/50'
                    : 'bg-gradient-to-r from-amber-600 to-amber-500 opacity-50 cursor-not-allowed'
                ]"
                :disabled="(humanPlayer?.gold || 0) < upgradeTarget.room.bedUpgradeCost || ((upgradeTarget.room.bedSoulCost || 0) > 0 && (humanPlayer?.souls || 0) < (upgradeTarget.room.bedSoulCost || 0))"
                @click="upgradeBed">
                <GameIcons name="gold" :size="18" />
                <span>Nâng cấp ({{ upgradeTarget.room.bedUpgradeCost }}g)</span>
                <span v-if="(upgradeTarget.room.bedSoulCost || 0) > 0" class="flex items-center gap-1 ml-1">
                  + <GameIcons name="soul" :size="14" /> {{ upgradeTarget.room.bedSoulCost }}
                </span>
              </button>
              <button class="game-btn rounded-xl border border-neutral-600 py-2 text-sm text-neutral-300 hover:bg-white/10 transition" @click="closeUpgradeModal">
                {{ t('ui.cancel') }}
              </button>
            </div>
          </template>
          
          <!-- Building Upgrade/Sell -->
          <template v-else-if="upgradeTarget.type === 'building' && upgradeTarget.building">
            <div class="flex items-center justify-center gap-3 mb-4">
              <GameIcons 
                :name="upgradeTarget.building.type === 'turret' ? 'turret' : upgradeTarget.building.type === 'atm' ? 'gold' : upgradeTarget.building.type === 'vanguard' ? 'sword' : upgradeTarget.building.type === 'smg' ? 'zap' : 'soul'" 
                :size="32" 
              />
              <h2 class="font-game text-xl" :class="{
                'text-blue-400': upgradeTarget.building.type === 'turret',
                'text-green-400': upgradeTarget.building.type === 'atm',
                'text-violet-400': upgradeTarget.building.type === 'soul_collector',
                'text-indigo-400': upgradeTarget.building.type === 'vanguard',
                'text-orange-400': upgradeTarget.building.type === 'smg'
              }">
                {{ upgradeTarget.building.type === 'turret' ? t('ui.turretTitle') : upgradeTarget.building.type === 'atm' ? t('ui.atmTitle') : upgradeTarget.building.type === 'vanguard' ? t('ui.vanguardTitle') : upgradeTarget.building.type === 'smg' ? t('ui.smgTitle') : t('ui.soulCollectorTitle') }}
              </h2>
            </div>
            
            <!-- Current Stats -->
            <div class="bg-neutral-800/50 rounded-xl p-4 mb-4 border" :class="{
              'border-blue-500/20': upgradeTarget.building.type === 'turret',
              'border-green-500/20': upgradeTarget.building.type === 'atm',
              'border-violet-500/20': upgradeTarget.building.type === 'soul_collector',
              'border-indigo-500/20': upgradeTarget.building.type === 'vanguard',
              'border-orange-500/20': upgradeTarget.building.type === 'smg'
            }">
              <div class="flex items-center justify-between mb-3">
                <span class="text-neutral-400 text-sm">{{ t('terms.level') }}</span>
                <span class="font-game text-2xl" :class="{
                  'text-blue-400': upgradeTarget.building.type === 'turret',
                  'text-green-400': upgradeTarget.building.type === 'atm',
                  'text-violet-400': upgradeTarget.building.type === 'soul_collector',
                  'text-indigo-400': upgradeTarget.building.type === 'vanguard',
                  'text-orange-400': upgradeTarget.building.type === 'smg'
                }">{{ upgradeTarget.building.level }}/10</span>
              </div>
              
              <!-- Stats based on building type -->
              <div class="space-y-2 mb-3">
                <div v-if="upgradeTarget.building.damage > 0" class="flex items-center justify-between">
                  <span class="text-neutral-400 text-sm flex items-center gap-1.5">
                    <GameIcons name="sword" :size="14" /> Sát thương
                  </span>
                  <span class="font-game text-lg text-red-300">{{ Math.floor(upgradeTarget.building.damage) }}</span>
                </div>
                <div v-if="upgradeTarget.building.range > 0" class="flex items-center justify-between">
                  <span class="text-neutral-400 text-sm flex items-center gap-1.5">
                    <GameIcons name="target" :size="14" /> Tầm bắn
                  </span>
                  <span class="font-game text-lg text-cyan-300">{{ Math.floor(upgradeTarget.building.range) }}</span>
                </div>
                <div v-if="upgradeTarget.building.goldRate" class="flex items-center justify-between">
                  <span class="text-neutral-400 text-sm flex items-center gap-1.5">
                    <GameIcons name="gold" :size="14" /> Thu nhập
                  </span>
                  <span class="font-game text-lg text-amber-300">{{ upgradeTarget.building.goldRate }}/giây</span>
                </div>
                <div v-if="upgradeTarget.building.soulRate" class="flex items-center justify-between">
                  <span class="text-neutral-400 text-sm flex items-center gap-1.5">
                    <GameIcons name="soul" :size="14" /> Linh hồn
                  </span>
                  <span class="font-game text-lg text-violet-300">{{ upgradeTarget.building.soulRate }}/giây</span>
                </div>
                <div v-if="upgradeTarget.building.type === 'vanguard'" class="flex items-center justify-between">
                  <span class="text-neutral-400 text-sm flex items-center gap-1.5">
                    <GameIcons name="users" :size="14" /> Số lính
                  </span>
                  <span class="font-game text-lg text-indigo-300">{{ 1 + Math.floor(upgradeTarget.building.level / 2) }}</span>
                </div>
              </div>
              
              <!-- HP Bar -->
              <div class="flex items-center justify-between mb-1">
                <span class="text-neutral-400 text-sm flex items-center gap-1.5">
                  <GameIcons name="health" :size="14" /> HP
                </span>
                <span class="font-game text-sm" :class="upgradeTarget.building.hp / upgradeTarget.building.maxHp > 0.5 ? 'text-green-300' : upgradeTarget.building.hp / upgradeTarget.building.maxHp > 0.25 ? 'text-yellow-300' : 'text-red-300'">{{ Math.floor(upgradeTarget.building.hp) }}/{{ upgradeTarget.building.maxHp }}</span>
              </div>
              <div class="w-full h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-300"
                  :class="upgradeTarget.building.hp / upgradeTarget.building.maxHp > 0.5 ? 'bg-green-500' : upgradeTarget.building.hp / upgradeTarget.building.maxHp > 0.25 ? 'bg-yellow-500' : 'bg-red-500'"
                  :style="{ width: (upgradeTarget.building.hp / upgradeTarget.building.maxHp * 100) + '%' }"
                ></div>
              </div>
            </div>
            
            <!-- Upgrade Preview -->
            <div v-if="upgradeTarget.building.level < 10" class="bg-gradient-to-r rounded-xl p-4 mb-4 border" :class="{
              'from-blue-900/30 to-blue-800/20 border-blue-500/30': upgradeTarget.building.type === 'turret',
              'from-green-900/30 to-green-800/20 border-green-500/30': upgradeTarget.building.type === 'atm',
              'from-violet-900/30 to-violet-800/20 border-violet-500/30': upgradeTarget.building.type === 'soul_collector',
              'from-indigo-900/30 to-indigo-800/20 border-indigo-500/30': upgradeTarget.building.type === 'vanguard',
              'from-orange-900/30 to-orange-800/20 border-orange-500/30': upgradeTarget.building.type === 'smg'
            }">
              <div class="text-xs mb-2 font-game" :class="{
                'text-blue-400/80': upgradeTarget.building.type === 'turret',
                'text-green-400/80': upgradeTarget.building.type === 'atm',
                'text-violet-400/80': upgradeTarget.building.type === 'soul_collector',
                'text-indigo-400/80': upgradeTarget.building.type === 'vanguard',
                'text-orange-400/80': upgradeTarget.building.type === 'smg'
              }">SAU KHI NÂNG CẤP</div>
              <div class="space-y-1">
                <div v-if="upgradeTarget.building.damage > 0" class="flex items-center justify-between">
                  <span class="text-neutral-300 text-sm">Sát thương</span>
                  <div class="flex items-center gap-2">
                    <span class="text-neutral-500 line-through text-sm">{{ Math.floor(upgradeTarget.building.damage) }}</span>
                    <span class="text-green-400">→</span>
                    <span class="font-game text-green-400">{{ Math.floor(upgradeTarget.building.damage * 1.2) }}</span>
                  </div>
                </div>
                <div v-if="upgradeTarget.building.goldRate" class="flex items-center justify-between">
                  <span class="text-neutral-300 text-sm">Thu nhập</span>
                  <div class="flex items-center gap-2">
                    <span class="text-neutral-500 line-through text-sm">{{ upgradeTarget.building.goldRate }}</span>
                    <span class="text-green-400">→</span>
                    <span class="font-game text-green-400">{{ Math.floor(upgradeTarget.building.goldRate * 1.3) }}/s</span>
                  </div>
                </div>
                <div v-if="upgradeTarget.building.soulRate" class="flex items-center justify-between">
                  <span class="text-neutral-300 text-sm">Linh hồn</span>
                  <div class="flex items-center gap-2">
                    <span class="text-neutral-500 line-through text-sm">{{ upgradeTarget.building.soulRate }}</span>
                    <span class="text-green-400">→</span>
                    <span class="font-game text-green-400">{{ Math.floor(upgradeTarget.building.soulRate * 1.3) }}/s</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="flex flex-col gap-2">
              <button 
                v-if="upgradeTarget.building.level < 10"
                class="game-btn rounded-xl py-3 font-game text-white transition-all shadow-lg flex items-center justify-center gap-2"
                :class="[
                  (humanPlayer?.gold || 0) >= upgradeTarget.building.upgradeCost && (upgradeTarget.building.level < 4 || (humanPlayer?.souls || 0) >= GAME_CONSTANTS.SOUL_UPGRADE_COST * (upgradeTarget.building.level - 3))
                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 ring-2 ring-green-400/50'
                    : 'bg-gradient-to-r from-neutral-600 to-neutral-500 opacity-50 cursor-not-allowed'
                ]"
                :disabled="(humanPlayer?.gold || 0) < upgradeTarget.building.upgradeCost || (upgradeTarget.building.level >= 4 && (humanPlayer?.souls || 0) < GAME_CONSTANTS.SOUL_UPGRADE_COST * (upgradeTarget.building.level - 3))"
                @click="upgradeBuilding">
                <GameIcons name="gold" :size="18" />
                <span>Nâng cấp ({{ upgradeTarget.building.upgradeCost }}g)</span>
                <span v-if="upgradeTarget.building.level >= 4" class="flex items-center gap-1 ml-1">
                  + <GameIcons name="soul" :size="14" /> {{ GAME_CONSTANTS.SOUL_UPGRADE_COST * (upgradeTarget.building.level - 3) }}
                </span>
              </button>
              <div v-else class="bg-green-900/30 rounded-xl p-3 border border-green-500/30">
                <div class="text-center text-green-400 font-game">{{ t('ui.maxLevel') }}</div>
              </div>
              <button 
                class="game-btn rounded-xl bg-gradient-to-r from-red-600/80 to-red-500/80 hover:from-red-500 hover:to-red-400 py-2 font-game text-white transition-all flex items-center justify-center gap-2"
                @click="sellBuilding">
                <GameIcons name="trash" :size="16" />
                <span>Bán (hoàn {{ Math.floor(upgradeTarget.building.upgradeCost * 0.4) }}g)</span>
              </button>
              <button class="game-btn rounded-xl border border-neutral-600 py-2 text-sm text-neutral-300 hover:bg-white/10 transition" @click="closeUpgradeModal">
                {{ t('ui.cancel') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Build Popup with Tabs -->
    <Transition name="popup">
      <div v-if="showBuildPopup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click.self="showBuildPopup = false">
        <div class="game-panel relative w-full max-w-xl rounded-2xl border border-white/20 bg-neutral-900/95 backdrop-blur-md shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="p-4 border-b border-white/10">
            <button class="absolute right-3 top-3 text-xl text-neutral-500 hover:text-white z-10" @click="showBuildPopup = false">✕</button>
            <h2 class="text-center font-game text-lg text-amber-400">{{ t('ui.buildDefense') }}</h2>
            
            <!-- Resources Display -->
            <div class="flex justify-center gap-6 mt-3">
              <span class="text-amber-400 font-game flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-lg"><GameIcons name="gold" :size="18" /> {{ humanPlayer?.gold || 0 }}</span>
              <span class="text-purple-400 font-game flex items-center gap-1.5 bg-purple-500/10 px-3 py-1 rounded-lg"><GameIcons name="soul" :size="18" /> {{ humanPlayer?.souls || 0 }}</span>
            </div>
          </div>
          
          <!-- Tabs -->
          <div class="flex border-b border-white/10">
            <button 
              class="flex-1 py-3 px-4 font-game text-sm transition-all flex items-center justify-center gap-2"
              :class="buildTab === 'defense' ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-400' : 'text-neutral-400 hover:text-white hover:bg-white/5'"
              @click="buildTab = 'defense'"
            >
              <span>🛡️</span> Phòng thủ
            </button>
            <button 
              class="flex-1 py-3 px-4 font-game text-sm transition-all flex items-center justify-center gap-2"
              :class="buildTab === 'economy' ? 'text-amber-400 bg-amber-500/10 border-b-2 border-amber-400' : 'text-neutral-400 hover:text-white hover:bg-white/5'"
              @click="buildTab = 'economy'"
            >
              <GameIcons name="gold" :size="16" /> Kinh tế
            </button>
          </div>
          
          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-4">
            <!-- Tab: Phòng thủ -->
            <div v-if="buildTab === 'defense'" class="space-y-3">
              <!-- Turret -->
              <div 
                class="group rounded-xl border bg-white/5 p-4 transition-all cursor-pointer hover:bg-white/10"
                :class="(humanPlayer?.gold || 0) >= buildingCosts.turret ? 'border-white/10 hover:border-blue-500/50' : 'border-red-500/30 opacity-60 cursor-not-allowed'"
                @click="(humanPlayer?.gold || 0) >= buildingCosts.turret && buildDefense('turret')"
              >
                <div class="flex items-start gap-4">
                  <div class="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/30 transition">
                    <GameIcons name="turret" :size="36" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-game text-white">{{ t('ui.turret') }}</span>
                      <span class="text-amber-400 font-game flex items-center gap-1 text-sm">
                        {{ buildingCosts.turret }} <GameIcons name="gold" :size="14" />
                      </span>
                    </div>
                    <p class="text-xs text-neutral-400 leading-relaxed">Trụ pháo tự động nhắm và bắn quái vật trong tầm. Sát thương cao, tốc độ bắn trung bình. Phù hợp phòng thủ tầm xa.</p>
                    <div class="flex gap-3 mt-2 text-xs">
                      <span class="text-red-400 flex items-center gap-1"><GameIcons name="sword" :size="12" /> {{ GAME_CONSTANTS.BUILDINGS.turret.damage }}</span>
                      <span class="text-blue-400 flex items-center gap-1"><GameIcons name="target" :size="12" /> {{ GAME_CONSTANTS.BUILDINGS.turret.range }}px</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SMG -->
              <div 
                class="group rounded-xl border bg-white/5 p-4 transition-all cursor-pointer hover:bg-white/10"
                :class="(humanPlayer?.gold || 0) >= buildingCosts.smg ? 'border-white/10 hover:border-orange-500/50' : 'border-red-500/30 opacity-60 cursor-not-allowed'"
                @click="(humanPlayer?.gold || 0) >= buildingCosts.smg && buildDefense('smg')"
              >
                <div class="flex items-start gap-4">
                  <div class="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0 group-hover:bg-orange-500/30 transition">
                    <GameIcons name="smg" :size="36" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-game text-white">{{ t('ui.smg') }}</span>
                      <span class="text-amber-400 font-game flex items-center gap-1 text-sm">
                        {{ buildingCosts.smg }} <GameIcons name="gold" :size="14" />
                      </span>
                    </div>
                    <p class="text-xs text-neutral-400 leading-relaxed">Súng máy bắn liên thanh 10 viên mỗi 7 giây. Sát thương thấp nhưng tần suất bắn nhanh. Hiệu quả với quái di chuyển.</p>
                    <div class="flex gap-3 mt-2 text-xs">
                      <span class="text-red-400 flex items-center gap-1"><GameIcons name="sword" :size="12" /> {{ GAME_CONSTANTS.BUILDINGS.smg.damage }}×10</span>
                      <span class="text-blue-400 flex items-center gap-1"><GameIcons name="target" :size="12" /> {{ GAME_CONSTANTS.BUILDINGS.smg.range }}px</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Vanguard -->
              <div 
                class="group rounded-xl border bg-white/5 p-4 transition-all cursor-pointer hover:bg-white/10"
                :class="(humanPlayer?.gold || 0) >= buildingCosts.vanguard ? 'border-white/10 hover:border-indigo-500/50' : 'border-red-500/30 opacity-60 cursor-not-allowed'"
                @click="(humanPlayer?.gold || 0) >= buildingCosts.vanguard && buildDefense('vanguard')"
              >
                <div class="flex items-start gap-4">
                  <div class="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/30 transition">
                    <GameIcons name="vanguard" :size="36" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-game text-white">{{ t('ui.vanguard') }}</span>
                      <span class="text-amber-400 font-game flex items-center gap-1 text-sm">
                        {{ buildingCosts.vanguard }} <GameIcons name="gold" :size="14" />
                      </span>
                    </div>
                    <p class="text-xs text-neutral-400 leading-relaxed">Triệu hồi lính tiên phong tuần tra quanh phòng. Sát thương 20, tự động tấn công quái và thu hút sự chú ý.</p>
                    <div class="flex gap-3 mt-2 text-xs">
                      <span class="text-red-400 flex items-center gap-1"><GameIcons name="sword" :size="12" /> 20</span>
                      <span class="text-green-400 flex items-center gap-1"><GameIcons name="health" :size="12" /> {{ GAME_CONSTANTS.BUILDINGS.vanguard.hp }} HP</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab: Kinh tế -->
            <div v-if="buildTab === 'economy'" class="space-y-3">
              <!-- ATM - Mua bằng LINH HỒN -->
              <div 
                class="group rounded-xl border bg-white/5 p-4 transition-all cursor-pointer hover:bg-white/10"
                :class="(humanPlayer?.souls || 0) >= buildingCosts.atm ? 'border-white/10 hover:border-green-500/50' : 'border-red-500/30 opacity-60 cursor-not-allowed'"
                @click="(humanPlayer?.souls || 0) >= buildingCosts.atm && buildDefense('atm')"
              >
                <div class="flex items-start gap-4">
                  <div class="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0 group-hover:bg-green-500/30 transition">
                    <GameIcons name="atm" :size="36" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-game text-white">{{ t('ui.atm') }}</span>
                      <span class="text-purple-400 font-game flex items-center gap-1 text-sm">
                        {{ buildingCosts.atm }} <GameIcons name="soul" :size="14" />
                      </span>
                    </div>
                    <p class="text-xs text-neutral-400 leading-relaxed">Máy ATM tự động sinh vàng theo thời gian. Nguồn thu nhập thụ động ổn định. Mua bằng Linh hồn.</p>
                    <div class="flex gap-3 mt-2 text-xs">
                      <span class="text-amber-400 flex items-center gap-1"><GameIcons name="gold" :size="12" /> +{{ GAME_CONSTANTS.BUILDINGS.atm.goldRate }}/s</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Soul Collector -->
              <div 
                class="group rounded-xl border bg-white/5 p-4 transition-all cursor-pointer hover:bg-white/10"
                :class="(humanPlayer?.gold || 0) >= buildingCosts.soulCollector ? 'border-white/10 hover:border-purple-500/50' : 'border-red-500/30 opacity-60 cursor-not-allowed'"
                @click="(humanPlayer?.gold || 0) >= buildingCosts.soulCollector && buildDefense('soul_collector')"
              >
                <div class="flex items-start gap-4">
                  <div class="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0 group-hover:bg-purple-500/30 transition">
                    <GameIcons name="collector" :size="36" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-game text-white">{{ t('ui.soul') }}</span>
                      <span class="text-amber-400 font-game flex items-center gap-1 text-sm">
                        {{ buildingCosts.soulCollector }} <GameIcons name="gold" :size="14" />
                      </span>
                    </div>
                    <p class="text-xs text-neutral-400 leading-relaxed">Thu thập Linh hồn từ môi trường xung quanh. Linh hồn dùng để mua ATM và nâng cấp công trình cấp cao.</p>
                    <div class="flex gap-3 mt-2 text-xs">
                      <span class="text-purple-400 flex items-center gap-1"><GameIcons name="soul" :size="12" /> +{{ GAME_CONSTANTS.BUILDINGS.soul_collector.soulRate }}/s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="p-3 border-t border-white/10 bg-black/30">
            <p class="text-md text-neutral-500 text-center font-game-body">Giá niêm yết, không trả giá!</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Pause/Exit Confirmation Modal -->
    <Transition name="popup">
      <div v-if="showPauseModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div class="game-panel w-full max-w-xs rounded-2xl border-2 border-amber-500/50 bg-neutral-900/95 p-6 text-center shadow-2xl">
          <div class="flex justify-center mb-4">
            <div class="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span class="text-4xl">⏸️</span>
            </div>
          </div>
          <h2 class="text-2xl font-game text-amber-400 mb-2">
            {{ t('ui.paused') || 'TẠM DỪNG' }}
          </h2>
          <p class="text-neutral-400 text-sm font-game-body mb-6">
            {{ t('ui.exitConfirm') || 'Bạn có chắc muốn thoát game?' }}
          </p>
          <div class="flex flex-col gap-3">
            <button 
              class="game-btn rounded-xl bg-linear-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 py-2.5 font-game text-white transition-all"
              @click="resumeGame"
            >
              {{ t('ui.resume') || 'TIẾP TỤC' }}
            </button>
            <button 
              class="game-btn rounded-xl bg-linear-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 py-2 font-game text-white transition-all"
              @click="confirmExit"
            >
              {{ t('ui.exitGame') || 'THOÁT GAME' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Game Over -->
    <Transition name="popup">
      <div v-if="gameOver" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
        <div class="game-panel w-full max-w-xs rounded-2xl border-2 p-6 text-center shadow-2xl"
          :class="victory ? 'border-amber-500 bg-linear-to-b from-amber-950/90 to-neutral-900/90' : 'border-red-500 bg-linear-to-b from-red-950/90 to-neutral-900/90'">
          <div class="flex justify-center mb-3">
            <div v-if="victory" class="text-6xl">🏆</div>
            <GameIcons v-else name="skull" :size="64" />
          </div>
          <h2 class="text-3xl font-game" :class="victory ? 'glow-gold' : 'glow-red'">
            {{ victory ? t('ui.victory') : t('ui.defeat') }}
          </h2>
          <p class="mt-2 text-neutral-400 text-sm font-game-body">
            {{ victory ? t('ui.monsterDefeated') : t('ui.youWereKilled') }}
          </p>
          <div class="mt-6 flex flex-col gap-2">
            <button class="game-btn rounded-xl bg-linear-to-r from-amber-600 to-amber-500 py-2.5 font-game text-white" @click="restartGame">
              {{ t('ui.playAgain') }}
            </button>
            <button class="game-btn rounded-xl border border-neutral-600 py-2 text-sm font-game text-neutral-300" @click="confirmExit">
              {{ t('ui.home') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
canvas {
  image-rendering: crisp-edges;
  image-rendering: -moz-crisp-edges;
  image-rendering: pixelated;
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.popup-enter-active, .popup-leave-active { 
  transition: opacity 0.25s ease, transform 0.25s ease; 
}
.popup-enter-from, .popup-leave-to { 
  opacity: 0; 
  transform: scale(0.9); 
}
</style>
