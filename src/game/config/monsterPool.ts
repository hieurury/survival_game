/**
 * Monster Pool System
 * Manages available monster types and random spawning
 * 
 * IMPORTANT: All monster stats come from entity config files:
 * - StandardMonster.ts (Ác ma)
 * - PhantomKnight.ts (Vong hồn kỵ sỹ)
 */

import type { Vector2, Monster, MonsterSkill } from '../../types/game'
import { DEFAULT_STANDARD_MONSTER_CONFIG, DEMON_SKILL } from '../entities/monsters/StandardMonster'
import { DEFAULT_PHANTOM_KNIGHT_CONFIG, PHANTOM_KNIGHT_SKILL } from '../entities/monsters/PhantomKnight'

// =============================================================================
// MONSTER TYPE DEFINITIONS
// =============================================================================
export type MonsterTypeName = 'demon' | 'phantom_knight'

export interface MonsterTypeDefinition {
  type: MonsterTypeName
  name: string
  nameVi: string
  maxHp: number
  baseDamage: number
  speed: number
  attackRange: number
  attackCooldown: number
  hpScale: number
  damageScale: number
  color: string
  skill: MonsterSkill
  // Passive abilities
  hasPassive: boolean
  passiveThreshold?: number // HP threshold to activate passive (0-1)
  passiveRangedRange?: number // Range when passive activates
}

// =============================================================================
// MONSTER POOL - Built from entity configs (Single Source of Truth)
// =============================================================================
export const MONSTER_POOL: MonsterTypeDefinition[] = [
  // Ác ma (Demon) - from StandardMonster.ts
  {
    type: 'demon',
    name: 'Demon',
    nameVi: DEFAULT_STANDARD_MONSTER_CONFIG.name,
    maxHp: DEFAULT_STANDARD_MONSTER_CONFIG.maxHp,
    baseDamage: DEFAULT_STANDARD_MONSTER_CONFIG.baseDamage,
    speed: DEFAULT_STANDARD_MONSTER_CONFIG.speed,
    attackRange: DEFAULT_STANDARD_MONSTER_CONFIG.attackRange,
    attackCooldown: DEFAULT_STANDARD_MONSTER_CONFIG.attackCooldown,
    hpScale: DEFAULT_STANDARD_MONSTER_CONFIG.hpScale,
    damageScale: DEFAULT_STANDARD_MONSTER_CONFIG.damageScale,
    color: DEFAULT_STANDARD_MONSTER_CONFIG.color,
    skill: {
      ...DEMON_SKILL,
      currentCooldown: DEMON_SKILL.cooldown // Start at full cooldown
    },
    hasPassive: false
  },
  // Vong hồn kỵ sỹ (Phantom Knight) - from PhantomKnight.ts
  {
    type: 'phantom_knight',
    name: 'Phantom Knight',
    nameVi: DEFAULT_PHANTOM_KNIGHT_CONFIG.name,
    maxHp: DEFAULT_PHANTOM_KNIGHT_CONFIG.maxHp,
    baseDamage: DEFAULT_PHANTOM_KNIGHT_CONFIG.baseDamage,
    speed: DEFAULT_PHANTOM_KNIGHT_CONFIG.speed,
    attackRange: DEFAULT_PHANTOM_KNIGHT_CONFIG.attackRange,
    attackCooldown: DEFAULT_PHANTOM_KNIGHT_CONFIG.attackCooldown,
    hpScale: DEFAULT_PHANTOM_KNIGHT_CONFIG.hpScale,
    damageScale: DEFAULT_PHANTOM_KNIGHT_CONFIG.damageScale,
    color: DEFAULT_PHANTOM_KNIGHT_CONFIG.color,
    skill: {
      ...PHANTOM_KNIGHT_SKILL,
      currentCooldown: PHANTOM_KNIGHT_SKILL.cooldown // Start at full cooldown
    },
    hasPassive: true,
    passiveThreshold: DEFAULT_PHANTOM_KNIGHT_CONFIG.passiveThreshold,
    passiveRangedRange: DEFAULT_PHANTOM_KNIGHT_CONFIG.passiveRangedRange
  }
]

// =============================================================================
// GET RANDOM MONSTER TYPE
// =============================================================================
export function getRandomMonsterType(): MonsterTypeDefinition {
  if (MONSTER_POOL.length === 0) {
    throw new Error('Monster pool is empty')
  }
  const randomIndex = Math.floor(Math.random() * MONSTER_POOL.length)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return MONSTER_POOL[randomIndex]!
}

// =============================================================================
// CREATE MONSTER FROM TYPE
// =============================================================================
export function createMonsterFromType(
  id: number,
  monsterType: MonsterTypeDefinition,
  spawnPosition: Vector2,
  healZones: Vector2[],
  baseLevelTime: number = 30,
  levelTimeIncrement: number = 10
): Monster {
  const levelUpTime = baseLevelTime + levelTimeIncrement
  
  return {
    id,
    name: monsterType.nameVi,
    hp: monsterType.maxHp,
    maxHp: monsterType.maxHp,
    damage: monsterType.baseDamage,
    baseDamage: monsterType.baseDamage,
    level: 1,
    levelTimer: 0,
    levelUpTime,
    targetRoomId: null,
    targetPlayerId: null,
    targetVanguardId: null,
    targetHealingPointId: null,
    position: { ...spawnPosition },
    targetPosition: null,
    path: [],
    speed: monsterType.speed,
    baseSpeed: monsterType.speed,
    state: 'idle',
    monsterState: 'search',
    attackCooldown: 0,
    attackRange: monsterType.attackRange,
    baseAttackRange: monsterType.attackRange,
    animationFrame: 0,
    animationTimer: 0,
    healZone: { ...spawnPosition },
    healZones: [...healZones],
    isRetreating: false,
    isFullyHealing: false,
    healingInterrupted: false,
    healIdleTimer: 0,
    facingRight: false,
    targetTimer: 0,
    lastTargets: [],
    skill: { ...monsterType.skill },
    passiveActive: false,
    isRanged: false
  }
}

// =============================================================================
// GET MONSTER COLOR BY TYPE
// =============================================================================
export function getMonsterColor(monsterName: string): string {
  const monsterType = MONSTER_POOL.find(m => m.nameVi === monsterName || m.name === monsterName)
  return monsterType?.color || '#7c3aed'
}

// =============================================================================
// CHECK IF MONSTER HAS PASSIVE
// =============================================================================
export function getMonsterPassiveInfo(monsterName: string): { hasPassive: boolean, threshold?: number, range?: number } {
  const monsterType = MONSTER_POOL.find(m => m.nameVi === monsterName || m.name === monsterName)
  if (!monsterType) return { hasPassive: false }
  
  return {
    hasPassive: monsterType.hasPassive,
    threshold: monsterType.passiveThreshold,
    range: monsterType.passiveRangedRange
  }
}

// =============================================================================
// GET MONSTER TYPE CONFIG BY NAME
// =============================================================================
export function getMonsterTypeConfig(monsterName: string): MonsterTypeDefinition | null {
  return MONSTER_POOL.find(m => m.nameVi === monsterName || m.name === monsterName) || null
}
