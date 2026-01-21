/**
 * Room Shapes System
 * Defines various room shapes: Rectangle, L-shape, U-shape, T-shape
 * Each shape is defined by relative cell positions from top-left corner
 */

import type { Vector2 } from '../../../types/game'

// =============================================================================
// ROOM SHAPE TYPES
// =============================================================================
export type RoomShapeType = 'rectangle' | 'l_shape' | 'u_shape' | 't_shape'

// =============================================================================
// ROOM SHAPE DEFINITION
// =============================================================================
export interface RoomShapeDefinition {
  type: RoomShapeType
  name: string
  // Bounding box size (for collision detection)
  boundingWidth: number
  boundingHeight: number
  // Cells that make up the room (relative to top-left of bounding box)
  // Each cell is {x, y} where x,y are grid offsets
  cells: Vector2[]
  // Interior cells (walkable, not walls)
  interiorCells: Vector2[]
  // Door position (relative)
  doorCell: Vector2
  // Best bed position (relative, inside interior)
  bedCell: Vector2
  // Build spots (relative, inside interior, excluding bed)
  buildSpots: Vector2[]
}

// =============================================================================
// HELPER: Generate cells for a shape
// =============================================================================
const generateRectangleCells = (width: number, height: number): Vector2[] => {
  const cells: Vector2[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y })
    }
  }
  return cells
}

/**
 * Generate interior cells - cells that have neighbors on all 4 sides within the shape
 * For complex shapes (L, U, T), we need to ensure proper interior detection
 */
const generateInteriorCells = (cells: Vector2[]): Vector2[] => {
  // Interior = cells that have neighbors on all 4 sides within the shape
  return cells.filter(cell => {
    const hasTop = cells.some(c => c.x === cell.x && c.y === cell.y - 1)
    const hasBottom = cells.some(c => c.x === cell.x && c.y === cell.y + 1)
    const hasLeft = cells.some(c => c.x === cell.x - 1 && c.y === cell.y)
    const hasRight = cells.some(c => c.x === cell.x + 1 && c.y === cell.y)
    return hasTop && hasBottom && hasLeft && hasRight
  })
}

/**
 * Get wall cells - cells that are part of the shape but NOT interior
 * These are edge cells that form the boundary of the room
 */
const getWallCells = (cells: Vector2[], interiorCells: Vector2[]): Vector2[] => {
  return cells.filter(cell => 
    !interiorCells.some(ic => ic.x === cell.x && ic.y === cell.y)
  )
}

/**
 * Find best door position - must be a wall cell with an interior neighbor
 */
const findBestDoorPosition = (cells: Vector2[], interiorCells: Vector2[]): Vector2 => {
  const wallCells = getWallCells(cells, interiorCells)
  
  // Door candidates = wall cells that have at least one interior neighbor
  const candidates = wallCells.filter(cell => {
    const hasInteriorNeighbor = interiorCells.some(ic => 
      (Math.abs(ic.x - cell.x) === 1 && ic.y === cell.y) ||
      (Math.abs(ic.y - cell.y) === 1 && ic.x === cell.x)
    )
    return hasInteriorNeighbor
  })
  
  if (candidates.length === 0) {
    // Fallback: return any wall cell
    return wallCells[0] || cells[0] || { x: 0, y: 0 }
  }
  
  // Sort by preference: bottom > right > top > left
  candidates.sort((a, b) => {
    const scoreA = a.y * 10 + a.x
    const scoreB = b.y * 10 + b.x
    return scoreB - scoreA
  })
  
  return candidates[0] || wallCells[0] || { x: 0, y: 0 }
}

const findBestBedPosition = (interiorCells: Vector2[]): Vector2 => {
  if (interiorCells.length === 0) return { x: 1, y: 1 }
  
  // Find the most central interior cell
  const avgX = interiorCells.reduce((sum, c) => sum + c.x, 0) / interiorCells.length
  const avgY = interiorCells.reduce((sum, c) => sum + c.y, 0) / interiorCells.length
  
  let bestCell = interiorCells[0]!
  let bestDist = Infinity
  
  for (const cell of interiorCells) {
    const dist = Math.abs(cell.x - avgX) + Math.abs(cell.y - avgY)
    if (dist < bestDist) {
      bestDist = dist
      bestCell = cell
    }
  }
  
  return bestCell
}

const generateBuildSpots = (interiorCells: Vector2[], bedCell: Vector2): Vector2[] => {
  return interiorCells.filter(cell => 
    cell.x !== bedCell.x || cell.y !== bedCell.y
  )
}

