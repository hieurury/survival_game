/**
 * Game Configuration Index
 * Central export point for all configuration modules
 */

// Constants - Core values that don't change between modes
export * from './constants'

// Entity Configs - Single source of truth from entities
export * from './entityConfigs'

// Game Mode Config - Room positions, spawn zones, etc.
export * from './gameModeConfig'

// Game Modes - Data-driven configurations for different difficulties
export * from './gameModes'

// Difficulty API - Public interface for accessing difficulty settings
export * from './difficulty'
