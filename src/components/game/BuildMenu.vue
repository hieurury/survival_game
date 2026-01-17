<script setup lang="ts">
/**
 * Build Menu Component
 * Shows available buildings for construction
 */

interface BuildOption {
  type: string
  name: string
  cost: number
  icon: string
  description: string
}

const props = defineProps<{
  visible: boolean
  playerGold: number
  selectedType: string | null
}>()

const emit = defineEmits<{
  select: [type: string]
  close: []
}>()

const buildOptions: BuildOption[] = [
  {
    type: 'wall',
    name: 'Tường',
    cost: 50,
    icon: '🧱',
    description: 'Chặn quái vật, bảo vệ căn cứ',
  },
  {
    type: 'turret',
    name: 'Turret',
    cost: 100,
    icon: '🔫',
    description: 'Tự động bắn quái trong tầm',
  },
  {
    type: 'heal_station',
    name: 'Trạm hồi máu',
    cost: 150,
    icon: '💊',
    description: 'Hồi máu cho người chơi gần đó',
  },
  {
    type: 'spawn_point',
    name: 'Spawn Point',
    cost: 200,
    icon: '🌀',
    description: 'Điểm hồi sinh khi chết',
  },
  {
    type: 'vanguard_station',
    name: 'Vanguard Station',
    cost: 300,
    icon: '🛡️',
    description: 'Triệu hồi lính tự động chiến đấu',
  },
]

function canAfford(cost: number): boolean {
  return props.playerGold >= cost
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="build-menu">
      <div class="menu-header">
        <h3>🏗️ Xây dựng</h3>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>
      
      <div class="build-options">
        <div
          v-for="option in buildOptions"
          :key="option.type"
          class="build-option"
          :class="{
            selected: selectedType === option.type,
            disabled: !canAfford(option.cost)
          }"
          @click="canAfford(option.cost) && emit('select', option.type)"
        >
          <div class="option-icon">{{ option.icon }}</div>
          <div class="option-info">
            <div class="option-name">{{ option.name }}</div>
            <div class="option-desc">{{ option.description }}</div>
          </div>
          <div class="option-cost" :class="{ unaffordable: !canAfford(option.cost) }">
            💰 {{ option.cost }}
          </div>
        </div>
      </div>
      
      <div class="menu-footer">
        <span class="gold-display">💰 {{ playerGold }}</span>
        <span class="hint">Chọn vị trí trên bản đồ để xây</span>
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
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 16px;
  min-width: 400px;
  max-width: 90vw;
  z-index: 200;
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.menu-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 16px;
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

.build-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.build-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
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
  font-size: 28px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.option-info {
  flex: 1;
}

.option-name {
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 2px;
}

.option-desc {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.option-cost {
  color: #fbbf24;
  font-weight: 600;
  font-size: 14px;
  padding: 6px 10px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 6px;
}

.option-cost.unaffordable {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.menu-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.gold-display {
  color: #fbbf24;
  font-weight: 600;
  font-size: 16px;
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
</style>