// =============================================================================
// RECTANGLE SHAPES (various sizes)
// =============================================================================
const createRectangleShape = (width: number, height: number, variant: number = 0): RoomShapeDefinition => {
  const cells = generateRectangleCells(width, height)
  const interiorCells = generateInteriorCells(cells)
  
  // Door positions based on variant
  let doorCell: Vector2
  switch (variant % 4) {
    case 0: // Bottom
      doorCell = { x: Math.floor(width / 2), y: height - 1 }
      break
    case 1: // Right
      doorCell = { x: width - 1, y: Math.floor(height / 2) }
      break
    case 2: // Top
      doorCell = { x: Math.floor(width / 2), y: 0 }
      break
    case 3: // Left
      doorCell = { x: 0, y: Math.floor(height / 2) }
      break
    default:
      doorCell = { x: Math.floor(width / 2), y: height - 1 }
  }
  
  const bedCell = findBestBedPosition(interiorCells)
  const buildSpots = generateBuildSpots(interiorCells, bedCell)
  
  return {
    type: 'rectangle',
    name: `Rectangle ${width}x${height}`,
    boundingWidth: width,
    boundingHeight: height,
    cells,
    interiorCells,
    doorCell,
    bedCell,
    buildSpots
  }
}

// =============================================================================
// L-SHAPE ROOMS (4 orientations)
// =============================================================================
const createLShapeRoom = (
  longArm: number, 
  shortArm: number, 
  thickness: number,
  orientation: 'bl' | 'br' | 'tl' | 'tr' // bottom-left, bottom-right, top-left, top-right corner
): RoomShapeDefinition => {
  const cells: Vector2[] = []
  
  // L-shape is made of two rectangles that form an L
  // orientation determines which corner has the L bend
  
  switch (orientation) {
    case 'bl': // └ shape - vertical arm goes up, horizontal arm goes right
      // Vertical arm (bottom to top on left side)
      for (let y = 0; y < longArm; y++) {
        for (let x = 0; x < thickness; x++) {
          cells.push({ x, y })
        }
      }
      // Horizontal arm (bottom, going right)
      for (let x = thickness; x < shortArm; x++) {
        for (let y = longArm - thickness; y < longArm; y++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'br': // ┘ shape - vertical arm goes up, horizontal arm goes left
      // Vertical arm (bottom to top on right side)
      for (let y = 0; y < longArm; y++) {
        for (let x = shortArm - thickness; x < shortArm; x++) {
          cells.push({ x, y })
        }
      }
      // Horizontal arm (bottom, going left)
      for (let x = 0; x < shortArm - thickness; x++) {
        for (let y = longArm - thickness; y < longArm; y++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'tl': // ┌ shape - vertical arm goes down, horizontal arm goes right
      // Vertical arm (top to bottom on left side)
      for (let y = 0; y < longArm; y++) {
        for (let x = 0; x < thickness; x++) {
          cells.push({ x, y })
        }
      }
      // Horizontal arm (top, going right)
      for (let x = thickness; x < shortArm; x++) {
        for (let y = 0; y < thickness; y++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'tr': // ┐ shape - vertical arm goes down, horizontal arm goes left
      // Vertical arm (top to bottom on right side)
      for (let y = 0; y < longArm; y++) {
        for (let x = shortArm - thickness; x < shortArm; x++) {
          cells.push({ x, y })
        }
      }
      // Horizontal arm (top, going left)
      for (let x = 0; x < shortArm - thickness; x++) {
        for (let y = 0; y < thickness; y++) {
          cells.push({ x, y })
        }
      }
      break
  }
  
  // Remove duplicates
  const uniqueCells = cells.filter((cell, index) => 
    cells.findIndex(c => c.x === cell.x && c.y === cell.y) === index
  )
  
  const boundingWidth = shortArm
  const boundingHeight = longArm
  const interiorCells = generateInteriorCells(uniqueCells)
  const doorCell = findBestDoorPosition(uniqueCells, interiorCells)
  const bedCell = findBestBedPosition(interiorCells)
  const buildSpots = generateBuildSpots(interiorCells, bedCell)
  
  return {
    type: 'l_shape',
    name: `L-Shape ${orientation.toUpperCase()}`,
    boundingWidth,
    boundingHeight,
    cells: uniqueCells,
    interiorCells,
    doorCell,
    bedCell,
    buildSpots
  }
}

// =============================================================================
// U-SHAPE ROOMS (4 orientations)
// =============================================================================
const createUShapeRoom = (
  width: number,
  height: number,
  thickness: number,
  opening: 'top' | 'bottom' | 'left' | 'right'
): RoomShapeDefinition => {
  const cells: Vector2[] = []
  
  switch (opening) {
    case 'top': // U opening at top
      // Left arm
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < thickness; x++) {
          cells.push({ x, y })
        }
      }
      // Right arm
      for (let y = 0; y < height; y++) {
        for (let x = width - thickness; x < width; x++) {
          cells.push({ x, y })
        }
      }
      // Bottom connecting piece
      for (let x = thickness; x < width - thickness; x++) {
        for (let y = height - thickness; y < height; y++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'bottom': // U opening at bottom
      // Left arm
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < thickness; x++) {
          cells.push({ x, y })
        }
      }
      // Right arm
      for (let y = 0; y < height; y++) {
        for (let x = width - thickness; x < width; x++) {
          cells.push({ x, y })
        }
      }
      // Top connecting piece
      for (let x = thickness; x < width - thickness; x++) {
        for (let y = 0; y < thickness; y++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'left': // U opening at left (rotated U)
      // Top arm
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < thickness; y++) {
          cells.push({ x, y })
        }
      }
      // Bottom arm
      for (let x = 0; x < width; x++) {
        for (let y = height - thickness; y < height; y++) {
          cells.push({ x, y })
        }
      }
      // Right connecting piece
      for (let y = thickness; y < height - thickness; y++) {
        for (let x = width - thickness; x < width; x++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'right': // U opening at right
      // Top arm
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < thickness; y++) {
          cells.push({ x, y })
        }
      }
      // Bottom arm
      for (let x = 0; x < width; x++) {
        for (let y = height - thickness; y < height; y++) {
          cells.push({ x, y })
        }
      }
      // Left connecting piece
      for (let y = thickness; y < height - thickness; y++) {
        for (let x = 0; x < thickness; x++) {
          cells.push({ x, y })
        }
      }
      break
  }
  
  // Remove duplicates
  const uniqueCells = cells.filter((cell, index) => 
    cells.findIndex(c => c.x === cell.x && c.y === cell.y) === index
  )
  
  const interiorCells = generateInteriorCells(uniqueCells)
  const doorCell = findBestDoorPosition(uniqueCells, interiorCells)
  const bedCell = findBestBedPosition(interiorCells)
  const buildSpots = generateBuildSpots(interiorCells, bedCell)
  
  return {
    type: 'u_shape',
    name: `U-Shape ${opening}`,
    boundingWidth: width,
    boundingHeight: height,
    cells: uniqueCells,
    interiorCells,
    doorCell,
    bedCell,
    buildSpots
  }
}

// =============================================================================
// T-SHAPE ROOMS (4 orientations)
// =============================================================================
const createTShapeRoom = (
  width: number,
  height: number,
  thickness: number,
  stemDirection: 'top' | 'bottom' | 'left' | 'right'
): RoomShapeDefinition => {
  const cells: Vector2[] = []
  
  switch (stemDirection) {
    case 'bottom': // T with stem going down (┬)
      // Top bar
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < thickness; y++) {
          cells.push({ x, y })
        }
      }
      // Stem going down from center
      const stemStartX = Math.floor((width - thickness) / 2)
      for (let y = thickness; y < height; y++) {
        for (let x = stemStartX; x < stemStartX + thickness; x++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'top': // T with stem going up (┴)
      // Bottom bar
      for (let x = 0; x < width; x++) {
        for (let y = height - thickness; y < height; y++) {
          cells.push({ x, y })
        }
      }
      // Stem going up from center
      const stemStartX2 = Math.floor((width - thickness) / 2)
      for (let y = 0; y < height - thickness; y++) {
        for (let x = stemStartX2; x < stemStartX2 + thickness; x++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'right': // T with stem going right (├)
      // Left bar (vertical)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < thickness; x++) {
          cells.push({ x, y })
        }
      }
      // Stem going right from center
      const stemStartY = Math.floor((height - thickness) / 2)
      for (let x = thickness; x < width; x++) {
        for (let y = stemStartY; y < stemStartY + thickness; y++) {
          cells.push({ x, y })
        }
      }
      break
      
    case 'left': // T with stem going left (┤)
      // Right bar (vertical)
      for (let y = 0; y < height; y++) {
        for (let x = width - thickness; x < width; x++) {
          cells.push({ x, y })
        }
      }
      // Stem going left from center
      const stemStartY2 = Math.floor((height - thickness) / 2)
      for (let x = 0; x < width - thickness; x++) {
        for (let y = stemStartY2; y < stemStartY2 + thickness; y++) {
          cells.push({ x, y })
        }
      }
      break
  }
  
  // Remove duplicates
  const uniqueCells = cells.filter((cell, index) => 
    cells.findIndex(c => c.x === cell.x && c.y === cell.y) === index
  )
  
  const interiorCells = generateInteriorCells(uniqueCells)
  const doorCell = findBestDoorPosition(uniqueCells, interiorCells)
  const bedCell = findBestBedPosition(interiorCells)
  const buildSpots = generateBuildSpots(interiorCells, bedCell)
  
  return {
    type: 't_shape',
    name: `T-Shape ${stemDirection}`,
    boundingWidth: width,
    boundingHeight: height,
    cells: uniqueCells,
    interiorCells,
    doorCell,
    bedCell,
    buildSpots
  }
}

// =============================================================================
// PREDEFINED ROOM SHAPES LIBRARY
// =============================================================================
export const ROOM_SHAPES: RoomShapeDefinition[] = [
  // Small rectangles (6x6 to 7x7)
  createRectangleShape(6, 6, 0),
  createRectangleShape(6, 7, 1),
  createRectangleShape(7, 6, 2),
  createRectangleShape(7, 7, 3),
  
  // Medium rectangles (8x8 to 9x9)
  createRectangleShape(8, 8, 0),
  createRectangleShape(8, 9, 1),
  createRectangleShape(9, 8, 2),
  createRectangleShape(9, 9, 3),
  
  // Large rectangles (10x10 to 11x11)
  createRectangleShape(10, 10, 0),
  createRectangleShape(10, 11, 1),
  createRectangleShape(11, 10, 2),
  
  // L-shapes (various sizes and orientations)
  createLShapeRoom(9, 7, 4, 'bl'),
  createLShapeRoom(9, 7, 4, 'br'),
  createLShapeRoom(9, 7, 4, 'tl'),
  createLShapeRoom(9, 7, 4, 'tr'),
  createLShapeRoom(10, 8, 4, 'bl'),
  createLShapeRoom(10, 8, 4, 'br'),
  createLShapeRoom(11, 8, 5, 'tl'),
  createLShapeRoom(11, 8, 5, 'tr'),
  
  // U-shapes (various sizes and orientations)
  createUShapeRoom(9, 7, 3, 'top'),
  createUShapeRoom(9, 7, 3, 'bottom'),
  createUShapeRoom(7, 9, 3, 'left'),
  createUShapeRoom(7, 9, 3, 'right'),
  createUShapeRoom(10, 8, 3, 'top'),
  createUShapeRoom(10, 8, 3, 'bottom'),
  
  // T-shapes (various sizes and orientations)
  createTShapeRoom(9, 9, 4, 'bottom'),
  createTShapeRoom(9, 9, 4, 'top'),
  createTShapeRoom(9, 9, 4, 'left'),
  createTShapeRoom(9, 9, 4, 'right'),
  createTShapeRoom(10, 10, 4, 'bottom'),
  createTShapeRoom(10, 10, 4, 'top'),
]

// =============================================================================
// GET RANDOM ROOM SHAPE
// =============================================================================
export const getRandomRoomShape = (): RoomShapeDefinition => {
  const index = Math.floor(Math.random() * ROOM_SHAPES.length)
  return ROOM_SHAPES[index]!
}

// =============================================================================
// CHECK IF SHAPE CELLS OVERLAP WITH EXISTING CELLS
// =============================================================================
export const doesShapeOverlap = (
  shape: RoomShapeDefinition,
  gridX: number,
  gridY: number,
  occupiedCells: Set<string>,
  gridCols: number,
  gridRows: number,
  margin: number
): boolean => {
  for (const cell of shape.cells) {
    const worldX = gridX + cell.x
    const worldY = gridY + cell.y
    
    // Check bounds with margin
    if (worldX < margin || worldX >= gridCols - margin) return true
    if (worldY < margin || worldY >= gridRows - margin) return true
    
    // Check if cell is occupied
    const key = `${worldX},${worldY}`
    if (occupiedCells.has(key)) return true
  }
  
  // Also check padding around the shape
  for (const cell of shape.cells) {
    const worldX = gridX + cell.x
    const worldY = gridY + cell.y
    
    // Check 1-cell padding around each cell
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const checkX = worldX + dx
        const checkY = worldY + dy
        
        // Only check padding cells that are not part of the shape
        const isPartOfShape = shape.cells.some(c => 
          gridX + c.x === checkX && gridY + c.y === checkY
        )
        if (!isPartOfShape) {
          const key = `${checkX},${checkY}`
          if (occupiedCells.has(key)) return true
        }
      }
    }
  }
  
  return false
}

// =============================================================================
// MARK SHAPE CELLS AS OCCUPIED
// =============================================================================
export const markShapeAsOccupied = (
  shape: RoomShapeDefinition,
  gridX: number,
  gridY: number,
  occupiedCells: Set<string>
): void => {
  for (const cell of shape.cells) {
    const worldX = gridX + cell.x
    const worldY = gridY + cell.y
    occupiedCells.add(`${worldX},${worldY}`)
  }
}

// =============================================================================
// EXPORT FACTORY FUNCTIONS FOR CUSTOM SHAPES
// =============================================================================
export {
  createRectangleShape,
  createLShapeRoom,
  createUShapeRoom,
  createTShapeRoom,
  generateInteriorCells,
  findBestDoorPosition,
  findBestBedPosition,
  generateBuildSpots
}
