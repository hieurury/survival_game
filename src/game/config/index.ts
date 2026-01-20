/**
 * Game Configuration Index
 * Central export point for all configuration modules
 */

// Constants - Core values that don't change between modes
export * from './constants'

// Balance - Entity stats and scaling (DO NOT MODIFY IN GAME MODES)
export * from './balance'

// Game Modes - Data-driven configurations for different difficulties
export * from './gameModes'

// Difficulty API - Public interface for accessing difficulty settings
export * from './difficulty'
