/**
 * Player Character Class
 * Human-controlled character
 * 
 * Characteristics:
 * - Controlled by player input
 * - No AI decision making
 * - Can use all game features
 */

import type { Vector2 } from '../../../types/game'
import { Character } from './CharacterBase'
import type { CharacterConfigBase, CharacterRuntime } from './CharacterBase'

// =============================================================================
// PLAYER CONFIG
// =============================================================================
export interface PlayerConfig extends CharacterConfigBase {
  // Player-specific configs can be added here
}

// =============================================================================
// PLAYER CLASS
// =============================================================================
export class Player extends Character {
  constructor(
    id: number,
    config: PlayerConfig,
    position: Vector2
  ) {
    super(id, true, config, position)
  }
  
  /**
   * Players don't have AI decision making
   */
  public makeDecision(): void {
    // Player decisions are handled by input
  }
  
  /**
   * Serialize player state
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      isHuman: this.isHuman,
      color: this.color,
      role: this.role,
      hp: this.hp,
      maxHp: this.maxHp,
      alive: this.alive,
      damage: this.damage,
      attackRange: this.attackRange,
      position: this.position,
      targetPosition: this.targetPosition,
      speed: this.speed,
      state: this.state,
      facingRight: this.facingRight,
      gold: this.gold,
      souls: this.souls,
      roomId: this.roomId,
      isSleeping: this.isSleeping,
      sleepTimer: this.sleepTimer,
      smoothX: this.smoothX,
      smoothY: this.smoothY
    }
  }
}

// =============================================================================
// PLAYER RUNTIME TYPE
// =============================================================================
export interface PlayerRuntime extends CharacterRuntime {
  isHuman: true
}

// =============================================================================
// PLAYER FACTORY
// =============================================================================
export function createPlayer(
  id: number,
  name: string,
  config: PlayerConfig,
  position: Vector2,
  color: string
): PlayerRuntime {
  return {
    id,
    name,
    isHuman: true,
    color,
    role: 'survivor',
    hp: config.maxHp,
    maxHp: config.maxHp,
    alive: true,
    damage: config.damage,
    attackRange: config.attackRange,
    attackCooldown: config.attackCooldown,
    position: { ...position },
    targetPosition: null,
    path: [],
    speed: config.speed,
    baseSpeed: config.speed,
    smoothX: position.x,
    smoothY: position.y,
    state: 'idle',
    animationFrame: 0,
    facingRight: true,
    gold: config.startingGold,
    souls: 0,
    roomId: null,
    isSleeping: false,
    sleepTimer: 0
  }
}

// =============================================================================
// DEFAULT PLAYER CONFIG
// =============================================================================
export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  name: 'Player',
  maxHp: 100,
  speed: 180,
  damage: 15,
  attackRange: 50,
  attackCooldown: 1.0,
  startingGold: 20,
  color: '#3b82f6'
}
