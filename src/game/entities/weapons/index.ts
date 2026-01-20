/**
 * Weapon System Exports
 * All weapon types and utilities
 */

// Base weapon class and types
export * from './WeaponBase'

// Specific weapon implementations
export * from './Turret'
export * from './Vanguard'
export * from './SMG'

// Re-export commonly used types
export type { WeaponConfigBase, WeaponCategory, WeaponState, WeaponRuntime } from './WeaponBase'
export type { TurretConfig, TurretProjectile, TurretRuntime } from './Turret'
export type { VanguardConfig, VanguardRuntime } from './Vanguard'
export type { SMGConfig, SMGProjectile, SMGRuntime } from './SMG'
