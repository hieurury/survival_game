/**
 * Monster System Exports
 * All monster types and utilities
 */

// Base monster class and types
export * from './MonsterBase'

// Specific monster implementations
export * from './StandardMonster'
export * from './TankMonster'
export * from './FastMonster'
export * from './BossMonster'

// Legacy exports for backward compatibility
export * from './Monster'

// Re-export commonly used types
export type { MonsterArchetype, MonsterConfigBase, MonsterRuntime } from './MonsterBase'
export type { StandardMonsterConfig } from './StandardMonster'
export type { TankMonsterConfig, TankMonsterRuntime } from './TankMonster'
export type { FastMonsterConfig, FastMonsterRuntime } from './FastMonster'
export type { BossMonsterConfig, BossMonsterRuntime, BossAbility, BossAbilityType, BossPhase } from './BossMonster'
