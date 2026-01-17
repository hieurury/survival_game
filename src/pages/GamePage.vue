<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { initAudio, playSfx, startBgm, stopBgm } from '../composables/useAudio'
import { findPath, distance, moveTowards, gridToWorld } from '../composables/usePathfinding'
import BotAI from '../composables/useBotAI'
import { t, getBuildingTypeName, getRoomTypeName } from '../composables/useLocale'
import { useGameState } from '../composables/useGameState'
import type { 
  Room, Player, Monster, GamePhase, GridCell, 
  DefenseBuilding, Particle, Projectile, Vector2,
  FloatingText, VanguardUnit, HealingPoint
} from '../types/game'
import { GAME_CONSTANTS } from '../types/game'

// Get difficulty configuration
const { 
  currentConfig,
  mapConfig, 
  monsterConfig, 
  playerConfig, 
  economyConfig, 
  healingPointConfig,
  timingConfig,
  healingPointNests,
  spawnZone,
  worldWidth,
  worldHeight,
  difficultyName
} = useGameState()

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
const viewportWidth = ref(GAME_CONSTANTS.VIEWPORT_WIDTH)
const viewportHeight = ref(GAME_CONSTANTS.VIEWPORT_HEIGHT)

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
const selectedBuildSpot = ref<{ x: number; y: number; roomId: number } | null>(null)
const goldAccumulator = reactive<{ [key: number]: number }>({}) // Tracks partial gold per player

// Upgrade modal state
const showUpgradeModal = ref(false)
const upgradeTarget = ref<{ type: 'door' | 'bed' | 'building'; building?: typeof buildings[0]; room?: Room } | null>(null)

// Camera/viewport with drag support
const camera = reactive({ x: 0, y: 0 })
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
  
  // Mark monster nest zones (heal zones) based on difficulty
  for (const nest of healingPointNests.value) {
    for (let y = nest.gridY; y < nest.gridY + nest.height; y++) {
      for (let x = nest.gridX; x < nest.gridX + nest.width; x++) {
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

// Generate random non-overlapping rooms
const initRooms = () => {
  rooms.length = 0
  const config = mapConfig.value
  const cellSize = config.cellSize
  const numRooms = config.roomCount
  
  // Keep track of placed rooms to avoid overlap
  const placedRooms: { gridX: number; gridY: number; width: number; height: number }[] = []
  
  // Room size ranges from difficulty config
  const minWidth = config.roomMinWidth
  const maxWidth = config.roomMaxWidth
  const minHeight = config.roomMinHeight
  const maxHeight = config.roomMaxHeight
  
  // Room types
  const roomTypes: ('normal' | 'armory' | 'storage' | 'bunker')[] = ['normal', 'armory', 'storage', 'bunker']
  const doorSides: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right']
  
  // Helper: check if area overlaps with spawn zone
  const overlapsSpawnZone = (gx: number, gy: number, w: number, h: number): boolean => {
    const sz = spawnZone.value
    const padding = 1
    return gx < sz.gridX + sz.width + padding &&
           gx + w + padding > sz.gridX &&
           gy < sz.gridY + sz.height + padding &&
           gy + h + padding > sz.gridY
  }
  
  // Helper: check if area overlaps with monster nests
  const overlapsMonsterNest = (gx: number, gy: number, w: number, h: number): boolean => {
    const padding = 1
    for (const nest of healingPointNests.value) {
      if (gx < nest.gridX + nest.width + padding &&
          gx + w + padding > nest.gridX &&
          gy < nest.gridY + nest.height + padding &&
          gy + h + padding > nest.gridY) {
        return true
      }
    }
    return false
  }
  
  // Placement zones dynamically calculated based on map size
  const gridCols = config.gridCols
  const gridRows = config.gridRows
  const zoneMargin = 5
  const zoneMidX = Math.floor(gridCols / 2)
  const zoneMidY = Math.floor(gridRows / 2)
  
  const placementZones = [
    { minX: zoneMargin, maxX: zoneMidX - 4, minY: zoneMargin, maxY: zoneMidY - 2 },
    { minX: zoneMargin, maxX: zoneMidX - 4, minY: zoneMidY + 2, maxY: gridRows - zoneMargin },
    { minX: zoneMidX + 4, maxX: gridCols - zoneMargin, minY: zoneMargin, maxY: zoneMidY - 2 },
    { minX: zoneMidX + 4, maxX: gridCols - zoneMargin, minY: zoneMidY + 2, maxY: gridRows - zoneMargin },
    { minX: 5, maxX: 18, minY: 10, maxY: 20 },     // Mid-left area
    { minX: 32, maxX: 45, minY: 10, maxY: 20 },    // Mid-right area
    { minX: 18, maxX: 32, minY: 19, maxY: 28 },    // Bottom-center (below spawn)
  ]
  
  // Try to place rooms
  const maxAttempts = 300
  
  for (let i = 0; i < numRooms; i++) {
    let placed = false
    const zone = placementZones[i % placementZones.length]!
    
    for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
      // Random size - LARGER rooms
      const width = minWidth + Math.floor(Math.random() * (maxWidth - minWidth + 1))
      const height = minHeight + Math.floor(Math.random() * (maxHeight - minHeight + 1))
      
      // Random position within zone (leave margin for corridors)
      const zoneWidth = zone.maxX - zone.minX - width
      const zoneHeight = zone.maxY - zone.minY - height
      if (zoneWidth < 1 || zoneHeight < 1) continue
      
      const gridX = zone.minX + Math.floor(Math.random() * zoneWidth)
      const gridY = zone.minY + Math.floor(Math.random() * zoneHeight)
      
      // Check overlap with spawn zone
      if (overlapsSpawnZone(gridX, gridY, width, height)) continue
      
      // Check overlap with monster nests
      if (overlapsMonsterNest(gridX, gridY, width, height)) continue
      
      // Check overlap with existing rooms (with 2 cell padding for corridors)
      const padding = 2
      let overlaps = false
      for (const existing of placedRooms) {
        if (
          gridX < existing.gridX + existing.width + padding &&
          gridX + width + padding > existing.gridX &&
          gridY < existing.gridY + existing.height + padding &&
          gridY + height + padding > existing.gridY
        ) {
          overlaps = true
          break
        }
      }
      
      if (!overlaps) {
        // Place room
        const roomType = roomTypes[Math.floor(Math.random() * roomTypes.length)] ?? 'normal'
        const doorSide = doorSides[Math.floor(Math.random() * doorSides.length)] ?? 'top'
        
        placedRooms.push({ gridX, gridY, width, height })
        
        // Calculate door position
        let doorGridX: number = gridX + Math.floor(width / 2)
        let doorGridY: number = gridY
        switch (doorSide) {
          case 'top':
            doorGridX = gridX + Math.floor(width / 2)
            doorGridY = gridY
            break
          case 'bottom':
            doorGridX = gridX + Math.floor(width / 2)
            doorGridY = gridY + height - 1
            break
          case 'left':
            doorGridX = gridX
            doorGridY = gridY + Math.floor(height / 2)
            break
          case 'right':
            doorGridX = gridX + width - 1
            doorGridY = gridY + Math.floor(height / 2)
            break
        }
        
        // Mark room cells on grid
        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const gx = gridX + dx
            const gy = gridY + dy
            
            if (!grid[gy] || !grid[gy][gx]) continue
            
            const isDoorCell = gx === doorGridX && gy === doorGridY
            const isEdge = dx === 0 || dx === width - 1 || dy === 0 || dy === height - 1
            
            if (isDoorCell) {
              grid[gy][gx] = { x: gx, y: gy, type: 'door', roomId: i, walkable: true }
            } else if (isEdge) {
              grid[gy][gx] = { x: gx, y: gy, type: 'wall', roomId: i, walkable: false }
            } else {
              grid[gy][gx] = { x: gx, y: gy, type: 'room', roomId: i, walkable: true }
            }
          }
        }
        
        // Room HP based on type
        const typeMultiplier = roomType === 'bunker' ? 1.5 : roomType === 'armory' ? 1.2 : 1
        const baseHp = Math.floor(GAME_CONSTANTS.BASE_DOOR_HP * typeMultiplier)
        
        // Bed position (center of room interior)
        const interiorCenterX = gridX + Math.floor(width / 2)
        const interiorCenterY = gridY + Math.floor(height / 2)
        const bedX = interiorCenterX * cellSize + cellSize / 2
        const bedY = interiorCenterY * cellSize + cellSize / 2
        
        // Build spots - all interior cells with minimum distance from bed
        const buildSpots: Vector2[] = []
        for (let dy = 1; dy < height - 1; dy++) {
          for (let dx = 1; dx < width - 1; dx++) {
            const spotX = (gridX + dx) * cellSize + cellSize / 2
            const spotY = (gridY + dy) * cellSize + cellSize / 2
            // Keep minimum distance from bed (1 cell = 48px)
            if (Math.abs(spotX - bedX) > 40 || Math.abs(spotY - bedY) > 40) {
              buildSpots.push({ x: spotX, y: spotY })
            }
          }
        }
        
        // Door position in pixels
        const doorX = doorGridX * cellSize + cellSize / 2
        const doorY = doorGridY * cellSize + cellSize / 2
        
        rooms.push({
          id: i,
          gridX,
          gridY,
          width,
          height,
          centerX: (gridX + width / 2) * cellSize,
          centerY: (gridY + height / 2) * cellSize,
          doorHp: baseHp,
          doorMaxHp: baseHp,
          doorLevel: 1,
          // Door upgrade cost is scaled by difficulty
          doorUpgradeCost: Math.round(100 * economyConfig.value.upgradeCostMultiplier),
          doorRepairCooldown: 0,
          doorIsRepairing: false,
          doorRepairTimer: 0,
          ownerId: null,
          roomType,
          bedPosition: { x: bedX, y: bedY },
          bedLevel: 1,
          // Bed upgrade cost and income are scaled by difficulty
          bedUpgradeCost: Math.round(50 * economyConfig.value.bedUpgradeCostScale),
          bedIncome: economyConfig.value.bedBaseIncome,
          buildSpots,
          doorPosition: { x: doorX, y: doorY },
          doorGridX,
          doorGridY
        })
        
        placed = true
      }
    }
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

// Monster with state machine - spawns at random nest
const getRandomNestPosition = (excludeIndex?: number): Vector2 => {
  const nests = healingPointNests.value
  let availableNests = nests.filter((_, i) => i !== excludeIndex)
  if (availableNests.length === 0) availableNests = nests
  
  const randomNestIndex = Math.floor(Math.random() * availableNests.length)
  const nest = availableNests[randomNestIndex]!
  return {
    x: (nest.gridX + nest.width / 2) * mapConfig.value.cellSize,
    y: (nest.gridY + nest.height / 2) * mapConfig.value.cellSize
  }
}

// Support for multiple monsters based on difficulty
const monsters = reactive<Monster[]>([])

// Create a single monster with config
const createMonster = (id: number, spawnPos: Vector2): Monster => {
  const mConfig = monsterConfig.value
  const cellSize = mapConfig.value.cellSize
  
  return {
    hp: mConfig.maxHp,
    maxHp: mConfig.maxHp,
    damage: mConfig.baseDamage,
    baseDamage: mConfig.baseDamage,
    level: 1,
    levelTimer: 0,
    targetRoomId: null,
    targetPlayerId: null,
    targetVanguardId: null,
    position: { ...spawnPos },
    targetPosition: null,
    path: [],
    speed: mConfig.speed,
    baseSpeed: mConfig.speed,
    state: 'idle',
    monsterState: 'search',
    attackCooldown: 0,
    attackRange: mConfig.attackRange,
    animationFrame: 0,
    animationTimer: 0,
    healZone: { ...spawnPos },
    healZones: healingPointNests.value.map(nest => ({
      x: (nest.gridX + nest.width / 2) * cellSize,
      y: (nest.gridY + nest.height / 2) * cellSize
    })),
    isRetreating: false,
    isFullyHealing: false,
    healIdleTimer: 0,
    facingRight: false,
    targetTimer: 0,
    lastTargets: []
  }
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

// Legacy single monster reference for backward compatibility
const monster = computed(() => monsters[0] || createMonster(0, getRandomNestPosition()))

// Defense buildings
const buildings = reactive<DefenseBuilding[]>([])
const vanguards = reactive<VanguardUnit[]>([])
const particles = reactive<Particle[]>([])
const projectiles = reactive<Projectile[]>([])
const floatingTexts = reactive<FloatingText[]>([])
let floatingTextId = 0
let vanguardIdCounter = 0

// Healing Points with Mana Power system - initialized dynamically
const healingPoints = reactive<HealingPoint[]>([])

const initHealingPoints = () => {
  healingPoints.length = 0
  const hpConfig = healingPointConfig.value
  const cellSize = mapConfig.value.cellSize
  
  for (const [index, nest] of healingPointNests.value.entries()) {
    healingPoints.push({
      id: index,
      position: {
        x: (nest.gridX + nest.width / 2) * cellSize,
        y: (nest.gridY + nest.height / 2) * cellSize
      },
      gridX: nest.gridX,
      gridY: nest.gridY,
      width: nest.width,
      height: nest.height,
      manaPower: hpConfig.maxMana,
      maxManaPower: hpConfig.maxMana,
      manaRegenRate: hpConfig.manaRegenRate
    })
  }
}

const humanPlayer = computed(() => players.find(p => p.isHuman)!)

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

// Calculate building stats based on level
const getBuildingDamage = (baseDamage: number, level: number): number => {
  return Math.floor(baseDamage * Math.pow(GAME_CONSTANTS.BUILDING_DAMAGE_SCALE, level - 1))
}

const getBuildingRange = (baseRange: number, level: number): number => {
  return Math.floor(baseRange * Math.pow(GAME_CONSTANTS.BUILDING_RANGE_SCALE, level - 1))
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

// Touch/button handlers for mobile - set input state
const startMove = (dir: 'up' | 'down' | 'left' | 'right') => {
  moveInput[dir] = true
}

const stopMove = () => {
  moveInput.up = false
  moveInput.down = false
  moveInput.left = false
  moveInput.right = false
}

const stopMoveDir = (dir: 'up' | 'down' | 'left' | 'right') => {
  moveInput[dir] = false
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
          upgradeTarget.value = { type: 'door', room: clickedRoom }
          showUpgradeModal.value = true
          playSfx('click')
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
            upgradeTarget.value = { type: 'bed', room: myRoom }
            showUpgradeModal.value = true
            playSfx('click')
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
            upgradeTarget.value = { type: 'building', building }
            showUpgradeModal.value = true
            playSfx('click')
            return
          }
        }
      }
      
      // Build spot
      for (const spot of myRoom.buildSpots) {
        if (!spot) continue
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
          upgradeTarget.value = { type: 'door', room: clickedRoom }
          showUpgradeModal.value = true
          playSfx('click')
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
            upgradeTarget.value = { type: 'bed', room: myRoom }
            showUpgradeModal.value = true
            playSfx('click')
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
            upgradeTarget.value = { type: 'building', building }
            showUpgradeModal.value = true
            playSfx('click')
            return
          }
        }
      }
      
      // Check if clicking on build spot in OWN room (can build while awake or sleeping)
      for (const spot of myRoom.buildSpots) {
        if (!spot) continue
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
      addMessage(t('messages.claimedRoom', { roomId: currentRoom.id, roomType: getRoomTypeName(currentRoom.roomType) }))
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
  const targetX = monster.position.x - viewportWidth.value / 2
  const targetY = monster.position.y - viewportHeight.value / 2
  const pad = GAME_CONSTANTS.CAMERA_PADDING
  camera.x = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_WIDTH - viewportWidth.value + pad, targetX))
  camera.y = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight.value + pad, targetY))
}

