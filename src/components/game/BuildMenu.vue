<script setup lang="ts">
/**
 * Build Menu Component
 * Shows available buildings for construction organized by category
 * Mua bằng VÀNG (trừ ATM dùng LINH HỒN)
 * Nâng cấp Lv5+ cần thêm LINH HỒN
 */

import { PURCHASE_COSTS, SOUL_PURCHASE_COSTS, SOUL_COSTS_LV5 } from '../../game/config/gameModeConfig'

interface BuildOption {
  type: string
  name: string
  cost: number
  currency: 'gold' | 'souls'
  soulCostLv5: number // Soul cost from level 5
  icon: string
  description: string
}

interface BuildCategory {
  name: string
  icon: string
  items: BuildOption[]
}

const props = defineProps<{
  visible: boolean
  playerGold: number
  playerSouls: number
  selectedType: string | null
}>()

const emit = defineEmits<{
  select: [type: string]
  close: []
}>()

// Danh mục các công trình (Door và Bed là phần của Room, không xây riêng)
// Mua bằng VÀNG (trừ ATM dùng LINH HỒN)
// Nâng cấp từ Lv5 cần thêm LINH HỒN
const buildCategories: BuildCategory[] = [
  {
    name: 'Phòng thủ',
    icon: '🛡️',
    items: [
      {
        type: 'turret',
        name: 'Súng tự động',
        cost: PURCHASE_COSTS.turret,
        currency: 'gold',
        soulCostLv5: SOUL_COSTS_LV5.turret,
        icon: '🔫',
        description: 'Tự động bắn quái trong tầm',
      },
      {
        type: 'smg',
        name: 'Tiểu liên',
        cost: PURCHASE_COSTS.smg,
        currency: 'gold',
        soulCostLv5: SOUL_COSTS_LV5.smg,
        icon: '🔥',
        description: 'Bắn liên thanh, sát thương cao',
      },
      {
        type: 'vanguard',
        name: 'Lính tiên phong',
        cost: PURCHASE_COSTS.vanguard,
        currency: 'gold',
        soulCostLv5: SOUL_COSTS_LV5.vanguard,
        icon: '⚔️',
        description: 'Lính tự động chiến đấu',
      },
    ]
  },
  {
    name: 'Kinh tế',
    icon: '💰',
    items: [
      {
        type: 'atm',
        name: 'Máy ATM',
        cost: SOUL_PURCHASE_COSTS.atm, // ATM mua bằng LINH HỒN
        currency: 'souls',
        soulCostLv5: SOUL_PURCHASE_COSTS.atm, // Nâng cấp cũng dùng souls (gấp đôi)
        icon: '🏧',
        description: 'Sinh vàng tự động (mua bằng 👻)',
      },
      {
        type: 'soul_collector',
        name: 'Máy thu hồn',
        cost: PURCHASE_COSTS.soul_collector,
        currency: 'gold',
        soulCostLv5: SOUL_COSTS_LV5.soul_collector,
        icon: '👻',
        description: 'Thu thập linh hồn tự động',
      },
    ]
  },
]

function canAfford(cost: number, currency: 'gold' | 'souls'): boolean {
  if (currency === 'gold') {
    return props.playerGold >= cost
  }
  return props.playerSouls >= cost
}

function getCurrencyIcon(currency: 'gold' | 'souls'): string {
  return currency === 'gold' ? '💰' : '👻'
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="build-menu">
      <div class="menu-header">
        <h3>🏗️ Xây dựng</h3>
        <div class="resources">
          <span class="gold">💰 {{ playerGold }}</span>
          <span class="souls">👻 {{ playerSouls }}</span>
        </div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>
      
      <div class="build-categories">
        <div v-for="category in buildCategories" :key="category.name" class="category">
          <div class="category-header">
            <span class="category-icon">{{ category.icon }}</span>
            <span class="category-name">{{ category.name }}</span>
          </div>
          
          <div class="category-items">
            <div
              v-for="option in category.items"
              :key="option.type"
              class="build-option"
              :class="{
                selected: selectedType === option.type,
                disabled: !canAfford(option.cost, option.currency)
              }"
              @click="canAfford(option.cost, option.currency) && emit('select', option.type)"
            >
              <div class="option-icon">{{ option.icon }}</div>
              <div class="option-info">
                <div class="option-name">{{ option.name }}</div>
                <div class="option-desc">{{ option.description }}</div>
              </div>
              <div class="option-costs">
                <div class="option-cost" :class="{ unaffordable: !canAfford(option.cost, option.currency) }">
                  {{ getCurrencyIcon(option.currency) }} {{ option.cost }}
                </div>
                <div class="option-soul-cost">Lv5+: {{ option.soulCostLv5 }}👻</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="menu-footer">
        <span class="hint">Mua bằng vàng 💰 • Nâng cấp Lv5+ cần thêm linh hồn 👻</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.build-menu {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 16px;
  min-width: 480px;
  max-width: 90vw;
  max-height: 70vh;
  overflow-y: auto;
  z-index: 200;
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  gap: 16px;
}

.menu-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 16px;
}

.resources {
  display: flex;
  gap: 16px;
  flex: 1;
  justify-content: center;
}

.resources .gold {
  color: #fbbf24;
  font-weight: 600;
  font-size: 14px;
}

.resources .souls {
  color: #a78bfa;
  font-weight: 600;
  font-size: 14px;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.build-categories {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 12px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.category-icon {
  font-size: 18px;
}

.category-name {
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.category-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.build-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.build-option:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(59, 130, 246, 0.5);
}

.build-option.selected {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
}

.build-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  flex-shrink: 0;
}

.option-info {
  flex: 1;
  min-width: 0;
}

.option-name {
  color: #ffffff;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
}

.option-desc {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-costs {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.option-cost {
  color: #fbbf24;
  font-weight: 600;
  font-size: 13px;
  padding: 4px 8px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 6px;
  white-space: nowrap;
}

.option-cost.unaffordable {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.option-soul-cost {
  color: rgba(167, 139, 250, 0.7);
  font-size: 10px;
  white-space: nowrap;
}

.menu-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

/* Animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Scrollbar styling */
.build-menu::-webkit-scrollbar {
  width: 6px;
}

.build-menu::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.build-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.build-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
