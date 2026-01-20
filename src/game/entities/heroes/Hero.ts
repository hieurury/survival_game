/**
 * Hero System
 * Base class for all controllable characters (Player and Bot)
 */

import type { Vector2, EntityState } from '../../../types/game'
import type { IEntity, IDamageable, IMoveable, ICombatant } from '../base/Entity'

// =============================================================================
// HERO CONFIG
// =============================================================================
export interface HeroConfig {
  hp: number
  speed: number
  damage: number
  attackRange: number
  attackCooldown: number
  startingGold: number
}

// =============================================================================
// HERO BASE INTERFACE
// =============================================================================
export interface IHero extends IEntity, IDamageable, IMoveable, ICombatant {
  name: string
  isHuman: boolean
  roomId: number | null
  alive: boolean
  gold: number
  souls: number
  isSleeping: boolean
  sleepTimer: number
  color: string
}

// =============================================================================
// HERO RUNTIME STATE
// =============================================================================
export interface HeroState {
  id: number
  name: string
  isHuman: boolean
  roomId: number | null
  alive: boolean
  gold: number
  souls: number
  hp: number
  maxHp: number
  position: Vector2
  targetPosition: Vector2 | null
  path: Vector2[]
  speed: number
  state: EntityState
  animationFrame: number
  animationTimer: number
  color: string
  attackCooldown: number
  attackRange: number
  damage: number
  facingRight: boolean
  isSleeping: boolean
  sleepTimer: number
  smoothX: number
  smoothY: number
}

// =============================================================================
// PLAYER CONFIG (Human-controlled Hero)
// =============================================================================
export interface PlayerConfig extends HeroConfig {
  // Player-specific configs can be added here
}

// =============================================================================
// BOT CONFIG (AI-controlled Hero)
// =============================================================================
export interface BotConfig extends HeroConfig {
  // Bot AI behavior configs
  aggressiveness: number // 0-1, how likely to attack vs defend
  economyFocus: number // 0-1, how much to prioritize economy
  defenseFocus: number // 0-1, how much to prioritize defense
}

// =============================================================================
// HERO FACTORY
// =============================================================================
export const createHero = (
  id: number,
  name: string,
  isHuman: boolean,
  config: HeroConfig,
  position: Vector2,
  color: string
): HeroState => {
  return {
    id,
    name,
    isHuman,
    roomId: null,
    alive: true,
    gold: config.startingGold,
    souls: 0,
    hp: config.hp,
    maxHp: config.hp,
    position: { ...position },
    targetPosition: null,
    path: [],
    speed: config.speed,
    state: 'idle',
    animationFrame: 0,
    animationTimer: 0,
    color,
    attackCooldown: 0,
    attackRange: config.attackRange,
    damage: config.damage,
    facingRight: true,
    isSleeping: false,
    sleepTimer: 0,
    smoothX: position.x,
    smoothY: position.y,
  }
}

// =============================================================================
// DEFAULT HERO CONFIGS
// =============================================================================
export const DEFAULT_HERO_CONFIG: HeroConfig = {
  hp: 100,
  speed: 180,
  damage: 15,
  attackRange: 50,
  attackCooldown: 1.0,
  startingGold: 20,
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  ...DEFAULT_HERO_CONFIG,
  aggressiveness: 0.5,
  economyFocus: 0.5,
  defenseFocus: 0.5,
}
