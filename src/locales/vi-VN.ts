/**
 * Vietnamese (vi-VN) Localization
 * Bản địa hóa Tiếng Việt cho game sinh tồn
 */

export const vi_VN = {
  // ============================================
  // GAME TERMS - Thuật ngữ game chuẩn
  // ============================================
  terms: {
    gold: 'Vàng',
    souls: 'Linh hồn',
    hp: 'Máu',
    damage: 'Sát thương',
    level: 'Cấp',
    monster: 'Quái vật',
    player: 'Người chơi',
    room: 'Phòng',
    door: 'Cửa',
    bed: 'Giường',
    turret: 'Tháp súng',
    atm: 'Máy ATM',
    soulCollector: 'Máy thu hồn',
    vanguard: 'Tiên phong',
    building: 'Công trình',
  },

  // ============================================
  // GAME MESSAGES - Thông báo trong game
  // ============================================
  messages: {
    // Sleep messages
    startedSleeping: 'Bắt đầu ngủ - đang kiếm vàng!',
    startedSleepingWithGold: 'Bắt đầu ngủ - nhận {gold}💰/giây!',
    mustBeInRoom: 'Phải ở trong phòng mới ngủ được!',
    roomAlreadyClaimed: 'Phòng này đã có chủ rồi!',
    getCloserToBed: 'Lại gần giường hơn!',
    claimedRoom: 'Đã chiếm phòng {roomId} ({roomType})!',

    // Camera
    cameraFollowing: 'Camera đang theo người chơi',

    // Building messages
    spotHasBuilding: 'Vị trí này đã có công trình. Nhấn vào để nâng cấp!',
    notEnoughGold: 'Không đủ vàng!',
    notEnoughGoldNeed: 'Không đủ vàng! Cần {cost}g',
    notEnoughSouls: 'Không đủ linh hồn! Cần {cost} linh hồn.',
    builtInRoom: 'Đã xây {type} ở phòng {roomId}',

    // Bed upgrades
    bedUpgraded: 'Giường nâng lên Lv{level} ({income}g/giây)',

    // Door messages
    doorMaxLevel: 'Cửa đã đạt cấp tối đa!',
    doorUpgraded: 'Cửa nâng lên Lv{level} ({hp} máu)',
    doorNotDestroyed: 'Cửa chưa bị phá!',
    doorRebuildNeedGold: 'Không đủ vàng! Cần {cost}g để xây lại.',
    doorRebuilt: 'Cửa đã được xây lại về Cấp 1!',
    doorRepairCooldown: 'Đang hồi chiêu sửa chữa: {time}giây',
    doorFullHp: 'Cửa đã đầy máu!',
    doorRepairing: 'Đang sửa chữa cửa...',
    doorRepairComplete: 'Sửa chữa cửa hoàn tất!',
    roomDoorDestroyed: 'Cửa phòng {roomId} bị phá hủy!',

    // Building upgrades
    needSoulsForLevel: 'Cần {cost} linh hồn để lên cấp {level}!',
    buildingMaxLevel: '{type} đã đạt cấp tối đa!',
    needGoldToUpgrade: 'Cần {cost}g để nâng cấp!',
    vanguardUpgraded: 'Tiên phong nâng cấp! Số đơn vị: {units}',
    buildingUpgraded: '{type} nâng lên Lv{level}!',
    soldBuilding: 'Đã bán {type} với giá {refund}g!',

    // Monster messages
    caughtOutside: '⚠️ Bạn bị bắt gặp bên ngoài! Quái vật đang săn bạn!',
    playerCaughtOutside: '{name} bị bắt gặp bên ngoài!',
    monsterTargetingLate: '🎯 Quái vật ưu tiên tấn công những người đến muộn!',
    monsterSpawned: '🐉 Quái vật Lv{level}! (Sát thương: {damage}, Máu: {hp})',
    monsterFullyRested: '🐉 Quái vật đã hồi phục và tiếp tục săn mồi!',
    monsterRetreating: '🐉 Quái vật rút lui để hồi máu! (Cam kết hồi đầy)',
    monsterDisengaging: '🐉 Quái vật bỏ mục tiêu!',
    monsterTargeting: '🐉 Quái vật nhắm vào {name}!',
    playerKilled: '{name} đã bị giết!',
    monsterDestroyedBuilding: 'Quái vật phá hủy {type}!',
    monsterHunting: '👹 Quái vật bắt đầu săn mồi!',
  },

  // ============================================
  // UI LABELS - Nhãn giao diện
  // ============================================
  ui: {
    // Top bar
    back: '← Quay lại',
    spawnsIn: '🐉 Xuất hiện sau {time}giây',
    monsterActive: '🐉 Quái vật đang hoạt động!',

    // Player status
    sleeping: '💤 Đang ngủ',
    active: '🏃 Hoạt động',
    dead: '💀 Đã chết',

    // Action buttons
    claimAndSleep: 'Chiếm & Ngủ!',
    sleep: 'Ngủ',
    sleepingPermanently: '💤 Ngủ vĩnh viễn',
    sleepTipUpgrade: '💡 Nhấn vào cửa/giường để nâng cấp!',
    sleepTipDefense: '⚔️ Công trình phòng thủ sẽ bảo vệ bạn',
    followPlayer: '🎯 Theo người chơi',

    // Upgrade modal - Door
    door: '🚪 Cửa',
    doorDestroyed: '💥 Cửa (Bị phá)',
    doorDestroyedDesc: 'Cửa đã bị phá! Xây lại để khôi phục bảo vệ.',
    rebuildDoor: '🔨 Xây lại cửa ({cost}g) → Cấp 1',
    upgradeDoor: '⬆️ Nâng cấp ({cost}g) → +50% máu',
    maxLevel: '✅ Cấp tối đa!',
    repairCooldown: '🔧 Hồi chiêu: {time}giây',
    repairing: '🔧 Đang sửa...',
    fullHp: '✅ Đầy máu',
    repairDoor: '🔧 Sửa (+20% máu trong 7 giây)',
    cancel: 'Hủy',

    // Upgrade modal - Bed
    bed: '🛏️ Giường',
    goldPerSec: 'Vàng/giây: {rate}',
    upgradeBed: '⬆️ Nâng cấp ({cost}g) → {income}g/giây',

    // Upgrade modal - Building
    turretTitle: '🔫 Tháp súng',
    atmTitle: '🏧 Máy ATM',
    soulCollectorTitle: '👻 Máy thu hồn',
    vanguardTitle: '⚔️ Tiên phong',
    upgradeBuilding: '⬆️ Nâng cấp ({cost}g',
    upgradeBuildingSouls: ' + {souls}👻)',
    sellBuilding: '💰 Bán ({refund}g)',
    units: 'đơn vị',

    // Build popup
    buildDefense: '🏗️ Xây phòng thủ',
    turret: 'Tháp súng',
    atm: 'ATM',
    soul: 'Thu hồn',
    vanguard: 'Tiên phong',
    vanguardDesc: 'Tiên phong: Tự động tấn công quái vật! 1 đơn vị cơ bản, +1 mỗi 2 cấp',

    // Game over
    victory: 'Chiến thắng!',
    defeat: 'Thất bại!',
    monsterDefeated: 'Quái vật đã bị đánh bại!',
    youWereKilled: 'Bạn đã bị giết!',
    playAgain: '🔄 Chơi lại',
    home: '🏠 Trang chủ',
  },

  // ============================================
  // BUILDING TYPE NAMES - Tên loại công trình
  // ============================================
  buildingTypes: {
    turret: 'Tháp súng',
    atm: 'Máy ATM',
    soul_collector: 'Máy thu hồn',
    vanguard: 'Tiên phong',
  },

  // ============================================
  // ROOM TYPE NAMES - Tên loại phòng
  // ============================================
  roomTypes: {
    normal: 'Thường',
    armory: 'Kho vũ khí',
    storage: 'Kho chứa',
    bunker: 'Hầm trú ẩn',
  },
}

export type LocaleMessages = typeof vi_VN
export default vi_VN
