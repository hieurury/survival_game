/**
 * Hero/Character System Exports
 * All character types and utilities
 */

// Base character class and types
export * from './CharacterBase'

// Specific character implementations
export * from './Player'
export * from './Bot'

// Legacy exports for backward compatibility
export * from './Hero'

// Re-export commonly used types
export type { CharacterRole, CharacterConfigBase, CharacterRuntime } from './CharacterBase'
export type { PlayerConfig, PlayerRuntime } from './Player'
export type { BotConfig, BotRuntime, BotAIState, BotPersonality } from './Bot'
