/**
 * Camera System
 * Handles camera movement, drag controls, and viewport management
 */
import { reactive } from 'vue'
import type { Player, Vector2 } from '../../types/game'
import { GAME_CONSTANTS } from '../../types/game'

// =============================================================================
// CAMERA STATE
// =============================================================================
export interface CameraState {
  x: number
  y: number
  isManualMode: boolean
}

export const camera = reactive<CameraState>({
  x: 0,
  y: 0,
  isManualMode: false,
})

// Drag state
export const dragState = reactive({
  isMouseDown: false,
  isDragging: false,
  hasDragged: false,
  startX: 0,
  startY: 0,
  cameraStartX: 0,
  cameraStartY: 0,
})

// Touch state
export const touchState = reactive({
  isTouchDown: false,
  hasTouchDragged: false,
  startX: 0,
  startY: 0,
})

export const DRAG_THRESHOLD = 5

// =============================================================================
// MOUSE HANDLERS
// =============================================================================
export function handleMouseDown(
  e: MouseEvent,
  _viewportWidth?: number,
  _viewportHeight?: number
): void {
  if (e.button === 0) {
    dragState.isMouseDown = true
    dragState.hasDragged = false
    dragState.startX = e.clientX
    dragState.startY = e.clientY
    dragState.cameraStartX = camera.x
    dragState.cameraStartY = camera.y
  }
}

export function handleMouseMove(
  e: MouseEvent,
  viewportWidth: number,
  viewportHeight: number
): void {
  if (dragState.isMouseDown) {
    const dx = dragState.startX - e.clientX
    const dy = dragState.startY - e.clientY
    const dragDistance = Math.sqrt(dx * dx + dy * dy)
    
    if (dragDistance > DRAG_THRESHOLD) {
      dragState.hasDragged = true
      dragState.isDragging = true
      camera.isManualMode = true
      
      const pad = GAME_CONSTANTS.CAMERA_PADDING
      camera.x = Math.max(-pad, Math.min(
        GAME_CONSTANTS.WORLD_WIDTH - viewportWidth + pad,
        dragState.cameraStartX + dx
      ))
      camera.y = Math.max(-pad, Math.min(
        GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight + pad,
        dragState.cameraStartY + dy
      ))
    }
  }
}

export function handleMouseUp(): void {
  dragState.isMouseDown = false
  dragState.isDragging = false
}

// =============================================================================
// TOUCH HANDLERS
// =============================================================================
export function handleTouchStart(
  e: TouchEvent,
  _viewportWidth?: number,
  _viewportHeight?: number
): void {
  if (e.touches.length === 1 && e.touches[0]) {
    touchState.isTouchDown = true
    touchState.hasTouchDragged = false
    touchState.startX = e.touches[0].clientX
    touchState.startY = e.touches[0].clientY
    dragState.startX = e.touches[0].clientX
    dragState.startY = e.touches[0].clientY
    dragState.cameraStartX = camera.x
    dragState.cameraStartY = camera.y
  }
}

export function handleTouchMove(
  e: TouchEvent,
  viewportWidth: number,
  viewportHeight: number
): void {
  if (touchState.isTouchDown && e.touches.length === 1 && e.touches[0]) {
    const dx = touchState.startX - e.touches[0].clientX
    const dy = touchState.startY - e.touches[0].clientY
    const dragDistance = Math.sqrt(dx * dx + dy * dy)
    
    if (dragDistance > DRAG_THRESHOLD) {
      touchState.hasTouchDragged = true
      dragState.isDragging = true
      camera.isManualMode = true
      
      const pad = GAME_CONSTANTS.CAMERA_PADDING
      camera.x = Math.max(-pad, Math.min(
        GAME_CONSTANTS.WORLD_WIDTH - viewportWidth + pad,
        dragState.cameraStartX + dx
      ))
      camera.y = Math.max(-pad, Math.min(
        GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight + pad,
        dragState.cameraStartY + dy
      ))
    }
  }
}

export function handleTouchEnd(): { wasTap: boolean; x: number; y: number } {
  const wasTap = touchState.isTouchDown && !touchState.hasTouchDragged
  const result = {
    wasTap,
    x: touchState.startX,
    y: touchState.startY,
  }
  
  touchState.isTouchDown = false
  dragState.isDragging = false
  
  return result
}

// =============================================================================
// CAMERA UPDATE
// =============================================================================
export function updateCamera(
  player: Player | null,
  viewportWidth: number,
  viewportHeight: number
): void {
  if (!player) return
  
  // Auto-follow if not in manual mode
  if (!camera.isManualMode) {
    const targetX = player.smoothX - viewportWidth / 2
    const targetY = player.smoothY - viewportHeight / 2
    
    camera.x += (targetX - camera.x) * 0.05
    camera.y += (targetY - camera.y) * 0.05
  }
  
  // Clamp camera
  const pad = camera.isManualMode ? GAME_CONSTANTS.CAMERA_PADDING : 0
  camera.x = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_WIDTH - viewportWidth + pad, camera.x))
  camera.y = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight + pad, camera.y))
}

// =============================================================================
// CAMERA NAVIGATION
// =============================================================================
export function navigateToPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number
): void {
  camera.isManualMode = true
  const targetX = x - viewportWidth / 2
  const targetY = y - viewportHeight / 2
  
  const pad = GAME_CONSTANTS.CAMERA_PADDING
  camera.x = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_WIDTH - viewportWidth + pad, targetX))
  camera.y = Math.max(-pad, Math.min(GAME_CONSTANTS.WORLD_HEIGHT - viewportHeight + pad, targetY))
}

export function navigateToPlayer(
  player: Player,
  viewportWidth: number,
  viewportHeight: number
): void {
  navigateToPosition(player.smoothX, player.smoothY, viewportWidth, viewportHeight)
}

export function resetCameraToPlayer(): void {
  camera.isManualMode = false
}

// =============================================================================
// COORDINATE CONVERSION
// =============================================================================
export function screenToWorld(
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  viewportWidth: number,
  viewportHeight: number
): Vector2 {
  const scaleX = viewportWidth / canvasRect.width
  const scaleY = viewportHeight / canvasRect.height
  const x = (screenX - canvasRect.left) * scaleX
  const y = (screenY - canvasRect.top) * scaleY
  
  return {
    x: x + camera.x,
    y: y + camera.y,
  }
}
