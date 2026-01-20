/**
 * Game Module Index
 * Central export point for the entire game engine
 */

// Configuration - All config exports from unified config module
export * from './config'

// Entity System
export * from './entities'

// Re-export systems with explicit names to avoid conflicts
export * from './systems/movementSystem'
export * from './systems/cameraSystem'
export * from './systems/combatSystem'
export * from './systems/buildingSystem'
export * from './systems/monsterAISystem'
export * from './systems/renderingSystem'
