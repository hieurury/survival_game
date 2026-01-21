/**
 * Game Mode Configuration
 * 
 * File này CHỈ chứa các cấu hình cho game modes:
 * - Kích thước phòng, vị trí phòng
 * - Vị trí spawn quái, heal zones
 * - Các giá trị ngẫu nhiên, scaling theo mode
 * 
 * KHÔNG chứa stats của buildings/weapons/monsters
 * → Stats lấy từ entities (src/game/config/entityConfigs.ts)
 */

// =============================================================================
// ECONOMY SETTINGS (có thể điều chỉnh theo game mode)
// =============================================================================
export const ECONOMY_CONFIG = {
  /** Vàng khởi đầu */
  STARTING_GOLD: 20,
  /** Vàng nhận mỗi giây (passive) */
  GOLD_PER_SECOND: 0,
} as const

// =============================================================================
// PURCHASE COSTS - Giá MUA bằng VÀNG (gold)
// Lưu ý: ATM mua bằng LINH HỒN, không nằm ở đây
// =============================================================================
export const PURCHASE_COSTS = {
  turret: 10,
  smg: 100,
  // atm: Mua bằng souls (100) - xem DEFAULT_ATM_CONFIG
  soul_collector: 200,
  vanguard: 150,
  upgradeDoor: 40,
  moveRoom: 6,
} as const

// =============================================================================
// SOUL PURCHASE COSTS - Giá MUA bằng LINH HỒN
// =============================================================================
export const SOUL_PURCHASE_COSTS = {
  atm: 200, // ATM mua bằng 200 linh hồn
} as const

// =============================================================================
// SOUL COSTS - Giá linh hồn khi nâng cấp từ LEVEL 5+
// =============================================================================
export const SOUL_COSTS_LV5 = {
  bed: 25,          // Giường: 25 linh hồn
  door: 20,         // Cửa: 20 linh hồn
  turret: 10,       // Súng: 10 linh hồn
  smg: 40,          // Tiểu liên: 40 linh hồn
  atm: 250,         // ATM: 250 linh hồn nâng cấp lần đầu từ lv5, gấp đôi mỗi lần
  soul_collector: 200, // Máy thu hồn: 200 linh hồn
  vanguard: 45,     // Tiên phong: 45 linh hồn
} as const

// =============================================================================
// NOTE: DOOR & BED configs đã chuyển sang entities
// - Door: src/game/entities/rooms/Door.ts -> DEFAULT_DOOR_CONFIG
// - Bed: src/game/entities/rooms/Bed.ts -> DEFAULT_BED_CONFIG
// =============================================================================

// =============================================================================
// MAP LAYOUT (có thể điều chỉnh theo game mode)
// =============================================================================
export const MAP_CONFIG = {
  /** Số cột grid */
  GRID_COLS: 60,
  /** Số hàng grid */
  GRID_ROWS: 44,
  /** Kích thước cell (pixels) */
  CELL_SIZE: 48,
  /** Số phòng */
  ROOMS_COUNT: 7,
} as const

// =============================================================================
// SPAWN ZONE - Vùng spawn người chơi
// =============================================================================
export const SPAWN_ZONE_CONFIG = {
  gridX: 26,
  gridY: 17,
  width: 8,
  height: 6,
} as const

// =============================================================================
// MONSTER NESTS - Vùng hồi máu quái
// =============================================================================
export const MONSTER_NEST_CONFIG = {
  /** Các vị trí nest */
  POSITIONS: [
    { gridX: 2, gridY: 2, width: 4, height: 4 },      // Top-left
    { gridX: 54, gridY: 34, width: 4, height: 4 },    // Bottom-right
  ],
  /** Mana tối đa của healing point */
  MAX_MANA: 5000,
  /** Mana hồi mỗi giây */
  MANA_REGEN: 50,
  /** % mana tối thiểu để quái có thể hồi */
  MIN_MANA_PERCENT: 0.10,
} as const

// =============================================================================
// CAMERA/VIEWPORT (có thể điều chỉnh theo device)
// =============================================================================
export const VIEWPORT_CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,
  CAMERA_PADDING: 400,
  CAMERA_BOTTOM_PADDING: 200,
} as const

// GAME_MODES and GameModeConfig are now in gameModes.ts - single source of truth

// =============================================================================
// ANIMATION & MISC
// =============================================================================
export const ANIMATION_CONFIG = {
  SPEED: 0.1,
  SMOOTH_FACTOR: 0.25,
} as const
