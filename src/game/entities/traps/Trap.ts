/**
 * Trap System
 * Area-based defensive mechanics (for future expansion)
 */

import type { Vector2 } from '../../../types/game'

// =============================================================================
// TRAP TYPE
// =============================================================================
export type TrapType = 'spike' | 'slowdown' | 'poison' | 'explosive' | 'stun'

// =============================================================================
// TRAP TRIGGER TYPE
// =============================================================================
export type TrapTrigger = 'proximity' | 'step' | 'timed' | 'manual'

// =============================================================================
// TRAP CONFIG
// =============================================================================
export interface TrapConfig {
  type: TrapType
  trigger: TrapTrigger
  damage: number // Damage per trigger
  damageScale: number // Damage multiplier per level
  effectDuration: number // Duration of effect (for DoT or CC)
  cooldown: number // Cooldown between triggers
  triggerRadius: number // Detection/trigger radius
  baseCost: number
  upgradeCost: number
  maxLevel: number
  maxCharges: number // -1 for infinite
  rechargeTime: number // Time to regain a charge (if applicable)
}

// =============================================================================
// TRAP INTERFACE
// =============================================================================
export interface ITrap {
  id: number
  type: TrapType
  position: Vector2
  gridX: number
  gridY: number
  ownerId: number
  level: number
  charges: number
  isActive: boolean
  cooldownTimer: number
}

// =============================================================================
// TRAP RUNTIME STATE
// =============================================================================
export interface TrapRuntime {
  id: number
  type: TrapType
  trigger: TrapTrigger
  position: Vector2
  gridX: number
  gridY: number
  ownerId: number
  level: number
  damage: number
  baseDamage: number
  effectDuration: number
  triggerRadius: number
  cooldown: number
  cooldownTimer: number
  charges: number
  maxCharges: number
  rechargeTimer: number
  isActive: boolean
  isTriggered: boolean
  upgradeCost: number
}

// =============================================================================
// TRAP FACTORY
// =============================================================================
export const createTrap = (
  id: number,
  ownerId: number,
  gridX: number,
  gridY: number,
  cellSize: number,
  config: TrapConfig
): TrapRuntime => {
  return {
    id,
    type: config.type,
    trigger: config.trigger,
    position: {
      x: (gridX + 0.5) * cellSize,
      y: (gridY + 0.5) * cellSize,
    },
    gridX,
    gridY,
    ownerId,
    level: 1,
    damage: config.damage,
    baseDamage: config.damage,
    effectDuration: config.effectDuration,
    triggerRadius: config.triggerRadius,
    cooldown: config.cooldown,
    cooldownTimer: 0,
    charges: config.maxCharges,
    maxCharges: config.maxCharges,
    rechargeTimer: 0,
    isActive: true,
    isTriggered: false,
    upgradeCost: config.upgradeCost,
  }
}

// =============================================================================
// TRAP UPGRADE
// =============================================================================
export const upgradeTrap = (trap: TrapRuntime, config: TrapConfig): boolean => {
  if (trap.level >= config.maxLevel) return false
  
  trap.level++
  trap.damage = Math.floor(trap.baseDamage * Math.pow(config.damageScale, trap.level - 1))
  trap.upgradeCost = Math.floor(config.upgradeCost * Math.pow(2, trap.level - 1))
  
  return true
}

// =============================================================================
// TRAP TRIGGER
// =============================================================================
export const triggerTrap = (trap: TrapRuntime): { damage: number; effectDuration: number } | null => {
  if (!trap.isActive || trap.cooldownTimer > 0) return null
  if (trap.maxCharges > 0 && trap.charges <= 0) return null
  
  trap.isTriggered = true
  trap.cooldownTimer = trap.cooldown
  
  if (trap.maxCharges > 0) {
    trap.charges--
    if (trap.charges <= 0) {
      trap.isActive = false
    }
  }
  
  return {
    damage: trap.damage,
    effectDuration: trap.effectDuration,
  }
}

// =============================================================================
// TRAP UPDATE
// =============================================================================
export const updateTrap = (trap: TrapRuntime, config: TrapConfig, deltaTime: number): void => {
  // Update cooldown
  if (trap.cooldownTimer > 0) {
    trap.cooldownTimer -= deltaTime
    if (trap.cooldownTimer <= 0) {
      trap.cooldownTimer = 0
      trap.isTriggered = false
    }
  }
  
  // Recharge if needed
  if (trap.maxCharges > 0 && trap.charges < trap.maxCharges) {
    trap.rechargeTimer += deltaTime
    if (trap.rechargeTimer >= config.rechargeTime) {
      trap.charges++
      trap.rechargeTimer = 0
      if (trap.charges > 0) {
        trap.isActive = true
      }
    }
  }
}

// =============================================================================
// DEFAULT TRAP CONFIGS
// =============================================================================
export const DEFAULT_SPIKE_TRAP: TrapConfig = {
  type: 'spike',
  trigger: 'step',
  damage: 25,
  damageScale: 1.3,
  effectDuration: 0,
  cooldown: 2.0,
  triggerRadius: 30,
  baseCost: 50,
  upgradeCost: 30,
  maxLevel: 5,
  maxCharges: -1, // Infinite
  rechargeTime: 0,
}

export const DEFAULT_SLOWDOWN_TRAP: TrapConfig = {
  type: 'slowdown',
  trigger: 'proximity',
  damage: 0,
  damageScale: 1.0,
  effectDuration: 3.0, // 3 seconds slow
  cooldown: 5.0,
  triggerRadius: 50,
  baseCost: 80,
  upgradeCost: 50,
  maxLevel: 5,
  maxCharges: -1,
  rechargeTime: 0,
}

export const DEFAULT_POISON_TRAP: TrapConfig = {
  type: 'poison',
  trigger: 'step',
  damage: 10, // Per second
  damageScale: 1.2,
  effectDuration: 5.0, // 5 seconds DoT
  cooldown: 8.0,
  triggerRadius: 40,
  baseCost: 100,
  upgradeCost: 60,
  maxLevel: 5,
  maxCharges: 3,
  rechargeTime: 30,
}

export const DEFAULT_EXPLOSIVE_TRAP: TrapConfig = {
  type: 'explosive',
  trigger: 'step',
  damage: 100,
  damageScale: 1.5,
  effectDuration: 0,
  cooldown: 0, // One-time use
  triggerRadius: 60,
  baseCost: 150,
  upgradeCost: 100,
  maxLevel: 3,
  maxCharges: 1,
  rechargeTime: 60, // Long recharge
}

export const DEFAULT_STUN_TRAP: TrapConfig = {
  type: 'stun',
  trigger: 'proximity',
  damage: 5,
  damageScale: 1.1,
  effectDuration: 2.0, // 2 seconds stun
  cooldown: 10.0,
  triggerRadius: 35,
  baseCost: 120,
  upgradeCost: 80,
  maxLevel: 5,
  maxCharges: -1,
  rechargeTime: 0,
}

export const TRAP_TYPE_CONFIGS: Record<TrapType, TrapConfig> = {
  spike: DEFAULT_SPIKE_TRAP,
  slowdown: DEFAULT_SLOWDOWN_TRAP,
  poison: DEFAULT_POISON_TRAP,
  explosive: DEFAULT_EXPLOSIVE_TRAP,
  stun: DEFAULT_STUN_TRAP,
}
