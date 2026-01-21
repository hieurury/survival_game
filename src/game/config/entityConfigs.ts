/**
 * Entity Configs - Single Source of Truth
 * 
 * File này re-export tất cả DEFAULT configs từ entities
 * Các file khác (game.ts, GamePage.vue) sẽ import từ đây
 * 
 * KHÔNG hardcode stats ở đây - chỉ re-export từ entities!
 */

// =============================================================================
// WEAPONS (Turret, Vanguard, SMG)
// =============================================================================
export { 
  DEFAULT_TURRET_CONFIG,
  type TurretConfig 
} from '../entities/weapons/Turret'

export { 
  DEFAULT_VANGUARD_CONFIG,
  type VanguardConfig 
} from '../entities/weapons/Vanguard'

export { 
  DEFAULT_SMG_CONFIG,
  type SMGConfig 
} from '../entities/weapons/SMG'

// =============================================================================
// STRUCTURES (ATM, Soul Collector)
// =============================================================================
export { 
  DEFAULT_ATM_CONFIG,
  type ATMConfig 
} from '../entities/structures/ATM'

export { 
  DEFAULT_SOUL_COLLECTOR_CONFIG,
  type SoulCollectorConfig 
} from '../entities/structures/SoulCollector'

// =============================================================================
// DOORS
// =============================================================================
export { 
  DEFAULT_DOOR_CONFIG,
  type DoorConfig 
} from '../entities/doors/Door'

// =============================================================================
// BEDS
// =============================================================================
export { 
  DEFAULT_BED_CONFIG,
  type BedConfig 
} from '../entities/beds/Bed'

// =============================================================================
// MONSTERS
// =============================================================================
export { 
  DEFAULT_MONSTER_CONFIG,
  type MonsterConfig 
} from '../entities/monsters/Monster'

// =============================================================================
// HEROES (Player, Bot)
// =============================================================================
export { 
  DEFAULT_PLAYER_CONFIG,
  type PlayerConfig 
} from '../entities/heroes/Player'

export { 
  DEFAULT_BOT_CONFIG,
  type BotConfig 
} from '../entities/heroes/Bot'

// =============================================================================
// HELPER: Get building config by type
// =============================================================================
import { DEFAULT_TURRET_CONFIG } from '../entities/weapons/Turret'
import { DEFAULT_VANGUARD_CONFIG } from '../entities/weapons/Vanguard'
import { DEFAULT_SMG_CONFIG } from '../entities/weapons/SMG'
import { DEFAULT_ATM_CONFIG } from '../entities/structures/ATM'
import { DEFAULT_SOUL_COLLECTOR_CONFIG } from '../entities/structures/SoulCollector'

export type BuildingType = 'turret' | 'smg' | 'atm' | 'soul_collector' | 'vanguard'

/**
 * Get building stats from entity configs
 * Use this instead of hardcoded GAME_CONSTANTS.BUILDINGS
 */
export const getBuildingConfig = (type: BuildingType) => {
  switch (type) {
    case 'turret':
      return {
        hp: DEFAULT_TURRET_CONFIG.maxHp,
        damage: DEFAULT_TURRET_CONFIG.baseDamage,
        range: DEFAULT_TURRET_CONFIG.baseRange,
        cooldown: DEFAULT_TURRET_CONFIG.attackCooldown,
        upgradeCost: DEFAULT_TURRET_CONFIG.upgradeCost,
        baseCost: DEFAULT_TURRET_CONFIG.baseCost,
        damageScale: DEFAULT_TURRET_CONFIG.damageScale,
        rangeScale: DEFAULT_TURRET_CONFIG.rangeScale,
      }
    case 'smg':
      return {
        hp: DEFAULT_SMG_CONFIG.maxHp,
        damage: DEFAULT_SMG_CONFIG.baseDamage,
        range: DEFAULT_SMG_CONFIG.baseRange,
        cooldown: 7.0, // Burst cooldown (not per-shot)
        upgradeCost: DEFAULT_SMG_CONFIG.upgradeCost,
        baseCost: DEFAULT_SMG_CONFIG.baseCost,
        damageScale: DEFAULT_SMG_CONFIG.damageScale,
        rangeScale: DEFAULT_SMG_CONFIG.rangeScale,
        burstCount: 10,
        burstInterval: 0.1,
        fireRate: DEFAULT_SMG_CONFIG.fireRate,
        magazineSize: DEFAULT_SMG_CONFIG.magazineSize,
      }
    case 'atm':
      return {
        hp: DEFAULT_ATM_CONFIG.hp,
        damage: 0,
        range: 0,
        cooldown: 0,
        upgradeCost: DEFAULT_ATM_CONFIG.upgradeCost,
        baseCost: DEFAULT_ATM_CONFIG.baseCost,
        goldRate: DEFAULT_ATM_CONFIG.baseGoldRate,
        goldRateLevels: DEFAULT_ATM_CONFIG.goldRatePerLevel,
      }
    case 'soul_collector':
      return {
        hp: DEFAULT_SOUL_COLLECTOR_CONFIG.hp,
        damage: 0,
        range: 0,
        cooldown: 0,
        upgradeCost: DEFAULT_SOUL_COLLECTOR_CONFIG.upgradeCost,
        baseCost: DEFAULT_SOUL_COLLECTOR_CONFIG.baseCost,
        soulRate: DEFAULT_SOUL_COLLECTOR_CONFIG.baseSoulRate,
        soulRateLevels: DEFAULT_SOUL_COLLECTOR_CONFIG.soulRatePerLevel,
      }
    case 'vanguard':
      return {
        hp: DEFAULT_VANGUARD_CONFIG.maxHp,
        damage: DEFAULT_VANGUARD_CONFIG.baseDamage,
        range: DEFAULT_VANGUARD_CONFIG.baseRange,
        cooldown: DEFAULT_VANGUARD_CONFIG.attackCooldown,
        upgradeCost: DEFAULT_VANGUARD_CONFIG.upgradeCost,
        baseCost: DEFAULT_VANGUARD_CONFIG.baseCost,
        speed: DEFAULT_VANGUARD_CONFIG.speed,
        detectionRange: DEFAULT_VANGUARD_CONFIG.detectionRange,
        respawnTime: DEFAULT_VANGUARD_CONFIG.respawnTime,
        hpScale: DEFAULT_VANGUARD_CONFIG.hpScale,
        damageScale: DEFAULT_VANGUARD_CONFIG.damageScale,
      }
  }
}

/**
 * All building configs mapped by type
 */
export const BUILDING_CONFIGS = {
  turret: getBuildingConfig('turret'),
  smg: getBuildingConfig('smg'),
  atm: getBuildingConfig('atm'),
  soul_collector: getBuildingConfig('soul_collector'),
  vanguard: getBuildingConfig('vanguard'),
} as const
