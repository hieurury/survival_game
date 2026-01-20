/**
 * StructureBase - Abstract base class for all resource-generating buildings
 * 
 * Structures are stationary buildings that generate resources over time.
 * Each structure has:
 * - HP and damage handling
 * - Resource generation rates
 * - Upgrade progression
 * - Owner association
 * 
 * @abstract
 */

import type { IUpgradeable } from '../base/Entity'

// =============================================================================
// STRUCTURE TYPE
// =============================================================================
export type StructureType = 'atm' | 'soul_collector' | 'generator' | 'storage'

// =============================================================================
// BASE STRUCTURE CONFIG
// =============================================================================
export interface StructureConfig {
  type: StructureType
  hp: number
  baseCost: number
  costCurrency: 'gold' | 'souls'
  upgradeCost: number
  upgradeCostScale: number
  maxLevel: number
}

// =============================================================================
// STRUCTURE STATE FOR SERIALIZATION
// =============================================================================
export interface StructureState {
  id: number
  type: StructureType
  level: number
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  ownerId: number
  animationFrame: number
  upgradeCost: number
  accumulatedResource: number
}

// =============================================================================
// STRUCTURE-SPECIFIC DAMAGEABLE INTERFACE
// =============================================================================
export interface IStructureDamageable {
  hp: number
  maxHp: number
  takeDamage(amount: number): void
  heal(amount: number): void
  isDead(): boolean
}

// =============================================================================
// ABSTRACT STRUCTURE BASE CLASS
// =============================================================================
export abstract class Structure implements IStructureDamageable, IUpgradeable {
  // Identity
  id: number
  type: StructureType
  
  // Position (grid-based, not pixel-based like mobile entities)
  gridX: number
  gridY: number
  
  // IStructureDamageable properties
  hp: number
  maxHp: number
  
  // IUpgradeable properties
  level: number
  maxLevel: number
  upgradeCost: number
  
  // Structure-specific properties
  ownerId: number
  animationFrame: number = 0
  accumulatedResource: number = 0
  
  // Config reference
  protected config: StructureConfig
  
  constructor(
    id: number,
    type: StructureType,
    ownerId: number,
    gridX: number,
    gridY: number,
    config: StructureConfig
  ) {
    this.id = id
    this.type = type
    this.ownerId = ownerId
    this.gridX = gridX
    this.gridY = gridY
    this.config = config
    
    // Initialize from config
    this.hp = config.hp
    this.maxHp = config.hp
    this.level = 1
    this.maxLevel = config.maxLevel
    this.upgradeCost = config.upgradeCost
  }
  
  // ==========================================================================
  // IDamageable Implementation
  // ==========================================================================
  
  /**
   * Take damage from an attacker
   */
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
  }
  
  /**
   * Check if structure is destroyed
   */
  isDead(): boolean {
    return this.hp <= 0
  }
  
  /**
   * Heal the structure
   */
  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }
  
  // ==========================================================================
  // IUpgradeable Implementation
  // ==========================================================================
  
  /**
   * Upgrade the structure to next level
   */
  upgrade(): boolean {
    if (!this.canUpgrade()) return false
    
    this.level++
    this.calculateUpgradeCost()
    this.onUpgrade()
    
    return true
  }
  
  /**
   * Check if structure can be upgraded
   */
  canUpgrade(): boolean {
    return this.level < this.maxLevel
  }
  
  /**
   * Get the cost of next upgrade
   */
  getUpgradeCost(): number {
    return this.upgradeCost
  }
  
  /**
   * Calculate upgrade cost based on level
   */
  protected calculateUpgradeCost(): void {
    this.upgradeCost = Math.floor(
      this.config.upgradeCost * Math.pow(this.config.upgradeCostScale, this.level - 1)
    )
  }
  
  /**
   * Called after upgrade - override in subclasses to update rates
   */
  protected abstract onUpgrade(): void
  
  // ==========================================================================
  // Resource Generation - Abstract
  // ==========================================================================
  
  /**
   * Get the resource generation rate per second
   */
  abstract getResourceRate(): number
  
  /**
   * Get the type of resource this structure generates
   */
  abstract getResourceType(): 'gold' | 'souls'
  
  /**
   * Generate resources based on delta time
   * Returns the amount of whole resources generated
   */
  generateResources(deltaTime: number): number {
    const rate = this.getResourceRate()
    this.accumulatedResource += rate * deltaTime
    
    const wholeResources = Math.floor(this.accumulatedResource)
    this.accumulatedResource -= wholeResources
    
    return wholeResources
  }
  
  // ==========================================================================
  // Animation
  // ==========================================================================
  
  /**
   * Update animation frame
   */
  updateAnimation(maxFrames: number = 4): void {
    this.animationFrame = (this.animationFrame + 1) % maxFrames
  }
  
  // ==========================================================================
  // Utility Methods
  // ==========================================================================
  
  /**
   * Get pixel position from grid position
   */
  getPixelPosition(tileSize: number): { x: number; y: number } {
    return {
      x: this.gridX * tileSize + tileSize / 2,
      y: this.gridY * tileSize + tileSize / 2
    }
  }
  
  /**
   * Check if a point is within the structure's bounds
   */
  containsPoint(x: number, y: number, tileSize: number): boolean {
    const pixelX = this.gridX * tileSize
    const pixelY = this.gridY * tileSize
    return x >= pixelX && x < pixelX + tileSize && 
           y >= pixelY && y < pixelY + tileSize
  }
  
  /**
   * Get distance to another grid position
   */
  getDistanceTo(gridX: number, gridY: number): number {
    const dx = this.gridX - gridX
    const dy = this.gridY - gridY
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  // ==========================================================================
  // Serialization
  // ==========================================================================
  
  /**
   * Convert structure to plain object for serialization
   */
  toJSON(): StructureState {
    return {
      id: this.id,
      type: this.type,
      level: this.level,
      gridX: this.gridX,
      gridY: this.gridY,
      hp: this.hp,
      maxHp: this.maxHp,
      ownerId: this.ownerId,
      animationFrame: this.animationFrame,
      upgradeCost: this.upgradeCost,
      accumulatedResource: this.accumulatedResource
    }
  }
  
  /**
   * Restore structure state from serialized data
   */
  fromJSON(data: Partial<StructureState>): void {
    if (data.level !== undefined) this.level = data.level
    if (data.hp !== undefined) this.hp = data.hp
    if (data.maxHp !== undefined) this.maxHp = data.maxHp
    if (data.animationFrame !== undefined) this.animationFrame = data.animationFrame
    if (data.upgradeCost !== undefined) this.upgradeCost = data.upgradeCost
    if (data.accumulatedResource !== undefined) this.accumulatedResource = data.accumulatedResource
  }
}
