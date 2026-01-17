<script setup lang="ts">
/**
 * MiniMap Component
 * Shows a small overview of the entire map
 */
import { ref, computed, onMounted, watch } from 'vue'

interface Room {
  x: number
  y: number
  width: number
  height: number
  isBase: boolean
}

const props = defineProps<{
  gridWidth: number
  gridHeight: number
  cellSize: number
  rooms: Room[]
  cameraX: number
  cameraY: number
  viewportWidth: number
  viewportHeight: number
  playerPosition: { x: number; y: number }
  monsters: { position: { x: number; y: number } }[]
}>()

const emit = defineEmits<{
  navigate: [x: number, y: number]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const minimapWidth = 160
const minimapHeight = 120

const scale = computed(() => ({
  x: minimapWidth / (props.gridWidth * props.cellSize),
  y: minimapHeight / (props.gridHeight * props.cellSize),
}))

function drawMinimap() {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Clear
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, minimapWidth, minimapHeight)
  
  // Draw rooms
  for (const room of props.rooms) {
    const x = room.x * props.cellSize * scale.value.x
    const y = room.y * props.cellSize * scale.value.y
    const w = room.width * props.cellSize * scale.value.x
    const h = room.height * props.cellSize * scale.value.y
    
    ctx.fillStyle = room.isBase ? 'rgba(59, 130, 246, 0.5)' : 'rgba(75, 85, 99, 0.5)'
    ctx.fillRect(x, y, w, h)
  }
  
  // Draw monsters
  ctx.fillStyle = '#ef4444'
  for (const monster of props.monsters) {
    const x = monster.position.x * scale.value.x
    const y = monster.position.y * scale.value.y
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  
  // Draw player
  ctx.fillStyle = '#22c55e'
  const px = props.playerPosition.x * scale.value.x
  const py = props.playerPosition.y * scale.value.y
  ctx.beginPath()
  ctx.arc(px, py, 4, 0, Math.PI * 2)
  ctx.fill()
  
  // Draw viewport box
  const vx = props.cameraX * scale.value.x
  const vy = props.cameraY * scale.value.y
  const vw = props.viewportWidth * scale.value.x
  const vh = props.viewportHeight * scale.value.y
  
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.strokeRect(vx, vy, vw, vh)
}

function handleClick(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) / scale.value.x
  const y = (e.clientY - rect.top) / scale.value.y
  
  emit('navigate', x, y)
}

onMounted(() => {
  drawMinimap()
})

// Redraw on data changes
watch(
  () => [props.cameraX, props.cameraY, props.playerPosition, props.monsters.length],
  drawMinimap,
  { deep: true }
)
</script>

<template>
  <div class="minimap-container">
    <div class="minimap-header">🗺️ Bản đồ</div>
    <canvas
      ref="canvasRef"
      :width="minimapWidth"
      :height="minimapHeight"
      class="minimap-canvas"
      @click="handleClick"
    ></canvas>
    <div class="minimap-legend">
      <span class="legend-item player">● Bạn</span>
      <span class="legend-item monster">● Quái</span>
    </div>
  </div>
</template>

<style scoped>
.minimap-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 8px;
  z-index: 100;
}

.minimap-header {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  text-align: center;
}

.minimap-canvas {
  border-radius: 8px;
  cursor: pointer;
  display: block;
}

.minimap-legend {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 6px;
  font-size: 10px;
}

.legend-item {
  color: rgba(255, 255, 255, 0.6);
}

.legend-item.player {
  color: #22c55e;
}

.legend-item.monster {
  color: #ef4444;
}

/* Hide on small screens */
@media (max-width: 768px) {
  .minimap-container {
    display: none;
  }
}
</style>