// Build defense (only in rooms)
const buildDefense = (type: DefenseBuilding['type']) => {
  if (!selectedBuildSpot.value || !humanPlayer.value) return
  
  // Vanguard uses different cost structure
  if (type === 'vanguard') {
    const goldCost = GAME_CONSTANTS.VANGUARD.GOLD_COST
    if (humanPlayer.value.gold < goldCost) {
      addMessage(t('messages.notEnoughGoldNeed', { cost: goldCost }))
      return
    }
    humanPlayer.value.gold -= goldCost
  } else {
    const cost = GAME_CONSTANTS.COSTS[type as keyof typeof GAME_CONSTANTS.COSTS] || 0
    
    // ATM costs SOULS, other buildings cost GOLD
    if (type === 'atm') {
      if (humanPlayer.value.souls < cost) {
        addMessage(t('messages.notEnoughSouls', { cost: cost }))
        return
      }
      humanPlayer.value.souls -= cost
    } else {
      if (humanPlayer.value.gold < cost) {
        addMessage(t('messages.notEnoughGold'))
        return
      }
      humanPlayer.value.gold -= cost
    }
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
    goldRate: 'goldRate' in stats ? stats.goldRate : undefined,
    soulRate: 'soulRate' in stats ? stats.soulRate : undefined
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
  
  if (humanPlayer.value.gold < room.bedUpgradeCost) {
    addMessage(t('messages.notEnoughGoldNeed', { cost: room.bedUpgradeCost }))
    return
  }
  
  humanPlayer.value.gold -= room.bedUpgradeCost
  room.bedLevel++
  room.bedIncome = room.bedIncome * 2 // Double income
  room.bedUpgradeCost = room.bedUpgradeCost * 2 // Double cost for next upgrade
  playSfx('build')
  addMessage(t('messages.bedUpgraded', { level: room.bedLevel, income: room.bedIncome }))
  spawnFloatingText(room.bedPosition, `Bed LV${room.bedLevel}!`, '#fbbf24', 14)
  showUpgradeModal.value = false
}

// Upgrade door - increases HP by 50%, cost increases 20% each level
const upgradeDoor = () => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null) return
  const room = rooms.find(r => r.id === humanPlayer.value!.roomId)
  if (!room) return
  
  if (room.doorLevel >= 10) {
    addMessage(t('messages.doorMaxLevel'))
    return
  }
  
  if (humanPlayer.value.gold < room.doorUpgradeCost) {
    addMessage(t('messages.notEnoughGold'))
    return
  }
  
  humanPlayer.value.gold -= room.doorUpgradeCost
  room.doorLevel++
  room.doorMaxHp = Math.floor(room.doorMaxHp * 1.5) // +50% HP
  room.doorHp = room.doorMaxHp // Full heal on upgrade!
  room.doorUpgradeCost = Math.floor(room.doorUpgradeCost * GAME_CONSTANTS.DOOR_UPGRADE_COST_SCALE) // +20% cost
  playSfx('build')
  addMessage(t('messages.doorUpgraded', { level: room.doorLevel, hp: room.doorMaxHp }))
  spawnFloatingText(room.doorPosition, `Door LV${room.doorLevel}!`, '#60a5fa', 14)
  showUpgradeModal.value = false
}

