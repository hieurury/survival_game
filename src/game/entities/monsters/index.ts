/**
 * Monster System Exports
 * Currently supports 2 monster types: Ác ma (Demon) and Vong hồn kỵ sỹ (Phantom Knight)
 */

// Base monster class and types
export * from './MonsterBase'

// Specific monster implementations
export * from './StandardMonster' // Ác ma (Demon)
export * from './PhantomKnight'   // Vong hồn kỵ sỹ

// Legacy exports for backward compatibility
export * from './Monster'

// Re-export commonly used types
export type { MonsterArchetype, MonsterConfigBase, MonsterRuntime, MonsterSkill } from './MonsterBase'
export type { StandardMonsterConfig } from './StandardMonster'
export type { PhantomKnightConfig, PhantomKnightRuntime } from './PhantomKnight'
