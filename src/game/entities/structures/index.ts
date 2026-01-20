/**
 * Structures Module Index
 * 
 * Exports all structure-related classes, types, and utilities.
 * 
 * Structure Hierarchy:
 * Structure (abstract)
 * ├── ATM (gold generator)
 * └── SoulCollector (soul generator)
 */

// =============================================================================
// BASE CLASS
// =============================================================================
export { 
  Structure, 
  type StructureType, 
  type StructureConfig, 
  type StructureState 
} from './StructureBase'

// =============================================================================
// CONCRETE STRUCTURES
// =============================================================================

// ATM
export { 
  ATM, 
  type ATMConfig, 
  type ATMState, 
  type ATMRuntime,
  DEFAULT_ATM_CONFIG, 
  createATM 
} from './ATM'

// Soul Collector
export { 
  SoulCollector, 
  type SoulCollectorConfig, 
  type SoulCollectorState,
  type SoulCollectorRuntime,
  DEFAULT_SOUL_COLLECTOR_CONFIG, 
  createSoulCollector 
} from './SoulCollector'

// =============================================================================
// BACKWARD COMPATIBILITY - Re-export from original Structure.ts
// =============================================================================
export { 
  // Types
  type IStructure,
  type StructureRuntime,
  // Functions
  upgradeStructure,
} from './Structure'

// =============================================================================
// FACTORY UTILITIES
// =============================================================================

import { type StructureType } from './StructureBase'
import { ATM, DEFAULT_ATM_CONFIG } from './ATM'
import { SoulCollector, DEFAULT_SOUL_COLLECTOR_CONFIG } from './SoulCollector'

/**
 * Create a structure instance from type
 */
export const createStructure = (
  type: StructureType,
  id: number,
  ownerId: number,
  gridX: number,
  gridY: number
): ATM | SoulCollector => {
  switch (type) {
    case 'atm':
      return new ATM(id, ownerId, gridX, gridY, DEFAULT_ATM_CONFIG)
    case 'soul_collector':
      return new SoulCollector(id, ownerId, gridX, gridY, DEFAULT_SOUL_COLLECTOR_CONFIG)
    default:
      throw new Error(`Unknown structure type: ${type}`)
  }
}

/**
 * Get structure config by type
 */
export const getStructureConfig = (type: StructureType) => {
  switch (type) {
    case 'atm':
      return DEFAULT_ATM_CONFIG
    case 'soul_collector':
      return DEFAULT_SOUL_COLLECTOR_CONFIG
    default:
      throw new Error(`Unknown structure type: ${type}`)
  }
}
