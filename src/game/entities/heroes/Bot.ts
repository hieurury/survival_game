/**
 * Bot Character Class
 * AI-controlled character
 * 
 * Characteristics:
 * - Controlled by AI
 * - Has personality traits affecting behavior
 * - Makes autonomous decisions
 */

import type { Vector2 } from '../../../types/game'
import { Character } from './CharacterBase'
import type { CharacterConfigBase, CharacterRuntime } from './CharacterBase'

// =============================================================================
// BOT AI STATE
// =============================================================================
export type BotAIState = 
  | 'idle'
  | 'seeking_room'
  | 'going_to_bed'
  | 'sleeping'
  | 'building'
  | 'repairing'
  | 'fleeing'
  | 'defending'

// =============================================================================
// BOT PERSONALITY
// =============================================================================
export type BotPersonality = 
  | 'aggressive'  // Prioritizes combat and turrets
  | 'defensive'   // Prioritizes door upgrades and repairs
  | 'economic'    // Prioritizes gold generation
  | 'balanced'    // Mix of all strategies

// =============================================================================
// BOT CONFIG
// =============================================================================
export interface BotConfig extends CharacterConfigBase {
  /** Personality type */
  personality: BotPersonality
  /** How likely to attack vs defend (0-1) */
  aggressiveness: number
  /** How much to prioritize economy (0-1) */
  economyFocus: number
  /** How much to prioritize defense (0-1) */
  defenseFocus: number
  /** Time between AI decisions in seconds */
  decisionCooldown: number
}

// =============================================================================
// BOT CLASS
// =============================================================================
export class Bot extends Character {
  // AI properties
  public aiState: BotAIState
  public personality: BotPersonality
  public aggressiveness: number
  public economyFocus: number
  public defenseFocus: number
  
  // AI targeting
  public aiTargetRoomId: number | null
  public lastDecisionTime: number
  public decisionCooldown: number
  
  constructor(
    id: number,
    config: BotConfig,
    position: Vector2
  ) {
    super(id, false, config, position)
    
    this.aiState = 'idle'
    this.personality = config.personality
    this.aggressiveness = config.aggressiveness
    this.economyFocus = config.economyFocus
    this.defenseFocus = config.defenseFocus
    
    this.aiTargetRoomId = null
    this.lastDecisionTime = 0
    this.decisionCooldown = config.decisionCooldown
  }
  
  /**
   * Update bot state
   */
  public override update(deltaTime: number): void {
    super.update(deltaTime)
    this.lastDecisionTime += deltaTime
  }
  
  /**
   * Check if bot should make a new decision
   */
  public shouldMakeDecision(): boolean {
    return this.lastDecisionTime >= this.decisionCooldown
  }
  
  /**
   * Reset decision timer
   */
  public resetDecisionTimer(): void {
    this.lastDecisionTime = 0
  }
  
  /**
   * Make AI decision based on personality
   * Note: Actual decision logic is implemented in useBotAI composable
   * This is a hook for the AI system
   */
  public makeDecision(): void {
    if (!this.shouldMakeDecision()) return
    
    // Decision logic is personality-driven
    // Implemented in game systems, not here
    this.resetDecisionTimer()
  }
  
  /**
   * Set AI state
   */
  public setAIState(state: BotAIState): void {
    this.aiState = state
  }
  
  /**
   * Get priority score for building turrets
   */
  public getTurretPriority(): number {
    let score = this.aggressiveness * 0.5 + this.defenseFocus * 0.5
    if (this.personality === 'aggressive') score += 0.3
    if (this.personality === 'defensive') score += 0.2
    return Math.min(1, score)
  }
  
  /**
   * Get priority score for economy buildings
   */
  public getEconomyPriority(): number {
    let score = this.economyFocus
    if (this.personality === 'economic') score += 0.4
    return Math.min(1, score)
  }
  
  /**
   * Get priority score for door upgrades
   */
  public getDoorPriority(): number {
    let score = this.defenseFocus
    if (this.personality === 'defensive') score += 0.4
    return Math.min(1, score)
  }
  
  /**
   * Serialize bot state
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
      smoothY: this.smoothY,
      aiState: this.aiState,
      personality: this.personality,
      aiTargetRoomId: this.aiTargetRoomId
    }
  }
}

// =============================================================================
// BOT RUNTIME TYPE
// =============================================================================
export interface BotRuntime extends CharacterRuntime {
  isHuman: false
  aiState: BotAIState
  personality: BotPersonality
  aggressiveness: number
  economyFocus: number
  defenseFocus: number
  aiTargetRoomId: number | null
  lastDecisionTime: number
  decisionCooldown: number
}

// =============================================================================
// BOT FACTORY
// =============================================================================
export function createBot(
  id: number,
  name: string,
  config: BotConfig,
  position: Vector2,
  color: string
): BotRuntime {
  return {
    id,
    name,
    isHuman: false,
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
    sleepTimer: 0,
    aiState: 'idle',
    personality: config.personality,
    aggressiveness: config.aggressiveness,
    economyFocus: config.economyFocus,
    defenseFocus: config.defenseFocus,
    aiTargetRoomId: null,
    lastDecisionTime: 0,
    decisionCooldown: config.decisionCooldown
  }
}

// =============================================================================
// DEFAULT BOT CONFIGS BY PERSONALITY
// =============================================================================
export const DEFAULT_BOT_CONFIG: BotConfig = {
  name: 'Bot',
  maxHp: 100,
  speed: 180,
  damage: 15,
  attackRange: 50,
  attackCooldown: 1.0,
  startingGold: 20,
  color: '#22c55e',
  personality: 'balanced',
  aggressiveness: 0.5,
  economyFocus: 0.5,
  defenseFocus: 0.5,
  decisionCooldown: 2.0
}

export const AGGRESSIVE_BOT_CONFIG: BotConfig = {
  ...DEFAULT_BOT_CONFIG,
  personality: 'aggressive',
  aggressiveness: 0.8,
  economyFocus: 0.3,
  defenseFocus: 0.4
}

export const DEFENSIVE_BOT_CONFIG: BotConfig = {
  ...DEFAULT_BOT_CONFIG,
  personality: 'defensive',
  aggressiveness: 0.3,
  economyFocus: 0.4,
  defenseFocus: 0.8
}

export const ECONOMIC_BOT_CONFIG: BotConfig = {
  ...DEFAULT_BOT_CONFIG,
  personality: 'economic',
  aggressiveness: 0.3,
  economyFocus: 0.9,
  defenseFocus: 0.3
}
