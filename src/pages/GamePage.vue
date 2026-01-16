<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { initAudio, playSfx, startBgm, stopBgm } from '../composables/useAudio'
import { findPath, distance, moveTowards, gridToWorld } from '../composables/usePathfinding'
import type { 
  Room, Player, Monster, GamePhase, GridCell, 
  DefenseBuilding, Particle, Projectile, Vector2 
} from '../types/game'
import { GAME_CONSTANTS } from '../types/game'

const emit = defineEmits<{
  (e: 'back-home'): void
}>()

// Canvas refs
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let lastTime = 0

// Game state
const gamePhase = ref<GamePhase>('countdown')
const countdown = ref(GAME_CONSTANTS.COUNTDOWN_TIME)
const gameOver = ref(false)
const victory = ref(false)
const messageLog = ref<string[]>([])
const showBuildPopup = ref(false)
const selectedBuildSpot = ref<{ x: number; y: number; roomId: number } | null>(null)

// Camera/viewport with drag support
const camera = reactive({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = reactive({ x: 0, y: 0 })
const cameraStart = reactive({ x: 0, y: 0 })

// Grid map
const grid = reactive<GridCell[][]>([])

// Initialize grid with larger map
const initGrid = () => {
  grid.length = 0
  for (let y = 0; y < GAME_CONSTANTS.GRID_ROWS; y++) {
    const row: GridCell[] = []
    for (let x = 0; x < GAME_CONSTANTS.GRID_COLS; x++) {
      row.push({ x, y, type: 'empty', walkable: false })
    }
    grid.push(row)
  }
  
  // Main horizontal corridors (wider)
  for (let x = 1; x < GAME_CONSTANTS.GRID_COLS - 1; x++) {
    for (let y = 7; y <= 8; y++) {
      const row = grid[y]
      if (row) row[x] = { x, y, type: 'corridor', walkable: true }
    }
  }
  
  // Vertical corridors
  const vCorridors = [4, 11, 19]
  vCorridors.forEach(cx => {
    for (let y = 1; y < GAME_CONSTANTS.GRID_ROWS - 1; y++) {
      const row = grid[y]
      if (row) row[cx] = { x: cx, y, type: 'corridor', walkable: true }
    }
  })
  
  // Monster heal zone (top right corner)
  for (let y = 1; y <= 3; y++) {
    for (let x = 20; x <= 22; x++) {
      const row = grid[y]
      if (row) row[x] = { x, y, type: 'heal_zone', walkable: true }
    }
  }
}

// Rooms with beds and build spots
const rooms = reactive<Room[]>([])

const initRooms = () => {
  rooms.length = 0
  const roomConfigs = [
    // Top row
    { gridX: 1, gridY: 1, width: 3, height: 4, type: 'bunker' as const },
    { gridX: 6, gridY: 1, width: 4, height: 4, type: 'armory' as const },
    { gridX: 13, gridY: 1, width: 4, height: 4, type: 'normal' as const },
    // Bottom row
    { gridX: 1, gridY: 10, width: 3, height: 4, type: 'storage' as const },
    { gridX: 6, gridY: 10, width: 4, height: 4, type: 'normal' as const },
    { gridX: 13, gridY: 10, width: 4, height: 4, type: 'armory' as const },
    { gridX: 20, gridY: 10, width: 3, height: 4, type: 'bunker' as const },
    // Side rooms
    { gridX: 20, gridY: 5, width: 3, height: 3, type: 'normal' as const },
  ]
  
  roomConfigs.forEach((config, index) => {
    // Mark grid cells as room
    for (let dy = 0; dy < config.height; dy++) {
      for (let dx = 0; dx < config.width; dx++) {
        const gx = config.gridX + dx
        const gy = config.gridY + dy
        if (grid[gy] && grid[gy][gx]) {
          grid[gy][gx] = { x: gx, y: gy, type: 'room', roomId: index, walkable: true }
        }
      }
    }
    
    const baseHp = config.type === 'bunker' ? 250 : config.type === 'armory' ? 180 : 120
    const cellSize = GAME_CONSTANTS.CELL_SIZE
    
    // Calculate bed position (center-right of room)
    const bedX = (config.gridX + config.width - 1) * cellSize + cellSize / 2
    const bedY = (config.gridY + Math.floor(config.height / 2)) * cellSize + cellSize / 2
    
    // Calculate build spots inside room (2-4 spots depending on room size)
    const buildSpots: Vector2[] = []
    const spotsX = Math.max(1, config.width - 2)
    const spotsY = Math.max(1, config.height - 2)
    for (let sy = 0; sy < Math.min(2, spotsY); sy++) {
      for (let sx = 0; sx < Math.min(2, spotsX); sx++) {
        buildSpots.push({
          x: (config.gridX + 1 + sx) * cellSize + cellSize / 2,
          y: (config.gridY + 1 + sy) * cellSize + cellSize / 2
        })
      }
    }
    
    rooms.push({
      id: index,
      gridX: config.gridX,
      gridY: config.gridY,
      width: config.width,
      height: config.height,
      centerX: (config.gridX + config.width / 2) * cellSize,
      centerY: (config.gridY + config.height / 2) * cellSize,
      doorHp: baseHp,
      doorMaxHp: baseHp,
      doorLevel: 1,
      ownerId: null,
      roomType: config.type,
      bedPosition: { x: bedX, y: bedY },
      bedLevel: 1,
      buildSpots
    })
  })
}

// Players with smooth movement
const players = reactive<Player[]>([])

const initPlayers = () => {
  players.length = 0
  const colors: string[] = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b']
  const names: string[] = ['Bạn', 'AI-1', 'AI-2', 'AI-3', 'AI-4']
  const startX = 11 * GAME_CONSTANTS.CELL_SIZE
  const startY = 7.5 * GAME_CONSTANTS.CELL_SIZE
  
  for (let i = 0; i <= GAME_CONSTANTS.AI_COUNT; i++) {
    const posX = startX + (i - 2) * 60
    players.push({
      id: i,
      name: names[i] || `Player-${i}`,
      isHuman: i === 0,
      roomId: null,
      alive: true,
      gold: GAME_CONSTANTS.STARTING_GOLD,
      hp: GAME_CONSTANTS.PLAYER_HP,
      maxHp: GAME_CONSTANTS.PLAYER_HP,
      position: { x: posX, y: startY },
      targetPosition: null,
      path: [],
      speed: GAME_CONSTANTS.PLAYER_SPEED,
      state: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      attackCooldown: 0,
      attackRange: GAME_CONSTANTS.PLAYER_ATTACK_RANGE,
      damage: GAME_CONSTANTS.PLAYER_DAMAGE,
      facingRight: true,
      isSleeping: false,
      smoothX: posX,
      smoothY: startY,
      color: colors[i] || '#888888'
    })
  }
}

// Monster
const monster = reactive<Monster>({
  hp: GAME_CONSTANTS.MONSTER_MAX_HP,
  maxHp: GAME_CONSTANTS.MONSTER_MAX_HP,
  damage: GAME_CONSTANTS.MONSTER_DAMAGE,
  targetRoomId: null,
  targetPlayerId: null,
  position: { x: 21 * GAME_CONSTANTS.CELL_SIZE, y: 2 * GAME_CONSTANTS.CELL_SIZE },
  targetPosition: null,
  path: [],
  speed: GAME_CONSTANTS.MONSTER_SPEED,
  state: 'idle',
  attackCooldown: 0,
  attackRange: GAME_CONSTANTS.MONSTER_ATTACK_RANGE,
  animationFrame: 0,
  animationTimer: 0,
  healZone: { x: 21 * GAME_CONSTANTS.CELL_SIZE, y: 2 * GAME_CONSTANTS.CELL_SIZE },
  isRetreating: false,
  facingRight: false
})

// Defense buildings
const buildings = reactive<DefenseBuilding[]>([])
const particles = reactive<Particle[]>([])
const projectiles = reactive<Projectile[]>([])

// Computed
const humanPlayer = computed(() => players.find(p => p.isHuman)!)

// Get players in a room
const getPlayersInRoom = (roomId: number): Player[] => {
  return players.filter(p => p.alive && p.roomId === roomId)
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

// Camera drag handlers
const handleMouseDown = (e: MouseEvent) => {
  if (e.button === 2 || e.button === 1) { // Right or middle click to drag
    isDragging.value = true
    dragStart.x = e.clientX
    dragStart.y = e.clientY
    cameraStart.x = camera.x
    cameraStart.y = camera.y
    e.preventDefault()
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value) {
    const dx = dragStart.x - e.clientX
    const dy = dragStart.y - e.clientY
    camera.x = Math.max(0, Math.min(GAME_CONSTANTS.WORLD_WIDTH - GAME_CONSTANTS.VIEWPORT_WIDTH, cameraStart.x + dx))
    camera.y = Math.max(0, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - GAME_CONSTANTS.VIEWPORT_HEIGHT, cameraStart.y + dy))
  }
}

const handleMouseUp = () => {
  isDragging.value = false
}

// Handle canvas click
const handleCanvasClick = (e: MouseEvent) => {
  if (isDragging.value || !canvasRef.value) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const scaleX = GAME_CONSTANTS.VIEWPORT_WIDTH / rect.width
  const scaleY = GAME_CONSTANTS.VIEWPORT_HEIGHT / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY
  
  const worldX = x + camera.x
  const worldY = y + camera.y
  
  const cellX = Math.floor(worldX / GAME_CONSTANTS.CELL_SIZE)
  const cellY = Math.floor(worldY / GAME_CONSTANTS.CELL_SIZE)
  
  if (!grid[cellY]?.[cellX]) return
  const cell = grid[cellY][cellX]
  
  // Countdown phase: select room
  if (gamePhase.value === 'countdown' && humanPlayer.value) {
    if (cell.type === 'room' && cell.roomId !== undefined) {
      const room = rooms[cell.roomId]
      if (room && room.ownerId === null) {
        humanPlayer.value.roomId = room.id
        room.ownerId = humanPlayer.value.id
        humanPlayer.value.targetPosition = { x: room.centerX, y: room.centerY }
        humanPlayer.value.path = findPath(grid, humanPlayer.value.position, humanPlayer.value.targetPosition, GAME_CONSTANTS.CELL_SIZE)
        humanPlayer.value.state = 'walking'
        playSfx('click')
        addMessage(`Bạn chọn phòng ${room.id} (${room.roomType})`)
      }
    }
    return
  }
  
  // Playing phase
  if (gamePhase.value === 'playing' && humanPlayer.value.alive && !humanPlayer.value.isSleeping) {
    // Check if clicking on bed in own room
    if (humanPlayer.value.roomId !== null) {
      const myRoom = rooms[humanPlayer.value.roomId]
      if (!myRoom) return
      const distToBed = distance({ x: worldX, y: worldY }, myRoom.bedPosition)
      if (distToBed < 40) {
        // Check if player is near bed
        const playerDistToBed = distance(humanPlayer.value.position, myRoom.bedPosition)
        if (playerDistToBed < GAME_CONSTANTS.BED_INTERACT_RANGE) {
          humanPlayer.value.isSleeping = true
          humanPlayer.value.state = 'sleeping'
          playSfx('click')
          addMessage('Bạn bắt đầu ngủ và kiếm vàng!')
          return
        } else {
          // Move to bed
          humanPlayer.value.targetPosition = { ...myRoom.bedPosition }
          humanPlayer.value.path = findPath(grid, humanPlayer.value.position, humanPlayer.value.targetPosition, GAME_CONSTANTS.CELL_SIZE)
          humanPlayer.value.state = 'walking'
          return
        }
      }
      
      // Check if clicking on build spot in room
      for (const spot of myRoom.buildSpots) {
        if (!spot) continue
        const distToSpot = distance({ x: worldX, y: worldY }, spot)
        if (distToSpot < 30) {
          // Check if spot already has building
          const existingBuilding = buildings.find(b => 
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
    
    // Move player
    if (cell.walkable) {
      humanPlayer.value.targetPosition = { x: worldX, y: worldY }
      humanPlayer.value.path = findPath(grid, humanPlayer.value.position, humanPlayer.value.targetPosition, GAME_CONSTANTS.CELL_SIZE)
      humanPlayer.value.state = 'walking'
    }
  }
}

// Wake up from sleep
const wakeUp = () => {
  if (humanPlayer.value && humanPlayer.value.isSleeping) {
    humanPlayer.value.isSleeping = false
    humanPlayer.value.state = 'idle'
    addMessage('Bạn thức dậy!')
  }
}

// Build defense (only in rooms)
const buildDefense = (type: DefenseBuilding['type']) => {
  if (!selectedBuildSpot.value || !humanPlayer.value) return
  
  const cost = GAME_CONSTANTS.COSTS[type]
  if (humanPlayer.value.gold < cost) {
    addMessage('Không đủ vàng!')
    return
  }
  
  const stats = GAME_CONSTANTS.BUILDINGS[type]
  const { x, y, roomId } = selectedBuildSpot.value
  
  humanPlayer.value.gold -= cost
  
  const building: DefenseBuilding = {
    id: buildings.length,
    type,
    gridX: x,
    gridY: y,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    range: stats.range,
    cooldown: stats.cooldown,
    currentCooldown: 0,
    ownerId: humanPlayer.value.id,
    animationFrame: 0,
    rotation: 0
  }
  
  buildings.push(building)
  
  playSfx('build')
  spawnParticles(gridToWorld({ x, y }, GAME_CONSTANTS.CELL_SIZE), 'build', 12, '#22c55e')
  addMessage(`Xây ${type} trong phòng ${roomId}`)
  
  showBuildPopup.value = false
  selectedBuildSpot.value = null
}

// Upgrade bed
const upgradeBed = () => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null) return
  const room = rooms[humanPlayer.value.roomId]
  if (!room) return
  
  if (humanPlayer.value.gold < GAME_CONSTANTS.COSTS.upgradeBed) {
    addMessage('Không đủ vàng!')
    return
  }
  
  humanPlayer.value.gold -= GAME_CONSTANTS.COSTS.upgradeBed
  room.bedLevel++
  playSfx('build')
  addMessage(`Nâng cấp giường lên Lv${room.bedLevel}`)
}

// Repair door
const repairDoor = () => {
  if (!humanPlayer.value || humanPlayer.value.roomId === null) return
  const room = rooms[humanPlayer.value.roomId]
  if (!room) return
  
  if (humanPlayer.value.gold < GAME_CONSTANTS.COSTS.repairDoor) {
    addMessage('Không đủ vàng!')
    return
  }
  
  humanPlayer.value.gold -= GAME_CONSTANTS.COSTS.repairDoor
  room.doorHp = Math.min(room.doorHp + 40, room.doorMaxHp)
  playSfx('build')
  addMessage('Sửa cửa +40 HP')
}

// AI select room
const aiSelectRooms = () => {
  const aiPlayers = players.filter(p => !p.isHuman && p.roomId === null)
  const availableRooms = rooms.filter(r => r.ownerId === null)
  
  aiPlayers.forEach(ai => {
    if (availableRooms.length === 0) return
    const roomIndex = Math.floor(Math.random() * availableRooms.length)
    const room = availableRooms.splice(roomIndex, 1)[0]
    if (!room) return
    
    ai.roomId = room.id
    room.ownerId = ai.id
    ai.targetPosition = { x: room.centerX, y: room.centerY }
    ai.path = findPath(grid, ai.position, ai.targetPosition, GAME_CONSTANTS.CELL_SIZE)
    ai.state = 'walking'
  })
}

// Monster AI - only attack rooms with players
const updateMonsterAI = (deltaTime: number) => {
  // Retreat to heal when low HP
  if (monster.hp / monster.maxHp < GAME_CONSTANTS.MONSTER_HEAL_THRESHOLD) {
    if (!monster.isRetreating) {
      monster.isRetreating = true
      monster.targetPosition = { ...monster.healZone }
      monster.path = findPath(grid, monster.position, monster.targetPosition, GAME_CONSTANTS.CELL_SIZE)
      monster.state = 'walking'
      monster.targetRoomId = null
      addMessage('Quái vật rút lui hồi máu!')
    }
    
    if (distance(monster.position, monster.healZone) < 60) {
      monster.state = 'healing'
      monster.hp = Math.min(monster.hp + GAME_CONSTANTS.MONSTER_HEAL_RATE * deltaTime, monster.maxHp)
      spawnParticles(monster.position, 'heal', 1, '#22c55e')
      
      if (monster.hp >= monster.maxHp * 0.8) {
        monster.isRetreating = false
        addMessage('Quái vật đã hồi phục!')
      }
    }
    return
  }
  
  monster.isRetreating = false
  
  // Find target room with players
  if (monster.targetRoomId === null || Math.random() < 0.005) {
    const occupiedRooms = rooms.filter(r => {
      const playersInRoom = getPlayersInRoom(r.id)
      return playersInRoom.length > 0 && r.doorHp > 0
    })
    
    if (occupiedRooms.length > 0) {
      // Target room with weakest door
      const target = occupiedRooms.reduce((a, b) => a.doorHp < b.doorHp ? a : b)
      monster.targetRoomId = target.id
      
      // Move to door position (front of room)
      const doorX = target.gridX * GAME_CONSTANTS.CELL_SIZE
      const doorY = target.centerY
      monster.targetPosition = { x: doorX, y: doorY }
      monster.path = findPath(grid, monster.position, monster.targetPosition, GAME_CONSTANTS.CELL_SIZE)
      monster.state = 'walking'
    }
  }
  
  // Attack door if at target room
  if (monster.targetRoomId !== null) {
    const targetRoom = rooms[monster.targetRoomId]
    if (!targetRoom) {
      monster.targetRoomId = null
      return
    }
    const doorPos = { x: targetRoom.gridX * GAME_CONSTANTS.CELL_SIZE, y: targetRoom.centerY }
    const distToDoor = distance(monster.position, doorPos)
    
    if (distToDoor < 100) {
      // Check if door is still up
      if (targetRoom.doorHp > 0) {
        monster.state = 'attacking'
        monster.attackCooldown -= deltaTime
        
        if (monster.attackCooldown <= 0) {
          targetRoom.doorHp -= monster.damage
          monster.attackCooldown = GAME_CONSTANTS.ATTACK_COOLDOWN
          playSfx('hit')
          spawnParticles(doorPos, 'spark', 8, '#fbbf24')
          
          if (targetRoom.doorHp <= 0) {
            targetRoom.doorHp = 0
            addMessage(`Cửa phòng ${targetRoom.id} bị phá!`)
          }
        }
      } else {
        // Door is broken, enter room and attack players
        const playersInRoom = getPlayersInRoom(targetRoom.id)
        if (playersInRoom.length > 0) {
          const targetPlayer = playersInRoom[0]
          if (!targetPlayer) {
            monster.targetRoomId = null
            return
          }
          const distToPlayer = distance(monster.position, targetPlayer.position)
          
          if (distToPlayer < GAME_CONSTANTS.MONSTER_ATTACK_RANGE) {
            monster.state = 'attacking'
            monster.attackCooldown -= deltaTime
            
            if (monster.attackCooldown <= 0) {
              targetPlayer.hp -= monster.damage
              monster.attackCooldown = GAME_CONSTANTS.ATTACK_COOLDOWN
              playSfx('hit')
              spawnParticles(targetPlayer.position, 'blood', 10, '#ef4444')
              
              if (targetPlayer.hp <= 0) {
                targetPlayer.hp = 0
                targetPlayer.alive = false
                targetPlayer.state = 'dying'
                addMessage(`${targetPlayer.name} đã chết!`)
                
                if (targetPlayer.isHuman) endGame(false)
              }
            }
          } else {
            // Move towards player
            monster.targetPosition = { ...targetPlayer.position }
            monster.path = findPath(grid, monster.position, monster.targetPosition, GAME_CONSTANTS.CELL_SIZE)
            monster.state = 'walking'
          }
        } else {
          // No players in room, find new target
          monster.targetRoomId = null
        }
      }
      return
    }
  }
  
  if (monster.path.length > 0) monster.state = 'walking'
}

// Player AI with smoother behavior
const updatePlayerAI = (player: Player, deltaTime: number) => {
  if (!player.alive || player.isHuman) return
  
  const myRoom = player.roomId !== null ? rooms[player.roomId] : null
  
  // Generate gold while sleeping
  if (player.isSleeping && myRoom) {
    const goldRate = GAME_CONSTANTS.BED_GOLD_BASE + (myRoom.bedLevel - 1) * GAME_CONSTANTS.BED_GOLD_PER_LEVEL
    player.gold += goldRate * deltaTime
  }
  
  // AI decision making
  if (player.state === 'idle' && Math.random() < 0.03) {
    if (myRoom) {
      // Check if should sleep
      if (!player.isSleeping && Math.random() < 0.3) {
        const distToBed = distance(player.position, myRoom.bedPosition)
        if (distToBed < GAME_CONSTANTS.BED_INTERACT_RANGE) {
          player.isSleeping = true
          player.state = 'sleeping'
        } else {
          player.targetPosition = { ...myRoom.bedPosition }
          player.path = findPath(grid, player.position, player.targetPosition, GAME_CONSTANTS.CELL_SIZE)
          player.state = 'walking'
        }
        return
      }
      
      // Wake up occasionally to build/repair
      if (player.isSleeping && Math.random() < 0.01) {
        player.isSleeping = false
        player.state = 'idle'
      }
      
      // Repair door if needed
      if (!player.isSleeping && myRoom.doorHp < myRoom.doorMaxHp * 0.4 && player.gold >= GAME_CONSTANTS.COSTS.repairDoor) {
        player.gold -= GAME_CONSTANTS.COSTS.repairDoor
        myRoom.doorHp = Math.min(myRoom.doorHp + 40, myRoom.doorMaxHp)
      }
      
      // Build turret in room
      if (!player.isSleeping && player.gold >= GAME_CONSTANTS.COSTS.turret && Math.random() < 0.2) {
        const emptySpot = myRoom.buildSpots.find(spot => {
          return !buildings.some(b => {
            const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, GAME_CONSTANTS.CELL_SIZE)
            return distance(bPos, spot) < 30
          })
        })
        
        if (emptySpot) {
          player.gold -= GAME_CONSTANTS.COSTS.turret
          const stats = GAME_CONSTANTS.BUILDINGS.turret
          buildings.push({
            id: buildings.length,
            type: 'turret',
            gridX: Math.floor(emptySpot.x / GAME_CONSTANTS.CELL_SIZE),
            gridY: Math.floor(emptySpot.y / GAME_CONSTANTS.CELL_SIZE),
            hp: stats.hp,
            maxHp: stats.hp,
            damage: stats.damage,
            range: stats.range,
            cooldown: stats.cooldown,
            currentCooldown: 0,
            ownerId: player.id,
            animationFrame: 0,
            rotation: 0
          })
        }
      }
    }
  }
  
  // Attack monster if in same room and awake
  if (!player.isSleeping && player.alive) {
    const distToMonster = distance(player.position, monster.position)
    if (distToMonster < player.attackRange) {
      player.state = 'attacking'
      player.attackCooldown -= deltaTime
      
      if (player.attackCooldown <= 0) {
        monster.hp -= player.damage
        player.attackCooldown = GAME_CONSTANTS.ATTACK_COOLDOWN
        spawnParticles(monster.position, 'blood', 5, '#a855f7')
        if (monster.hp <= 0) endGame(true)
      }
    }
  }
}

// Update buildings
const updateBuildings = (deltaTime: number) => {
  buildings.forEach(building => {
    if (building.hp <= 0) return
    if (building.type !== 'turret' && building.type !== 'cannon') return
    
    building.currentCooldown -= deltaTime
    building.animationFrame += deltaTime * 8
    
    const buildingPos = gridToWorld({ x: building.gridX, y: building.gridY }, GAME_CONSTANTS.CELL_SIZE)
    const distToMonster = distance(buildingPos, monster.position)
    
    if (distToMonster < building.range && monster.hp > 0) {
      const dx = monster.position.x - buildingPos.x
      const dy = monster.position.y - buildingPos.y
      building.rotation = Math.atan2(dy, dx)
      
      if (building.currentCooldown <= 0) {
        projectiles.push({
          position: { ...buildingPos },
          target: { ...monster.position },
          speed: 500,
          damage: building.damage,
          ownerId: building.ownerId,
          color: building.type === 'cannon' ? '#fbbf24' : '#3b82f6',
          size: building.type === 'cannon' ? 10 : 5
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
    const moved = moveTowards(proj.position, proj.target, proj.speed, deltaTime)
    proj.position.x = moved.x
    proj.position.y = moved.y
    
    if (distance(proj.position, monster.position) < 40) {
      monster.hp -= proj.damage
      spawnParticles(proj.position, 'explosion', 8, proj.color)
      projectiles.splice(i, 1)
      if (monster.hp <= 0) endGame(true)
      continue
    }
    
    if (distance(proj.position, proj.target) < 10) projectiles.splice(i, 1)
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

// Camera follow human player
const updateCamera = () => {
  if (!humanPlayer.value) return
  
  const targetX = humanPlayer.value.smoothX - GAME_CONSTANTS.VIEWPORT_WIDTH / 2
  const targetY = humanPlayer.value.smoothY - GAME_CONSTANTS.VIEWPORT_HEIGHT / 2
  
  camera.x += (targetX - camera.x) * 0.05
  camera.y += (targetY - camera.y) * 0.05
  
  camera.x = Math.max(0, Math.min(GAME_CONSTANTS.WORLD_WIDTH - GAME_CONSTANTS.VIEWPORT_WIDTH, camera.x))
  camera.y = Math.max(0, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - GAME_CONSTANTS.VIEWPORT_HEIGHT, camera.y))
}

// Game loop
const gameLoop = (timestamp: number) => {
  const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1)
  lastTime = timestamp
  
  if (gamePhase.value === 'countdown') {
    countdown.value -= deltaTime
    if (countdown.value < GAME_CONSTANTS.COUNTDOWN_TIME - 2) aiSelectRooms()
    if (countdown.value <= 0) {
      gamePhase.value = 'playing'
      addMessage('🎮 Trò chơi bắt đầu!')
      playSfx('click')
    }
  }
  
  if (gamePhase.value === 'playing' || gamePhase.value === 'countdown') {
    players.forEach(player => {
      if (!player.alive) return
      
      // Gold from sleeping
      if (player.isSleeping && player.roomId !== null) {
        const room = rooms[player.roomId]
        if (room) {
          const goldRate = GAME_CONSTANTS.BED_GOLD_BASE + (room.bedLevel - 1) * GAME_CONSTANTS.BED_GOLD_PER_LEVEL
          player.gold += goldRate * deltaTime
        }
      }
      
      if (player.state === 'walking') moveAlongPath(player, deltaTime)
      smoothMove(player, deltaTime)
      
      if (!player.isHuman && gamePhase.value === 'playing') {
        updatePlayerAI(player, deltaTime)
      }
    })
    
    if (gamePhase.value === 'playing') {
      if (monster.state === 'walking') moveAlongPath(monster, deltaTime)
      updateMonsterAI(deltaTime)
      updateBuildings(deltaTime)
      updateProjectiles(deltaTime)
    }
    
    updateParticles(deltaTime)
    updateCamera()
  }
  
  render()
  if (!gameOver.value) animationId = requestAnimationFrame(gameLoop)
}

// Render
const render = () => {
  if (!ctx || !canvasRef.value) return
  
  const canvas = canvasRef.value
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
      if (px + cellSize < camera.x || px > camera.x + GAME_CONSTANTS.VIEWPORT_WIDTH) continue
      if (py + cellSize < camera.y || py > camera.y + GAME_CONSTANTS.VIEWPORT_HEIGHT) continue
      
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 1
      
      switch (cell.type) {
        case 'corridor':
          ctx.fillStyle = '#1a1a2e'
          break
        case 'room':
          const room = cell.roomId !== undefined ? rooms[cell.roomId] : null
          const colors: Record<string, string> = { 
            normal: '#2a2a3e', 
            armory: '#3a2a2a', 
            storage: '#2a3a2a', 
            bunker: '#3a3a4a' 
          }
          ctx.fillStyle = room ? (colors[room.roomType] || '#2a2a3e') : '#2a2a3e'
          break
        case 'heal_zone':
          ctx.fillStyle = '#1a4a1a'
          break
        default:
          ctx.fillStyle = '#0f0f0f'
      }
      ctx.fillRect(px, py, cellSize, cellSize)
      ctx.strokeRect(px, py, cellSize, cellSize)
      
      // Heal zone glow
      if (cell.type === 'heal_zone') {
        ctx.fillStyle = `rgba(34, 197, 94, ${0.15 + Math.sin(Date.now() / 400) * 0.1})`
        ctx.fillRect(px, py, cellSize, cellSize)
      }
    }
  }
  
  // Draw rooms with details
  rooms.forEach(room => {
    if (!ctx) return
    const px = room.gridX * cellSize
    const py = room.gridY * cellSize
    const width = room.width * cellSize
    const height = room.height * cellSize
    
    // Room border
    ctx.strokeStyle = room.ownerId !== null ? players[room.ownerId]?.color || '#555' : '#333'
    ctx.lineWidth = 4
    ctx.strokeRect(px, py, width, height)
    
    // Door (left side of room)
    const doorHpPercent = room.doorHp / room.doorMaxHp
    ctx.fillStyle = doorHpPercent > 0.5 ? '#4a4a6a' : doorHpPercent > 0.2 ? '#6a5a3a' : '#6a3a3a'
    ctx.fillRect(px - 8, py + height/3, 16, height/3)
    
    // Door HP bar
    ctx.fillStyle = '#222'
    ctx.fillRect(px + 10, py - 20, width - 20, 12)
    ctx.fillStyle = doorHpPercent > 0.5 ? '#22c55e' : doorHpPercent > 0.2 ? '#eab308' : '#ef4444'
    ctx.fillRect(px + 10, py - 20, (width - 20) * doorHpPercent, 12)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.strokeRect(px + 10, py - 20, width - 20, 12)
    
    // Room type icon
    const icons: Record<string, string> = { normal: '🏠', armory: '⚔️', storage: '📦', bunker: '🛡️' }
    ctx.font = '24px Arial'
    ctx.fillText(icons[room.roomType] || '🏠', px + 15, py + 35)
    
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
    
    // Build spots
    room.buildSpots.forEach(spot => {
      if (!ctx) return
      const hasBuilding = buildings.some(b => {
        const bPos = gridToWorld({ x: b.gridX, y: b.gridY }, cellSize)
        return distance(bPos, spot) < 30
      })
      if (!hasBuilding) {
        ctx.strokeStyle = '#3a5a3a'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(spot.x - 20, spot.y - 20, 40, 40)
        ctx.setLineDash([])
      }
    })
  })
  
  // Draw buildings
  buildings.forEach(building => {
    if (!ctx || building.hp <= 0) return
    const pos = gridToWorld({ x: building.gridX, y: building.gridY }, cellSize)
    
    ctx.save()
    ctx.translate(pos.x, pos.y)
    
    if (building.type === 'turret' || building.type === 'cannon') {
      ctx.rotate(building.rotation)
    }
    
    const colors: Record<string, string> = { 
      turret: '#3b82f6', 
      cannon: '#f59e0b', 
      trap: '#ef4444', 
      barrier: '#6b7280' 
    }
    ctx.fillStyle = colors[building.type] || '#888'
    
    if (building.type === 'turret') {
      ctx.fillRect(-18, -10, 36, 20)
      ctx.fillStyle = '#1e40af'
      ctx.fillRect(12, -6, 18, 12)
    } else if (building.type === 'cannon') {
      ctx.fillRect(-24, -14, 48, 28)
      ctx.fillStyle = '#b45309'
      ctx.fillRect(18, -8, 24, 16)
    } else if (building.type === 'barrier') {
      ctx.fillRect(-30, -12, 60, 24)
    } else if (building.type === 'trap') {
      ctx.beginPath()
      ctx.moveTo(-24, 14)
      ctx.lineTo(0, -18)
      ctx.lineTo(24, 14)
      ctx.closePath()
      ctx.fill()
    }
    
    ctx.restore()
    
    // Building HP bar
    const hpPercent = building.hp / building.maxHp
    ctx.fillStyle = '#222'
    ctx.fillRect(pos.x - 18, pos.y - 28, 36, 6)
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(pos.x - 18, pos.y - 28, 36 * hpPercent, 6)
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
    
    ctx.fillStyle = '#fff'
    ctx.font = '12px Arial'
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
  
  if (ctx) ctx.restore()
  
  // Countdown overlay
  if (ctx && gamePhase.value === 'countdown') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 96px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(Math.ceil(countdown.value).toString(), canvas.width / 2, canvas.height / 2)
    
    ctx.fillStyle = '#fff'
    ctx.font = '28px Arial'
    ctx.fillText('Chọn phòng của bạn!', canvas.width / 2, canvas.height / 2 + 60)
    ctx.font = '18px Arial'
    ctx.fillStyle = '#aaa'
    ctx.fillText('Click vào phòng trống • Chuột phải để kéo bản đồ', canvas.width / 2, canvas.height / 2 + 95)
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
  buildings.length = 0
  particles.length = 0
  projectiles.length = 0
  messageLog.value = []
  
  gamePhase.value = 'countdown'
  countdown.value = GAME_CONSTANTS.COUNTDOWN_TIME
  gameOver.value = false
  victory.value = false
  
  initGrid()
  initRooms()
  initPlayers()
  
  monster.hp = GAME_CONSTANTS.MONSTER_MAX_HP
  monster.maxHp = GAME_CONSTANTS.MONSTER_MAX_HP
  monster.position = { x: 21 * GAME_CONSTANTS.CELL_SIZE, y: 2 * GAME_CONSTANTS.CELL_SIZE }
  monster.path = []
  monster.state = 'idle'
  monster.isRetreating = false
  monster.targetRoomId = null
  
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
  
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  stopBgm()
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div class="relative flex h-screen flex-col bg-neutral-950 text-white overflow-hidden">
    <!-- Top Bar -->
    <div class="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-2 z-20">
      <button class="text-neutral-400 hover:text-white transition" @click="backToHome">← Trang chủ</button>
      
      <div class="flex items-center gap-4">
        <div class="rounded-lg bg-neutral-800 px-4 py-1.5 text-sm">
          ⏱️ <span class="font-bold" :class="gamePhase === 'countdown' ? 'text-amber-400' : 'text-green-400'">
            {{ gamePhase === 'countdown' ? Math.ceil(countdown) + 's' : 'Đang chơi' }}
          </span>
        </div>
        <div class="rounded-lg bg-red-900/50 px-4 py-1.5 text-sm">
          👹 <span class="font-bold text-red-400">{{ Math.floor(monster.hp) }}/{{ monster.maxHp }}</span>
        </div>
      </div>
      
      <div class="flex items-center gap-4 text-sm">
        <span class="text-amber-400 font-bold">💰 {{ Math.floor(humanPlayer?.gold || 0) }}</span>
        <span class="text-red-400">❤️ {{ humanPlayer?.hp || 0 }}/{{ humanPlayer?.maxHp || 100 }}</span>
        <span v-if="humanPlayer?.isSleeping" class="text-blue-400">💤 Đang ngủ</span>
      </div>
    </div>

    <!-- Canvas Container -->
    <div 
      ref="containerRef"
      class="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
      @contextmenu.prevent
    >
      <canvas 
        ref="canvasRef" 
        :width="GAME_CONSTANTS.VIEWPORT_WIDTH" 
        :height="GAME_CONSTANTS.VIEWPORT_HEIGHT" 
        class="w-full h-full"
        @click="handleCanvasClick"
        @mousedown="handleMouseDown"
      ></canvas>
    </div>

    <!-- Bottom HUD -->
    <div class="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
      <!-- Controls -->
      <div class="rounded-lg border border-neutral-800 bg-neutral-900/95 p-3 text-xs">
        <p class="text-neutral-400 mb-1">🖱️ Click: Di chuyển / Chọn</p>
        <p class="text-neutral-400 mb-1">🖱️ Chuột phải: Kéo bản đồ</p>
        <p class="text-neutral-400">🛏️ Click giường: Ngủ kiếm vàng</p>
      </div>
      
      <!-- Sleep controls -->
      <div v-if="humanPlayer?.isSleeping && gamePhase === 'playing'" class="rounded-lg border border-blue-800 bg-blue-950/95 p-3">
        <p class="text-blue-300 text-sm mb-2">💤 Đang ngủ...</p>
        <div class="flex flex-col gap-2">
          <button 
            class="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-sm font-medium"
            @click="wakeUp"
          >
            ☀️ Thức dậy
          </button>
          <button 
            class="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs"
            :disabled="(humanPlayer?.gold || 0) < GAME_CONSTANTS.COSTS.upgradeBed"
            :class="{ 'opacity-50': (humanPlayer?.gold || 0) < GAME_CONSTANTS.COSTS.upgradeBed }"
            @click="upgradeBed"
          >
            ⬆️ Nâng giường ({{ GAME_CONSTANTS.COSTS.upgradeBed }}g)
          </button>
          <button 
            class="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs"
            :disabled="(humanPlayer?.gold || 0) < GAME_CONSTANTS.COSTS.repairDoor"
            :class="{ 'opacity-50': (humanPlayer?.gold || 0) < GAME_CONSTANTS.COSTS.repairDoor }"
            @click="repairDoor"
          >
            🔧 Sửa cửa ({{ GAME_CONSTANTS.COSTS.repairDoor }}g)
          </button>
        </div>
      </div>
    </div>

    <!-- Message Log -->
    <div class="absolute bottom-4 right-4 w-80 max-h-52 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900/95 p-3 text-xs z-10">
      <div v-for="(msg, i) in messageLog.slice(0, 10)" :key="i" class="text-neutral-400 mb-1">{{ msg }}</div>
    </div>

    <!-- Build Popup -->
    <Transition name="popup">
      <div v-if="showBuildPopup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" @click.self="showBuildPopup = false">
        <div class="relative w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
          <button class="absolute right-4 top-4 text-2xl text-neutral-500 hover:text-white" @click="showBuildPopup = false">✕</button>
          <h2 class="mb-4 text-center font-bold text-xl text-amber-400">🏗️ Xây phòng thủ</h2>
          <p class="text-center text-sm text-neutral-400 mb-4">Xây trong phòng của bạn</p>
          <div class="grid grid-cols-2 gap-3">
            <button v-for="type in (['turret', 'cannon', 'trap', 'barrier'] as const)" :key="type"
              class="rounded-xl border border-neutral-700 bg-neutral-800 p-4 text-center transition hover:border-amber-600 hover:bg-neutral-750"
              :class="{ 'opacity-50 cursor-not-allowed': (humanPlayer?.gold || 0) < GAME_CONSTANTS.COSTS[type] }"
              :disabled="(humanPlayer?.gold || 0) < GAME_CONSTANTS.COSTS[type]"
              @click="buildDefense(type)">
              <div class="text-3xl mb-2">{{ type === 'turret' ? '🔫' : type === 'cannon' ? '💣' : type === 'trap' ? '⚡' : '🧱' }}</div>
              <div class="font-bold capitalize">{{ type }}</div>
              <div class="text-sm text-amber-400">{{ GAME_CONSTANTS.COSTS[type] }} vàng</div>
              <div class="text-xs text-neutral-500 mt-1">
                {{ type === 'turret' ? 'Bắn tự động' : type === 'cannon' ? 'Sát thương cao' : type === 'trap' ? 'Bẫy khu vực' : 'Rào chắn' }}
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Game Over -->
    <Transition name="popup">
      <div v-if="gameOver" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div class="w-full max-w-sm rounded-2xl border-2 p-8 text-center shadow-2xl"
          :class="victory ? 'border-amber-500 bg-gradient-to-b from-amber-950 to-neutral-900' : 'border-red-500 bg-gradient-to-b from-red-950 to-neutral-900'">
          <div class="text-7xl mb-4">{{ victory ? '🏆' : '💀' }}</div>
          <h2 class="text-4xl font-bold" :class="victory ? 'text-amber-400' : 'text-red-400'">
            {{ victory ? 'Chiến thắng!' : 'Thất bại!' }}
          </h2>
          <p class="mt-3 text-neutral-400">
            {{ victory ? 'Quái vật đã bị tiêu diệt!' : 'Bạn đã bị quái vật giết!' }}
          </p>
          <div class="mt-8 flex flex-col gap-3">
            <button class="rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-3 font-bold text-white text-lg" @click="restartGame">
              🔄 Chơi lại
            </button>
            <button class="rounded-xl border border-neutral-600 py-3 font-medium text-neutral-300" @click="backToHome">
              🏠 Trang chủ
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
canvas {
  image-rendering: auto;
}
.popup-enter-active, .popup-leave-active { 
  transition: opacity 0.25s ease, transform 0.25s ease; 
}
.popup-enter-from, .popup-leave-to { 
  opacity: 0; 
  transform: scale(0.9); 
}
</style>