// Rebuild destroyed door - reset to level 1 with base HP
const DOOR_REBUILD_COST = 100 // Cost to rebuild a destroyed door
const rebuildDoor = () => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null) return
  const room = rooms.find(r => r.id === humanPlayer.value!.roomId)
  if (!room) return
  
  if (room.doorHp > 0) {
    addMessage(t('messages.doorNotDestroyed'))
    return
  }
  
  if (humanPlayer.value.gold < DOOR_REBUILD_COST) {
    addMessage(t('messages.doorRebuildNeedGold', { cost: DOOR_REBUILD_COST }))
    return
  }
  
  humanPlayer.value.gold -= DOOR_REBUILD_COST
  
  // Reset door to level 1
  room.doorLevel = 1
  room.doorMaxHp = GAME_CONSTANTS.BASE_DOOR_HP
  room.doorHp = room.doorMaxHp
  room.doorUpgradeCost = GAME_CONSTANTS.COSTS.upgradeDoor
  room.doorRepairCooldown = 0
  room.doorIsRepairing = false
  room.doorRepairTimer = 0
  
  playSfx('build')
  spawnParticles(room.doorPosition, 'build', 12, '#22c55e')
  spawnFloatingText(room.doorPosition, 'Door Rebuilt!', '#22c55e', 16)
  addMessage(t('messages.doorRebuilt'))
  showUpgradeModal.value = false
}

// Start door repair (heals 20% over 7s, 50s cooldown)
const startDoorRepair = () => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null) return
  const room = rooms.find(r => r.id === humanPlayer.value!.roomId)
  if (!room) return
  
  if (room.doorRepairCooldown > 0) {
    addMessage(t('messages.doorRepairCooldown', { time: Math.ceil(room.doorRepairCooldown) }))
    return
  }
  
  if (room.doorHp >= room.doorMaxHp) {
    addMessage(t('messages.doorFullHp'))
    return
  }
  
  room.doorIsRepairing = true
  room.doorRepairTimer = 0
  playSfx('build')
  addMessage(t('messages.doorRepairing'))
  showUpgradeModal.value = false
}

