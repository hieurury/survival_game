import type { Vector2, GridCell } from '../types/game'

interface PathNode {
  x: number
  y: number
  g: number // cost from start
  h: number // heuristic to end
  f: number // g + h
  parent: PathNode | null
}

// A* Pathfinding implementation
export function findPath(
  grid: GridCell[][],
  start: Vector2,
  end: Vector2,
  cellSize: number
): Vector2[] {
  const startCell = worldToGrid(start, cellSize)
  const endCell = worldToGrid(end, cellSize)
  
  // Check bounds
  if (!isValidCell(grid, startCell.x, startCell.y) || !isValidCell(grid, endCell.x, endCell.y)) {
    return []
  }
  
  // Check if end is walkable
  if (!grid[endCell.y]?.[endCell.x]?.walkable) {
    // Find nearest walkable cell
    const nearest = findNearestWalkable(grid, endCell)
    if (!nearest) return []
    endCell.x = nearest.x
    endCell.y = nearest.y
  }
  
  const openList: PathNode[] = []
  const closedSet = new Set<string>()
  
  const startNode: PathNode = {
    x: startCell.x,
    y: startCell.y,
    g: 0,
    h: heuristic(startCell, endCell),
    f: 0,
    parent: null
  }
  startNode.f = startNode.g + startNode.h
  openList.push(startNode)
  
  while (openList.length > 0) {
    // Get node with lowest f
    openList.sort((a, b) => a.f - b.f)
    const current = openList.shift()!
    
    // Reached goal
    if (current.x === endCell.x && current.y === endCell.y) {
      return reconstructPath(current, cellSize)
    }
    
    closedSet.add(`${current.x},${current.y}`)
    
    // Check neighbors (8 directions)
    const neighbors = getNeighbors(current.x, current.y)
    
    for (const [nx, ny] of neighbors) {
      if (!isValidCell(grid, nx, ny)) continue
      if (!grid[ny]?.[nx]?.walkable) continue
      if (closedSet.has(`${nx},${ny}`)) continue
      
      // Diagonal movement cost
      const isDiagonal = nx !== current.x && ny !== current.y
      const moveCost = isDiagonal ? 1.414 : 1
      
      const g = current.g + moveCost
      const h = heuristic({ x: nx, y: ny }, endCell)
      const f = g + h
      
      // Check if already in open list with better score
      const existing = openList.find(n => n.x === nx && n.y === ny)
      if (existing) {
        if (g < existing.g) {
          existing.g = g
          existing.f = f
          existing.parent = current
        }
        continue
      }
      
      openList.push({
        x: nx,
        y: ny,
        g,
        h,
        f,
        parent: current
      })
    }
  }
  
  return [] // No path found
}

function heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
  // Euclidean distance
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function getNeighbors(x: number, y: number): [number, number][] {
  return [
    [x - 1, y - 1], [x, y - 1], [x + 1, y - 1],
    [x - 1, y],                 [x + 1, y],
    [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]
  ]
}

function isValidCell(grid: GridCell[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < (grid[0]?.length ?? 0)
}

function reconstructPath(endNode: PathNode, cellSize: number): Vector2[] {
  const path: Vector2[] = []
  let current: PathNode | null = endNode
  
  while (current) {
    path.unshift(gridToWorld({ x: current.x, y: current.y }, cellSize))
    current = current.parent
  }
  
  return path
}

function findNearestWalkable(grid: GridCell[][], target: { x: number; y: number }): { x: number; y: number } | null {
  const maxRadius = 5
  
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = target.x + dx
        const ny = target.y + dy
        if (isValidCell(grid, nx, ny) && grid[ny]?.[nx]?.walkable) {
          return { x: nx, y: ny }
        }
      }
    }
  }
  
  return null
}

export function worldToGrid(pos: Vector2, cellSize: number): { x: number; y: number } {
  return {
    x: Math.floor(pos.x / cellSize),
    y: Math.floor(pos.y / cellSize)
  }
}

export function gridToWorld(cell: { x: number; y: number }, cellSize: number): Vector2 {
  return {
    x: cell.x * cellSize + cellSize / 2,
    y: cell.y * cellSize + cellSize / 2
  }
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export function moveTowards(current: Vector2, target: Vector2, speed: number, deltaTime: number): Vector2 {
  const dx = target.x - current.x
  const dy = target.y - current.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  
  if (dist <= speed * deltaTime) {
    return { x: target.x, y: target.y }
  }
  
  return {
    x: current.x + (dx / dist) * speed * deltaTime,
    y: current.y + (dy / dist) * speed * deltaTime
  }
}

export function normalizeVector(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}