// Upgrade building from modal - turret: +10% damage, +20% range, double cost
const upgradeBuilding = () => {
  if (!humanPlayer.value || !upgradeTarget.value || upgradeTarget.value.type !== 'building') return
  const building = upgradeTarget.value.building
  if (!building) return
  
  // Check if needs souls at level 5+
  if (building.level >= 4) {
    const soulCost = GAME_CONSTANTS.SOUL_UPGRADE_COST * (building.level - 3)
    if (humanPlayer.value.souls < soulCost) {
      addMessage(t('messages.needSoulsForLevel', { cost: soulCost, level: building.level + 1 }))
      return
    }
    humanPlayer.value.souls -= soulCost
  }
  
  if (building.level >= 10) {
    addMessage(t('messages.buildingMaxLevel', { type: getBuildingTypeName(building.type) }))
    showUpgradeModal.value = false
    return
  }
  
  if (humanPlayer.value.gold < building.upgradeCost) {
    addMessage(t('messages.needGoldToUpgrade', { cost: building.upgradeCost }))
    return
  }
  
  humanPlayer.value.gold -= building.upgradeCost
  building.level++
  
  // Turret: +10% damage, +20% range
  if (building.type === 'turret') {
    building.damage = Math.floor(building.baseDamage * Math.pow(1.1, building.level - 1))
    building.range = Math.floor(building.baseRange * Math.pow(1.2, building.level - 1))
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
    // Other buildings: standard scaling
    building.damage = getBuildingDamage(building.baseDamage, building.level)
    building.range = getBuildingRange(building.baseRange, building.level)
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

// Close upgrade modal
const closeUpgradeModal = () => {
  showUpgradeModal.value = false
  upgradeTarget.value = null
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
const updateMonsterAI = (deltaTime: number) => {
  // Update attack cooldown
  if (monster.attackCooldown > 0) {
    monster.attackCooldown -= deltaTime
  }
  
  // Monster leveling - NEW FORMULA: 30s + 10s × current level
  const levelUpTime = GAME_CONSTANTS.MONSTER_BASE_LEVEL_TIME + (GAME_CONSTANTS.MONSTER_LEVEL_TIME_INCREMENT * monster.level)
  monster.levelTimer += deltaTime
  if (monster.levelTimer >= levelUpTime) {
    monster.levelTimer = 0
    monster.level++
    // +10% damage and +10% HP per level
    monster.damage = Math.floor(monster.baseDamage * Math.pow(GAME_CONSTANTS.MONSTER_DAMAGE_SCALE, monster.level - 1))
    monster.maxHp = Math.floor(GAME_CONSTANTS.MONSTER_MAX_HP * Math.pow(GAME_CONSTANTS.MONSTER_HP_SCALE, monster.level - 1))
    monster.hp = monster.maxHp // FULL HEAL on level up!
    addMessage(t('messages.monsterSpawned', { level: monster.level, damage: monster.damage, hp: monster.maxHp }))
    spawnFloatingText(monster.position, `LV ${monster.level}!`, '#ff6b6b', 20)
  }
  
  // Find nearest monster nest with sufficient mana for healing
  // Returns null if no healing point has enough mana (>=10% capacity)
  const findNearestHealingPoint = (): HealingPoint | null => {
    const minMana = GAME_CONSTANTS.HEALING_POINT_MAX_MANA * GAME_CONSTANTS.HEALING_POINT_MIN_MANA_PERCENT
    const availablePoints = healingPoints.filter(hp => hp.manaPower >= minMana)
    
    if (availablePoints.length === 0) return null
    
    let nearest = availablePoints[0]!
    let nearestDist = distance(monster.position, nearest.position)
    
    for (const hp of availablePoints) {
      const d = distance(monster.position, hp.position)
      if (d < nearestDist) {
        nearestDist = d
        nearest = hp
      }
    }
    return nearest
  }
  
  // Get healing point monster is currently at (within range)
  const getHealingPointAtMonster = (): HealingPoint | null => {
    for (const hp of healingPoints) {
      if (distance(monster.position, hp.position) < 100) {
        return hp
      }
    }
    return null
  }
  
  // =========================================================================
  // HEALING WITH MANA SYSTEM: Healing consumes mana, immediate re-engage
  // No more 5-second idle delay - monster attacks immediately when healed
  // =========================================================================
  
  // STATE: RETREAT - when HP is low, go to nearest nest with mana
  if (monster.hp / monster.maxHp < GAME_CONSTANTS.MONSTER_HEAL_THRESHOLD || monster.isFullyHealing) {
    monster.monsterState = 'retreat'
    
    const targetHealingPoint = findNearestHealingPoint()
    
    // If no healing point has sufficient mana, stop retreating and resume combat
    if (!targetHealingPoint) {
      if (monster.isFullyHealing || monster.isRetreating) {
        addMessage(t('messages.healingPointsExhausted'))
        spawnFloatingText(monster.position, '⚡ No Mana!', '#ef4444', 14)
      }
      monster.isFullyHealing = false
      monster.isRetreating = false
      monster.speed = monster.baseSpeed
      monster.monsterState = 're-engage'
      // Continue to normal target selection below
    } else {
      // Set retreat state if not already retreating
      if (!monster.isRetreating && !monster.isFullyHealing) {
        monster.isRetreating = true
        monster.isFullyHealing = true
        monster.healIdleTimer = 0
        monster.speed = monster.baseSpeed * GAME_CONSTANTS.MONSTER_RETREAT_SPEED_BONUS
        monster.targetPlayerId = null
        monster.targetTimer = 0
        addMessage(t('messages.monsterRetreating'))
      }
      
      const distToHeal = distance(monster.position, targetHealingPoint.position)
      
      if (distToHeal > 50) {
        // Walking to nest
        if (monster.path.length === 0 || monster.state !== 'walking') {
          const walkableGrid = createWalkableGrid(-1, true)
          monster.path = findPath(walkableGrid, monster.position, targetHealingPoint.position, GAME_CONSTANTS.CELL_SIZE)
          monster.state = 'walking'
          monster.targetPosition = targetHealingPoint.position
        }
      } else {
        // STATE: HEAL - regenerate at nest, consuming mana
        const currentHealPoint = getHealingPointAtMonster()
        
        if (currentHealPoint) {
          const minMana = GAME_CONSTANTS.HEALING_POINT_MAX_MANA * GAME_CONSTANTS.HEALING_POINT_MIN_MANA_PERCENT
          
          // Check if current healing point has enough mana to continue healing
          if (currentHealPoint.manaPower < minMana) {
            // Mana depleted - leave immediately and resume combat
            spawnFloatingText(monster.position, '⚡ Out of Mana!', '#fbbf24', 14)
            monster.isFullyHealing = false
            monster.isRetreating = false
            monster.speed = monster.baseSpeed
            monster.monsterState = 're-engage'
            addMessage(t('messages.healingPointDepleted'))
          } else {
            // Heal using mana - mana cost equals HP restored
            monster.monsterState = 'heal'
            monster.state = 'healing'
            monster.path = []
            
            // Calculate heal amount (20% max HP per second)
            const potentialHeal = monster.maxHp * GAME_CONSTANTS.MONSTER_HEAL_RATE * deltaTime
            const hpNeeded = monster.maxHp - monster.hp
            const healAmount = Math.min(potentialHeal, hpNeeded, currentHealPoint.manaPower)
            
            // Apply healing and consume mana
            monster.hp += healAmount
            currentHealPoint.manaPower -= healAmount
            
            // Show mana consumption
            if (Math.random() < 0.1) {
              const manaPercent = Math.round((currentHealPoint.manaPower / currentHealPoint.maxManaPower) * 100)
              spawnFloatingText(currentHealPoint.position, `💧 ${manaPercent}%`, '#60a5fa', 10)
            }
            
            spawnParticles(monster.position, 'heal', 1, '#22c55e')
            
            // Check if fully healed - IMMEDIATELY resume hunting (no idle delay)
            if (monster.hp >= monster.maxHp) {
              monster.hp = monster.maxHp
              monster.isFullyHealing = false
              monster.isRetreating = false
              monster.speed = monster.baseSpeed
              monster.targetPlayerId = null
              monster.monsterState = 're-engage'
              addMessage(t('messages.monsterFullyHealed'))
              spawnFloatingText(monster.position, '💪 Full HP!', '#22c55e', 14)
            }
          }
        } else {
          // Not at a valid healing point despite being close - find new one
          monster.path = []
        }
      }
      return
    }
  }
  
  // Reset retreat state if HP is above threshold
  monster.isRetreating = false
  monster.speed = monster.baseSpeed
  
  // Track target timer (30s max per target)
  if (monster.targetPlayerId !== null) {
    monster.targetTimer += deltaTime
    
    // DISENGAGE after 30 seconds on same target
    if (monster.targetTimer >= GAME_CONSTANTS.MONSTER_TARGET_TIMEOUT) {
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
      if (distToVanguard < GAME_CONSTANTS.MONSTER_ATTACK_RANGE) {
        monster.state = 'attacking'
        monster.path = []
        monster.facingRight = targetVanguard.position.x > monster.position.x
        
        if (monster.attackCooldown <= 0) {
          targetVanguard.hp -= monster.damage
          monster.attackCooldown = GAME_CONSTANTS.MONSTER_ATTACK_SPEED
          playSfx('hit')
          spawnParticles(targetVanguard.position, 'blood', 8, '#a855f7')
          spawnFloatingText(targetVanguard.position, `-${monster.damage}`, '#ef4444', 14)
          
          if (targetVanguard.hp <= 0) {
            targetVanguard.hp = 0
            targetVanguard.state = 'dead'
            targetVanguard.respawnTimer = GAME_CONSTANTS.VANGUARD.RESPAWN_TIME
            spawnFloatingText(targetVanguard.position, '💀 Vanguard Down!', '#ef4444', 14)
            monster.targetVanguardId = null // Clear vanguard target
          }
        }
        return
      } else {
        // Chase the vanguard
        monster.state = 'walking'
        const walkableGrid = createWalkableGrid(-1, true)
        if (monster.path.length === 0 || Math.random() < 0.05) {
          monster.path = findPath(walkableGrid, monster.position, targetVanguard.position, GAME_CONSTANTS.CELL_SIZE)
        }
        
        if (monster.path.length > 0) {
          const nextPos = monster.path[0]!
          monster.facingRight = nextPos.x > monster.position.x
          monster.position = moveTowards(monster.position, nextPos, monster.speed, deltaTime)
          if (distance(monster.position, nextPos) < 5) {
            monster.path.shift()
          }
        }
        return
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
      return
    }
  }
  
  // Get current target
  const targetPlayer = players.find(p => p.id === monster.targetPlayerId && p.alive)
  if (!targetPlayer) {
    // Target died or invalid - clear and search again
    monster.targetPlayerId = null
    monster.targetTimer = 0
    monster.monsterState = 'search'
    return
  }
  
  // STATE: ATTACK - pursue and attack the target
  monster.monsterState = 'attack'
  const distToTarget = distance(monster.position, targetPlayer.position)
  
  // Check if monster can directly attack this player
  if (distToTarget < GAME_CONSTANTS.MONSTER_ATTACK_RANGE) {
    monster.state = 'attacking'
    monster.path = []
    if (monster.attackCooldown <= 0) {
      targetPlayer.hp -= monster.damage
      monster.attackCooldown = GAME_CONSTANTS.MONSTER_ATTACK_SPEED
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
    return
  }
  
  // Check if we need to break through a door to reach the player
  const playerRoom = targetPlayer.roomId !== null ? rooms.find(r => r.id === targetPlayer.roomId) : null
  
  // OBSTACLE DESTRUCTION: Check if any building blocks the path to target
  const obstacleInRange = buildings.find(b => {
    if (b.hp <= 0) return false
    const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, GAME_CONSTANTS.CELL_SIZE)
    const distToBuilding = distance(monster.position, bPos)
    return distToBuilding < GAME_CONSTANTS.CELL_SIZE * 1.5
  })
  
  if (obstacleInRange) {
    const bPos = gridToWorld({ x: obstacleInRange.gridX, y: obstacleInRange.gridY }, GAME_CONSTANTS.CELL_SIZE)
    monster.state = 'attacking'
    monster.path = []
    monster.facingRight = bPos.x > monster.position.x
    
    if (monster.attackCooldown <= 0) {
      obstacleInRange.hp -= monster.damage
      monster.attackCooldown = GAME_CONSTANTS.MONSTER_ATTACK_SPEED
      playSfx('hit')
      spawnParticles(bPos, 'spark', 8, '#ff9900')
      spawnFloatingText(bPos, `-${monster.damage}`, '#ef4444', 14)
      
      if (obstacleInRange.hp <= 0) {
        obstacleInRange.hp = 0
        addMessage(t('messages.monsterDestroyedBuilding', { type: getBuildingTypeName(obstacleInRange.type) }))
        spawnFloatingText(bPos, '💥', '#ff6b6b', 18)
        spawnParticles(bPos, 'explosion', 15, '#ff6b6b')
      }
    }
    return
  }

  if (playerRoom && playerRoom.doorHp > 0) {
    const doorPos = playerRoom.doorPosition
    const distToDoor = distance(monster.position, doorPos)
    
    if (distToDoor < GAME_CONSTANTS.CELL_SIZE * 1.2) {
      monster.state = 'attacking'
      monster.path = []
      if (monster.attackCooldown <= 0) {
        const doorDamage = Math.floor(monster.damage * 1.5)
        playerRoom.doorHp -= doorDamage
        monster.attackCooldown = GAME_CONSTANTS.MONSTER_ATTACK_SPEED
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
        monster.path = findPath(walkableGrid, monster.position, doorPos, GAME_CONSTANTS.CELL_SIZE)
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
      monster.path = findPath(walkableGrid, monster.position, targetPlayer.position, GAME_CONSTANTS.CELL_SIZE)
      if (monster.path.length > 0) {
        monster.state = 'walking'
        monster.targetPosition = targetPlayer.position
      } else {
        monster.state = 'idle'
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
    
    // Calculate threat level
    const doorHpPercent = myRoom.doorHp / myRoom.doorMaxHp
    const monsterTargetingMe = monster.targetPlayerId === player.id
    const monsterLevel = monster.level
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
    const findEmptySpot = (prioritizeNearDoor: boolean = false): Vector2 | null => {
      const emptySpots = myRoom.buildSpots.filter(spot => {
        return !buildings.some(b => {
          if (b.hp <= 0) return false // Destroyed buildings don't block
          const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, GAME_CONSTANTS.CELL_SIZE)
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
        return !buildings.some(b => {
          if (b.hp <= 0) return false
          const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, GAME_CONSTANTS.CELL_SIZE)
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
          const tPos = gridToWorld({ x: t.gridX, y: t.gridY }, GAME_CONSTANTS.CELL_SIZE)
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
    const upgradableTurret = myTurrets.find(t => t.level < 5 && player.gold >= t.upgradeCost)
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
    // ACTION 6: BUILD SOUL COLLECTOR (Economy - needed for ATM)
    // ------------------------------------------------------------------
    const economySpot = findEmptySpot()
    if (mySoulCollectors.length === 0 && player.gold >= GAME_CONSTANTS.COSTS.soulCollector && economySpot) {
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
    if (myATMs.length === 0 && mySoulCollectors.length > 0 && player.souls >= GAME_CONSTANTS.COSTS.atm && economySpot) {
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
    const upgradableSoulCollector = mySoulCollectors.find(s => s.level < 5 && player.gold >= s.upgradeCost)
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
          spawnFloatingText(pos, `👻 LV${upgradableSoulCollector.level}!`, '#a855f7', 12)
          return true
        }
      })
    }
    
    // ------------------------------------------------------------------
    // ACTION 9: UPGRADE ATM
    // ------------------------------------------------------------------
    const upgradableATM = myATMs.find(a => a.level < 5 && player.gold >= a.upgradeCost)
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
          spawnFloatingText(pos, `⚔️ LV${upgradableVanguard.level}!`, '#6366f1', 14)
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
    
    // Find nearest monster
    const distToMonster = distance(unit.position, monster.position)
    const monsterAlive = monster.hp > 0
    
    // STATE: CHASING/ATTACKING - pursue monster (increased detection range)
    const effectiveDetectionRange = VANGUARD.DETECTION_RANGE * 2 // Double detection range for better engagement
    
    if (monsterAlive && distToMonster < effectiveDetectionRange) {
      unit.targetMonsterId = true
      
      // In attack range
      if (distToMonster < VANGUARD.ATTACK_RANGE) {
        unit.state = 'attacking'
        unit.path = []
        unit.facingRight = monster.position.x > unit.position.x
        
        if (unit.attackCooldown <= 0) {
          // Attack monster!
          monster.hp -= unit.damage
          unit.attackCooldown = VANGUARD.ATTACK_COOLDOWN
          
          // Monster reacts - prioritize this vanguard
          monster.targetVanguardId = unit.id
          
          playSfx('hit')
          spawnParticles(monster.position, 'blood', 6, '#a855f7')
          spawnFloatingText(monster.position, `-${unit.damage}`, '#a855f7', 12)
          
          if (monster.hp <= 0) {
            endGame(true)
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
          (unit.targetPosition && distance(monster.position, unit.targetPosition) > 100)
        
        if (shouldRecalcPath) {
          const walkableGrid = createWalkableGrid(-1, false, true) // isVanguard=true
          const newPath = findPath(walkableGrid, unit.position, monster.position, GAME_CONSTANTS.CELL_SIZE)
          
          if (newPath.length > 0) {
            unit.path = newPath
            unit.targetPosition = { ...monster.position }
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
          const newPosition = moveTowards(unit.position, monster.position, unit.speed, deltaTime)
          unit.position.x = newPosition.x
          unit.position.y = newPosition.y
          unit.facingRight = monster.position.x > unit.position.x
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
  for (const hp of healingPoints) {
    // Regenerate mana at configured rate (50 mana/second)
    if (hp.manaPower < hp.maxManaPower) {
      hp.manaPower = Math.min(hp.maxManaPower, hp.manaPower + hp.manaRegenRate * deltaTime)
    }
  }
}

// Update buildings
const updateBuildings = (deltaTime: number) => {
  buildings.forEach(building => {
    if (building.hp <= 0) return
    if (building.type !== 'turret') return  // Only turrets shoot
    
    building.currentCooldown -= deltaTime
    building.animationFrame += deltaTime * 8
    
    const buildingPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
    // Calculate actual damage and range based on level
    const actualDamage = getBuildingDamage(building.baseDamage, building.level)
    const actualRange = getBuildingRange(building.baseRange, building.level)
    const distToMonster = distance(buildingPos, monster.position)
    
    if (distToMonster < actualRange && monster.hp > 0) {
      const dx = monster.position.x - buildingPos.x
      const dy = monster.position.y - buildingPos.y
      building.rotation = Math.atan2(dy, dx)
      
      if (building.currentCooldown <= 0) {
        projectiles.push({
          position: { ...buildingPos },
          target: { ...monster.position },
          speed: 500,
          damage: actualDamage,
          ownerId: building.ownerId,
          color: '#3b82f6',
          size: 5,
          isHoming: true // Homing projectile - tracks monster
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
    const proj = projectiles[i]
    if (!proj) continue
    
    // Homing projectiles track the monster's current position
    if (proj.isHoming && monster.hp > 0) {
      proj.target.x = monster.position.x
      proj.target.y = monster.position.y
    }
    
    const moved = moveTowards(proj.position, proj.target, proj.speed, deltaTime)
    proj.position.x = moved.x
    proj.position.y = moved.y
    
    if (distance(proj.position, monster.position) < 40) {
      monster.hp -= proj.damage
      spawnParticles(proj.position, 'explosion', 8, proj.color)
      spawnFloatingText(proj.position, `-${proj.damage}`, '#3b82f6', 14)
      projectiles.splice(i, 1)
      if (monster.hp <= 0) endGame(true)
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
              spawnFloatingText(player.position, `+${goldToAdd}💰`, '#fbbf24', 14)
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
    
    // Update rooms (door repair, cooldowns)
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
            spawnFloatingText(bPos, `+${goldToAdd}💰`, '#22c55e', 12)
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
            spawnFloatingText(bPos, `+${soulsToAdd}👻`, '#a855f7', 12)
          }
        }
      }
    })
    
    // Monster only active after countdown ends
    if (monsterActive.value) {
      if (monster.state === 'walking') moveAlongPath(monster, deltaTime)
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
  ctx.translate(-camera.x, -camera.y)
  
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
          const room = cell.roomId !== undefined ? rooms[cell.roomId] : null
          const roomColors: Record<string, string> = { 
            normal: '#2a2a3e', 
            armory: '#3a2a2a', 
            storage: '#2a3a2a', 
            bunker: '#3a3a4a' 
          }
          ctx.fillStyle = room ? (roomColors[room.roomType] || '#2a2a3e') : '#2a2a3e'
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
        
        // Nest icon with mana indicator
        ctx.fillStyle = hasEnoughMana ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.5)'
        ctx.font = '16px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(hasEnoughMana ? '🐉' : '💀', px + cellSize / 2, py + cellSize / 2)
      }
      
      // Central spawn zone marker
      if (isInSpawnZone(x, y)) {
        ctx.fillStyle = `rgba(96, 165, 250, ${0.1 + Math.sin(Date.now() / 500) * 0.05})`
        ctx.fillRect(px, py, cellSize, cellSize)
      }
    }
  }
  
  // Draw spawn zone border
  const sz = GAME_CONSTANTS.SPAWN_ZONE
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
  ctx.fillText('⭐ SPAWN ZONE ⭐', szPx + szWidth / 2, szPy + szHeight / 2)
  
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
    const manaText = `💧 ${Math.floor(hp.manaPower)}/${hp.maxManaPower}`
    ctx.fillText(manaText, barX + barWidth / 2, barY + barHeight / 2)
    
    // Healing point label
    ctx.fillStyle = hasEnoughMana ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)'
    ctx.font = 'bold 12px Arial'
    ctx.fillText(hasEnoughMana ? '🐉 NEST' : '💀 DEPLETED', centerX, hp.gridY * cellSize - 8)
  })
  
  // Draw rooms with details
  rooms.forEach(room => {
    if (!ctx) return
    const px = room.gridX * cellSize
    const py = room.gridY * cellSize
    const width = room.width * cellSize
    const height = room.height * cellSize
    
    // Check if door should be closed (someone sleeping inside)
    const hasSleepingPlayer = players.some(p => p.alive && p.roomId === room.id && p.isSleeping)
    const isDoorClosed = hasSleepingPlayer && room.doorHp > 0
    
    // Room border
    ctx.strokeStyle = room.ownerId !== null ? players[room.ownerId]?.color || '#555' : '#333'
    ctx.lineWidth = 4
    ctx.strokeRect(px, py, width, height)
    
    // Door position (use actual door grid position)
    const doorPx = room.doorGridX * cellSize
    const doorPy = room.doorGridY * cellSize
    const doorHpPercent = room.doorHp / room.doorMaxHp
    
    // Draw door at correct position
    if (room.doorHp <= 0) {
      // Door broken - show rubble
      ctx.fillStyle = '#3a3a3a'
      ctx.fillRect(doorPx + 10, doorPy + 10, cellSize - 20, cellSize - 20)
      ctx.fillStyle = '#555'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('💥', doorPx + cellSize/2, doorPy + cellSize/2 + 6)
    } else if (isDoorClosed) {
      // Door closed - solid door with lock icon
      ctx.fillStyle = '#5a4a6a'
      ctx.fillRect(doorPx + 10, doorPy + 10, cellSize - 20, cellSize - 20)
      ctx.strokeStyle = '#8a6aaa'
      ctx.lineWidth = 3
      ctx.strokeRect(doorPx + 10, doorPy + 10, cellSize - 20, cellSize - 20)
      ctx.fillStyle = '#fbbf24'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('🔒', doorPx + cellSize/2, doorPy + cellSize/2 + 5)
    } else {
      // Door open - frame only
      ctx.strokeStyle = doorHpPercent > 0.5 ? '#4a6a4a' : doorHpPercent > 0.2 ? '#6a5a3a' : '#6a3a3a'
      ctx.lineWidth = 3
      ctx.strokeRect(doorPx + 10, doorPy + 10, cellSize - 20, cellSize - 20)
      ctx.fillStyle = '#2a4a2a'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('🚪', doorPx + cellSize/2, doorPy + cellSize/2 + 5)
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
    
    // Room type icon
    const icons: Record<string, string> = { normal: '🏠', armory: '⚔️', storage: '📦', bunker: '🛡️' }
    ctx.font = '20px Arial'
    ctx.fillText(icons[room.roomType] || '🏠', px + 20, py + 30)
    
    // Bed
    ctx.fillStyle = '#5a4a3a'
    ctx.fillRect(room.bedPosition.x - 25, room.bedPosition.y - 15, 50, 30)
    ctx.fillStyle = '#8b7355'
    ctx.fillRect(room.bedPosition.x - 20, room.bedPosition.y - 12, 40, 24)
    ctx.fillStyle = '#fff'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`Lv${room.bedLevel}`, room.bedPosition.x, room.bedPosition.y + 35)
    ctx.fillText('🛏️', room.bedPosition.x, room.bedPosition.y + 5)
    
    // BED UPGRADE INDICATOR: Show pulsing glow when player is sleeping and can upgrade
    if (humanPlayer.value && humanPlayer.value.roomId === room.id && humanPlayer.value.isSleeping) {
      const pulse = 0.3 + Math.sin(Date.now() / 200) * 0.2
      ctx.strokeStyle = `rgba(251, 191, 36, ${pulse})`
      ctx.lineWidth = 3
      ctx.strokeRect(room.bedPosition.x - 28, room.bedPosition.y - 18, 56, 36)
      // Show upgrade arrow
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 14px Arial'
      ctx.fillText('⬆', room.bedPosition.x + 30, room.bedPosition.y - 8)
    }
    
    // Build spots - highlight green when player is in this room
    const isPlayerRoom = humanPlayer.value?.roomId === room.id
    room.buildSpots.forEach(spot => {
      if (!ctx) return
      const hasBuilding = buildings.some(b => {
        const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, cellSize)
        return distance(bPos, spot) < 30
      })
      if (!hasBuilding) {
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
      vanguard: '#6366f1'
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
      // Ghost icon effect
      const pulse = Math.sin(Date.now() / 300) * 3
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('👻', 0, pulse)
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
      // Sword emblem
      ctx.fillStyle = '#c0c0c0'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('⚔️', 0, 2)
      // Show unit count
      const unitCount = getVanguardUnitCount(building.level)
      const aliveUnits = vanguards.filter(v => v.buildingId === building.id && v.state !== 'dead').length
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 10px Arial'
      ctx.fillText(`${aliveUnits}/${unitCount}`, 0, 14)
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
    ctx.fillStyle = '#1d4ed8'
    ctx.fillText('⚔', -12, 6)
    
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
      ctx.fillText('⚔️', x, y - 32)
    } else if (unit.state === 'roaming') {
      ctx.fillStyle = '#3b82f6'
      ctx.font = '10px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('👁️', x, y - 32)
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
    ctx.fillText(`👻 ${Math.ceil(unit.respawnTimer)}s`, buildingPos.x, buildingPos.y + 30)
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
      ctx.fillStyle = '#fff'
      ctx.font = '12px Arial'
      ctx.fillText('💤', 15, -20)
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
  
  // Draw monster
  if (ctx && monster.hp > 0) {
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
    
    // Body
    ctx.fillStyle = monster.isRetreating ? '#581c87' : '#7c3aed'
    ctx.beginPath()
    ctx.ellipse(0, 0, 35, 45, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // Horns
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
    
    // Eyes
    ctx.fillStyle = '#ef4444'
    ctx.shadowColor = '#ef4444'
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
    
    // Attack effect
    if (monster.state === 'attacking') {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(25, 0)
      ctx.lineTo(50, -5)
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
    
    // Monster level badge
    ctx.fillStyle = '#7c3aed'
    ctx.beginPath()
    ctx.arc(x + 50, y - 60, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${monster.level}`, x + 50, y - 56)
    
    ctx.fillStyle = '#fff'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.floor(monster.hp)}/${monster.maxHp}`, x, y - 75)
  }
  
  // Draw projectiles
  projectiles.forEach(proj => {
    if (!ctx) return
    ctx.fillStyle = proj.color
    ctx.shadowColor = proj.color
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(proj.position.x, proj.position.y, proj.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
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
        renderCtx.fillText('🔧', doorPx + GAME_CONSTANTS.CELL_SIZE / 2, barY - 8)
      }
    })
    
    renderCtx.restore()
  }
  
  // Monster spawn countdown overlay - only shown before monster is active
  if (ctx && !monsterActive.value && gamePhase.value === 'playing') {
    // Semi-transparent banner at top instead of full overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, canvas.width, 120)
    
    // Countdown number - smaller, positioned at top center
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('🐉 ' + Math.ceil(countdown.value).toString() + 's', canvas.width / 2, 55)
    
    ctx.fillStyle = '#fff'
    ctx.font = '18px Arial'
    ctx.fillText('Quái vật sẽ săn lùng sau thời gian đếm ngược!', canvas.width / 2, 90)
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

  // Reset healing points
  healingPoints.length = 0
  initHealingPoints()

  // Reset monsters
  monsters.length = 0
  initMonsters()

  // Reset players, rooms, grid
  gamePhase.value = 'playing' // Game starts immediately
  countdown.value = timingConfig.value.countdownTime
  monsterActive.value = false // Monster inactive until countdown ends
  gameOver.value = false
  victory.value = false

  initGrid()
  initRooms()
  initPlayers()

  // Camera reset
  camera.x = 0
  camera.y = 0

  startBgm()
  lastTime = performance.now()
  animationId = requestAnimationFrame(gameLoop)
}

const backToHome = () => {
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
      initRooms()
      initPlayers()
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
  <div class="relative flex h-screen flex-col bg-neutral-950 text-white overflow-hidden">
    <!-- Top Bar - Semi-transparent for mobile -->
    <div class="flex items-center justify-between border-b border-neutral-800/50 bg-neutral-900/70 backdrop-blur-sm px-3 py-1.5 z-20">
      <button class="text-neutral-400 hover:text-white transition text-sm px-2 py-1" @click="backToHome">{{ t('ui.back') }}</button>
      
      <div class="flex items-center gap-2">
        <div class="rounded-lg bg-neutral-800/60 px-3 py-1 text-xs">
          <span v-if="!monsterActive" class="font-bold text-amber-400">{{ t('ui.spawnsIn', { time: Math.ceil(countdown) }) }}</span>
          <span v-else class="font-bold text-red-400">{{ t('ui.monsterActive') }}</span>
        </div>
        <div class="rounded-lg bg-red-900/40 px-3 py-1 text-xs">
          👹 <span class="font-bold text-red-400">LV{{ monster.level }} {{ Math.floor(monster.hp) }}/{{ monster.maxHp }}</span>
        </div>
      </div>
      
      <div class="flex items-center gap-2 text-xs">
        <span class="text-amber-400 font-bold">💰{{ Math.floor(humanPlayer?.gold || 0) }}</span>
        <span class="text-violet-400 font-bold">👻{{ humanPlayer?.souls || 0 }}</span>
        <span class="text-red-400">❤️{{ humanPlayer?.hp || 0 }}</span>
        <span v-if="humanPlayer?.isSleeping" class="text-blue-400">💤 {{ Math.floor(humanPlayer?.sleepTimer || 0) }}s</span>
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

      <!-- Center-Bottom: Movement Controls - Hidden when sleeping -->
      <div 
        v-if="gamePhase === 'playing' && humanPlayer?.alive && !humanPlayer?.isSleeping"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
      >
        <div class="rounded-2xl bg-black/40 backdrop-blur-sm p-2 border border-white/10">
          <div class="grid grid-cols-3 gap-1" style="width: 150px;">
            <div></div>
            <button 
              class="w-12 h-12 bg-white/20 hover:bg-white/30 active:bg-amber-500/70 rounded-xl flex items-center justify-center text-2xl font-bold touch-manipulation select-none transition-colors"
              @mousedown.prevent="startMove('up')"
              @mouseup.prevent="stopMoveDir('up')"
              @mouseleave="stopMoveDir('up')"
              @touchstart.prevent="startMove('up')"
              @touchend.prevent="stopMoveDir('up')"
            >↑</button>
            <div></div>
            <button 
              class="w-12 h-12 bg-white/20 hover:bg-white/30 active:bg-amber-500/70 rounded-xl flex items-center justify-center text-2xl font-bold touch-manipulation select-none transition-colors"
              @mousedown.prevent="startMove('left')"
              @mouseup.prevent="stopMoveDir('left')"
              @mouseleave="stopMoveDir('left')"
              @touchstart.prevent="startMove('left')"
              @touchend.prevent="stopMoveDir('left')"
            >←</button>
            <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-lg text-white/50">🎮</div>
            <button 
              class="w-12 h-12 bg-white/20 hover:bg-white/30 active:bg-amber-500/70 rounded-xl flex items-center justify-center text-2xl font-bold touch-manipulation select-none transition-colors"
              @mousedown.prevent="startMove('right')"
              @mouseup.prevent="stopMoveDir('right')"
              @mouseleave="stopMoveDir('right')"
              @touchstart.prevent="startMove('right')"
              @touchend.prevent="stopMoveDir('right')"
            >→</button>
            <div></div>
            <button 
              class="w-12 h-12 bg-white/20 hover:bg-white/30 active:bg-amber-500/70 rounded-xl flex items-center justify-center text-2xl font-bold touch-manipulation select-none transition-colors"
              @mousedown.prevent="startMove('down')"
              @mouseup.prevent="stopMoveDir('down')"
              @mouseleave="stopMoveDir('down')"
              @touchstart.prevent="startMove('down')"
              @touchend.prevent="stopMoveDir('down')"
            >↓</button>
            <div></div>
          </div>
        </div>
      </div>

      <!-- Left Side: Action Buttons -->
      <div class="absolute bottom-4 left-3 flex flex-col gap-2 z-10">
        <!-- Sleep Button (when near bed) -->
        <Transition name="popup">
          <button 
            v-if="isNearBed && gamePhase === 'playing' && !humanPlayer?.isSleeping"
            class="px-4 py-3 bg-blue-600/80 hover:bg-blue-500/80 backdrop-blur-sm rounded-xl text-sm font-bold shadow-lg border border-blue-400/30"
            @click="goToSleep"
          >
            🛏️ {{ !monsterActive && currentNearRoom?.ownerId === null ? t('ui.claimAndSleep') : t('ui.sleep') }}
          </button>
        </Transition>
        
        <!-- Sleep status (when sleeping) - permanent, no wake button -->
        <div v-if="humanPlayer?.isSleeping && gamePhase === 'playing'" class="rounded-xl border border-blue-500/30 bg-blue-950/70 backdrop-blur-sm p-3">
          <p class="text-blue-300 text-sm mb-2">{{ t('ui.sleepingPermanently') }}</p>
          <p class="text-blue-200/60 text-xs mb-1">{{ t('ui.sleepTipUpgrade') }}</p>
          <p class="text-amber-300/60 text-xs">{{ t('ui.sleepTipDefense') }}</p>
        </div>
        
        <!-- Camera reset button -->
        <button 
          v-if="cameraManualMode"
          class="px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium border border-white/10"
          @click="resetCameraToPlayer"
        >
          {{ t('ui.followPlayer') }}
        </button>
      </div>

      <!-- TOP-LEFT: Player & Monster Status Panel -->
      <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
        <!-- Monster Avatar (clickable) -->
        <button 
          v-if="monsterActive"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg backdrop-blur-sm border transition-all hover:scale-105"
          :class="monster.hp > 0 ? 'bg-red-900/60 border-red-500/50 hover:bg-red-800/70' : 'bg-neutral-800/60 border-neutral-600/50'"
          @click="navigateToMonster"
        >
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-lg" :class="monster.hp > 0 ? 'bg-red-600' : 'bg-neutral-600'">
            👹
          </div>
          <div class="text-left">
            <div class="text-xs font-bold" :class="monster.hp > 0 ? 'text-red-300' : 'text-neutral-400'">{{ t('terms.monster') }}</div>
            <div class="text-[10px]" :class="monster.hp > 0 ? 'text-red-400/80' : 'text-neutral-500'">LV{{ monster.level }}</div>
          </div>
        </button>
        
        <!-- Player Avatars (clickable) -->
        <button 
          v-for="player in players" 
          :key="player.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg backdrop-blur-sm border transition-all hover:scale-105"
          :class="[
            player.alive 
              ? 'bg-green-900/60 border-green-500/50 hover:bg-green-800/70' 
              : 'bg-red-900/60 border-red-500/50',
            player.isHuman ? 'ring-2 ring-amber-400/50' : ''
          ]"
          @click="navigateToPlayer(player)"
        >
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2"
            :class="player.alive ? 'border-green-400' : 'border-red-400'"
            :style="{ backgroundColor: player.color + 'cc' }"
          >
            {{ player.isHuman ? '👤' : '🤖' }}
          </div>
          <div class="text-left">
            <div class="text-xs font-bold" :class="player.alive ? 'text-green-300' : 'text-red-300'">{{ player.name }}</div>
            <div class="text-[10px]" :class="player.alive ? 'text-green-400/80' : 'text-red-400/80'">
              {{ player.alive ? (player.isSleeping ? t('ui.sleeping') : t('ui.active')) : t('ui.dead') }}
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Upgrade Modal -->
    <Transition name="popup">
      <div v-if="showUpgradeModal && upgradeTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click.self="closeUpgradeModal">
        <div class="relative w-full max-w-xs rounded-2xl border border-white/20 bg-neutral-900/95 backdrop-blur-md p-5 shadow-2xl">
          <button class="absolute right-3 top-3 text-xl text-neutral-500 hover:text-white" @click="closeUpgradeModal">✕</button>
          
          <!-- Door Upgrade -->
          <template v-if="upgradeTarget.type === 'door' && upgradeTarget.room">
            <h2 class="mb-3 text-center font-bold text-lg" :class="upgradeTarget.room.doorHp <= 0 ? 'text-red-400' : 'text-blue-400'">
              {{ upgradeTarget.room.doorHp <= 0 ? t('ui.doorDestroyed') : t('ui.door') }}
            </h2>
            <div class="text-center mb-4">
              <div class="text-2xl font-bold">{{ t('terms.level') }} {{ upgradeTarget.room.doorLevel }}</div>
              <div class="text-sm text-neutral-400">HP: {{ Math.floor(upgradeTarget.room.doorHp) }}/{{ upgradeTarget.room.doorMaxHp }}</div>
              <div v-if="upgradeTarget.room.doorIsRepairing" class="text-xs text-green-400 mt-1">
                🔧 Repairing... {{ Math.floor((upgradeTarget.room.doorRepairTimer / GAME_CONSTANTS.DOOR_REPAIR_DURATION) * 100) }}%
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <!-- REBUILD button when door is destroyed -->
              <template v-if="upgradeTarget.room.doorHp <= 0">
                <div class="text-center text-red-400 text-sm mb-2">{{ t('ui.doorDestroyedDesc') }}</div>
                <button 
                  class="rounded-xl bg-amber-600 hover:bg-amber-500 py-3 font-bold text-white transition"
                  :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.gold || 0) < 100 }"
                  :disabled="(humanPlayer?.gold || 0) < 100"
                  @click="rebuildDoor">
                  {{ t('ui.rebuildDoor', { cost: 100 }) }}
                </button>
              </template>
              
              <!-- Normal upgrade/repair when door exists -->
              <template v-else>
                <!-- Upgrade button -->
                <button 
                  v-if="upgradeTarget.room.doorLevel < 10"
                  class="rounded-xl bg-blue-600 hover:bg-blue-500 py-3 font-bold text-white transition"
                  :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.gold || 0) < upgradeTarget.room.doorUpgradeCost }"
                  :disabled="(humanPlayer?.gold || 0) < upgradeTarget.room.doorUpgradeCost"
                  @click="upgradeDoor">
                  {{ t('ui.upgradeDoor', { cost: upgradeTarget.room.doorUpgradeCost }) }}
                </button>
                <div v-else class="text-center text-green-400 py-2">{{ t('ui.maxLevel') }}</div>
                
                <!-- Repair button (circular indicator) -->
                <button 
                  class="rounded-xl bg-green-600 hover:bg-green-500 py-3 font-bold text-white transition relative overflow-hidden"
                  :class="{ 
                    'opacity-50 cursor-not-allowed': upgradeTarget.room.doorRepairCooldown > 0 || upgradeTarget.room.doorIsRepairing || upgradeTarget.room.doorHp >= upgradeTarget.room.doorMaxHp 
                  }"
                  :disabled="upgradeTarget.room.doorRepairCooldown > 0 || upgradeTarget.room.doorIsRepairing || upgradeTarget.room.doorHp >= upgradeTarget.room.doorMaxHp"
                  @click="startDoorRepair">
                  <span v-if="upgradeTarget.room.doorRepairCooldown > 0">
                    {{ t('ui.repairCooldown', { time: Math.ceil(upgradeTarget.room.doorRepairCooldown) }) }}
                  </span>
                  <span v-else-if="upgradeTarget.room.doorIsRepairing">
                    {{ t('ui.repairing') }}
                  </span>
                  <span v-else-if="upgradeTarget.room.doorHp >= upgradeTarget.room.doorMaxHp">
                    {{ t('ui.fullHp') }}
                  </span>
                  <span v-else>
                    {{ t('ui.repairDoor') }}
                  </span>
                </button>
              </template>
              
              <button class="rounded-xl border border-neutral-600 py-2 text-sm text-neutral-300 hover:bg-white/10 transition" @click="closeUpgradeModal">
                {{ t('ui.cancel') }}
              </button>
            </div>
          </template>
          
          <!-- Bed Upgrade -->
          <template v-else-if="upgradeTarget.type === 'bed' && upgradeTarget.room">
            <h2 class="mb-3 text-center font-bold text-lg text-amber-400">{{ t('ui.bed') }}</h2>
            <div class="text-center mb-4">
              <div class="text-2xl font-bold">{{ t('terms.level') }} {{ upgradeTarget.room.bedLevel }}</div>
              <div class="text-sm text-neutral-400">{{ t('ui.goldPerSec', { rate: upgradeTarget.room.bedIncome }) }}</div>
            </div>
            <div class="flex flex-col gap-2">
              <button 
                class="rounded-xl bg-amber-600 hover:bg-amber-500 py-3 font-bold text-white transition"
                :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.gold || 0) < upgradeTarget.room.bedUpgradeCost }"
                :disabled="(humanPlayer?.gold || 0) < upgradeTarget.room.bedUpgradeCost"
                @click="upgradeBed">
                {{ t('ui.upgradeBed', { cost: upgradeTarget.room.bedUpgradeCost, income: upgradeTarget.room.bedIncome * 2 }) }}
              </button>
              <button class="rounded-xl border border-neutral-600 py-2 text-sm text-neutral-300 hover:bg-white/10 transition" @click="closeUpgradeModal">
                {{ t('ui.cancel') }}
              </button>
            </div>
          </template>
          
          <!-- Building Upgrade/Sell -->
          <template v-else-if="upgradeTarget.type === 'building' && upgradeTarget.building">
            <h2 class="mb-3 text-center font-bold text-lg" :class="{
              'text-blue-400': upgradeTarget.building.type === 'turret',
              'text-green-400': upgradeTarget.building.type === 'atm',
              'text-violet-400': upgradeTarget.building.type === 'soul_collector',
              'text-indigo-400': upgradeTarget.building.type === 'vanguard'
            }">
              {{ upgradeTarget.building.type === 'turret' ? t('ui.turretTitle') : upgradeTarget.building.type === 'atm' ? t('ui.atmTitle') : upgradeTarget.building.type === 'vanguard' ? t('ui.vanguardTitle') : t('ui.soulCollectorTitle') }}
            </h2>
            <div class="text-center mb-4">
              <div class="text-2xl font-bold">{{ t('terms.level') }} {{ upgradeTarget.building.level }}/10</div>
              <div class="text-sm text-neutral-400">
                <span v-if="upgradeTarget.building.damage > 0">DMG: {{ Math.floor(upgradeTarget.building.damage) }}</span>
                <span v-if="upgradeTarget.building.range > 0" class="ml-2">Range: {{ Math.floor(upgradeTarget.building.range) }}</span>
                <span v-if="upgradeTarget.building.goldRate" class="text-yellow-400">💰 {{ upgradeTarget.building.goldRate }}/s</span>
                <span v-if="upgradeTarget.building.soulRate" class="text-violet-400">👻 {{ upgradeTarget.building.soulRate }}/s</span>
                <span v-if="upgradeTarget.building.type === 'vanguard'" class="text-indigo-400">⚔️ {{ 1 + Math.floor(upgradeTarget.building.level / 2) }} units</span>
              </div>
              <div class="text-xs text-red-400">HP: {{ Math.floor(upgradeTarget.building.hp) }}/{{ upgradeTarget.building.maxHp }}</div>
            </div>
            <div class="flex flex-col gap-2">
              <button 
                v-if="upgradeTarget.building.level < 10"
                class="rounded-xl bg-blue-600 hover:bg-blue-500 py-3 font-bold text-white transition"
                :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.gold || 0) < upgradeTarget.building.upgradeCost || (upgradeTarget.building.level >= 4 && (humanPlayer?.souls || 0) < GAME_CONSTANTS.SOUL_UPGRADE_COST * (upgradeTarget.building.level - 3)) }"
                :disabled="(humanPlayer?.gold || 0) < upgradeTarget.building.upgradeCost || (upgradeTarget.building.level >= 4 && (humanPlayer?.souls || 0) < GAME_CONSTANTS.SOUL_UPGRADE_COST * (upgradeTarget.building.level - 3))"
                @click="upgradeBuilding">
                {{ t('ui.upgradeBuilding', { cost: upgradeTarget.building.upgradeCost }) }}<span v-if="upgradeTarget.building.level >= 4">{{ t('ui.upgradeBuildingSouls', { souls: GAME_CONSTANTS.SOUL_UPGRADE_COST * (upgradeTarget.building.level - 3) }) }}</span><span v-else>)</span>
              </button>
              <div v-else class="text-center text-green-400 py-2">{{ t('ui.maxLevel') }}</div>
              <button 
                class="rounded-xl bg-red-600/80 hover:bg-red-500 py-2 font-medium text-white transition"
                @click="sellBuilding">
                {{ t('ui.sellBuilding', { refund: Math.floor(upgradeTarget.building.upgradeCost * 0.4) }) }}
              </button>
              <button class="rounded-xl border border-neutral-600 py-2 text-sm text-neutral-300 hover:bg-white/10 transition" @click="closeUpgradeModal">
                {{ t('ui.cancel') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Build Popup -->
    <Transition name="popup">
      <div v-if="showBuildPopup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click.self="showBuildPopup = false">
        <div class="relative w-full max-w-md rounded-2xl border border-white/20 bg-neutral-900/95 backdrop-blur-md p-5 shadow-2xl">
          <button class="absolute right-3 top-3 text-xl text-neutral-500 hover:text-white" @click="showBuildPopup = false">✕</button>
          <h2 class="mb-3 text-center font-bold text-lg text-amber-400">{{ t('ui.buildDefense') }}</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <!-- Turret -->
            <button
              class="rounded-xl border border-white/10 bg-white/5 p-3 text-center transition hover:border-amber-500/50 hover:bg-white/10"
              :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.gold || 0) < economyConfig.turretCost }"
              :disabled="(humanPlayer?.gold || 0) < economyConfig.turretCost"
              @click="buildDefense('turret')">
              <div class="text-2xl mb-1">🔫</div>
              <div class="font-bold text-sm">{{ t('ui.turret') }}</div>
              <div class="text-xs text-amber-400">{{ economyConfig.turretCost }}g</div>
            </button>
            <!-- ATM -->
            <button
              class="rounded-xl border border-white/10 bg-white/5 p-3 text-center transition hover:border-purple-500/50 hover:bg-white/10"
              :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.souls || 0) < economyConfig.atmCost }"
              :disabled="(humanPlayer?.souls || 0) < economyConfig.atmCost"
              @click="buildDefense('atm')">
              <div class="text-2xl mb-1">🏧</div>
              <div class="font-bold text-sm">{{ t('ui.atm') }}</div>
              <div class="text-xs text-purple-400">{{ economyConfig.atmCost }}👻</div>
            </button>
            <!-- Soul Collector -->
            <button
              class="rounded-xl border border-white/10 bg-white/5 p-3 text-center transition hover:border-purple-500/50 hover:bg-white/10"
              :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.gold || 0) < economyConfig.soulCollectorCost }"
              :disabled="(humanPlayer?.gold || 0) < economyConfig.soulCollectorCost"
              @click="buildDefense('soul_collector')">
              <div class="text-2xl mb-1">👻</div>
              <div class="font-bold text-sm">{{ t('ui.soul') }}</div>
              <div class="text-xs text-amber-400">{{ economyConfig.soulCollectorCost }}g</div>
            </button>
            <!-- Vanguard -->
            <button
              class="rounded-xl border border-white/10 bg-white/5 p-3 text-center transition hover:border-indigo-500/50 hover:bg-white/10"
              :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.gold || 0) < economyConfig.vanguardCost }"
              :disabled="(humanPlayer?.gold || 0) < economyConfig.vanguardCost"
              @click="buildDefense('vanguard')">
              <div class="text-2xl mb-1">⚔️</div>
              <div class="font-bold text-sm">{{ t('ui.vanguard') }}</div>
              <div class="text-xs text-amber-400">{{ economyConfig.vanguardCost }}g</div>
            </button>
          </div>
          <p class="text-xs text-neutral-500 mt-3 text-center">{{ t('ui.vanguardDesc') }}</p>
        </div>
      </div>
    </Transition>

    <!-- Game Over -->
    <Transition name="popup">
      <div v-if="gameOver" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
        <div class="w-full max-w-xs rounded-2xl border-2 p-6 text-center shadow-2xl"
          :class="victory ? 'border-amber-500 bg-linear-to-b from-amber-950/90 to-neutral-900/90' : 'border-red-500 bg-linear-to-b from-red-950/90 to-neutral-900/90'">
          <div class="text-6xl mb-3">{{ victory ? '🏆' : '💀' }}</div>
          <h2 class="text-3xl font-bold" :class="victory ? 'text-amber-400' : 'text-red-400'">
            {{ victory ? t('ui.victory') : t('ui.defeat') }}
          </h2>
          <p class="mt-2 text-neutral-400 text-sm">
            {{ victory ? t('ui.monsterDefeated') : t('ui.youWereKilled') }}
          </p>
          <div class="mt-6 flex flex-col gap-2">
            <button class="rounded-xl bg-linear-to-r from-amber-600 to-amber-500 py-2.5 font-bold text-white" @click="restartGame">
              {{ t('ui.playAgain') }}
            </button>
            <button class="rounded-xl border border-neutral-600 py-2 text-sm text-neutral-300" @click="backToHome">
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
