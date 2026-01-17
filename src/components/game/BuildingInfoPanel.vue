<script setup lang="ts">
/**
 * Building Info Panel Component
 * Shows selected building details and upgrade options
 */
import { computed } from 'vue'

interface BuildingInfo {
  type: string
  gridX: number
  gridY: number
  hp: number
  maxHp: number
  level: number
  baseDamage?: number
  baseRange?: number
  healAmount?: number
  healRange?: number
}

const props = defineProps<{
  building: BuildingInfo | null
  upgradeCost: number
  playerGold: number
  canUpgrade: boolean
}>()

const emit = defineEmits<{
  upgrade: []
  close: []
}>()

const buildingNames: Record<string, string> = {
  wall: 'Tường',
  turret: 'Turret',
  heal_station: 'Trạm hồi máu',
  spawn_point: 'Spawn Point',
  vanguard_station: 'Vanguard Station',
}

const buildingIcons: Record<string, string> = {
  wall: '🧱',
  turret: '🔫',
  heal_station: '💊',
  spawn_point: '🌀',
  vanguard_station: '🛡️',
}

const hpPercentage = computed(() => {
  if (!props.building) return 0
  return Math.max(0, (props.building.hp / props.building.maxHp) * 100)
})

const hpColor = computed(() => {
  const ratio = hpPercentage.value / 100
  if (ratio > 0.6) return '#22c55e'
  if (ratio > 0.3) return '#eab308'
  return '#ef4444'
})

const canAffordUpgrade = computed(() => {
  return props.playerGold >= props.upgradeCost
})
</script>

<template>
  <Transition name="slide-right">
    <div v-if="building" class="building-info-panel">
      <div class="panel-header">
        <div class="building-icon">{{ buildingIcons[building.type] || '🏠' }}</div>
        <div class="building-title">
          <h3>{{ buildingNames[building.type] || building.type }}</h3>
          <span class="level-badge">Lv.{{ building.level }}</span>
        </div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>
      
      <div class="panel-body">
        <!-- HP Bar -->
        <div class="stat-section">
          <div class="stat-label">
            <span>❤️ HP</span>
            <span>{{ building.hp }} / {{ building.maxHp }}</span>
          </div>
          <div class="hp-bar">
            <div 
              class="hp-fill"
              :style="{ width: `${hpPercentage}%`, backgroundColor: hpColor }"
            ></div>
          </div>
        </div>
        
        <!-- Building Stats -->
        <div class="stats-grid">
          <div v-if="building.baseDamage" class="stat-item">
            <span class="stat-icon">⚔️</span>
            <span class="stat-value">{{ building.baseDamage }}</span>
            <span class="stat-name">Sát thương</span>
          </div>
          
          <div v-if="building.baseRange" class="stat-item">
            <span class="stat-icon">🎯</span>
            <span class="stat-value">{{ building.baseRange }}</span>
            <span class="stat-name">Tầm bắn</span>
          </div>
          
          <div v-if="building.healAmount" class="stat-item">
            <span class="stat-icon">💚</span>
            <span class="stat-value">{{ building.healAmount }}</span>
            <span class="stat-name">Hồi máu</span>
          </div>
          
          <div v-if="building.healRange" class="stat-item">
            <span class="stat-icon">📍</span>
            <span class="stat-value">{{ building.healRange }}</span>
            <span class="stat-name">Tầm hồi</span>
          </div>
        </div>
        
        <!-- Position -->
        <div class="position-info">
          📍 Vị trí: ({{ building.gridX }}, {{ building.gridY }})
        </div>
      </div>
      
      <div class="panel-footer">
        <button
          class="upgrade-btn"
          :class="{ disabled: !canUpgrade || !canAffordUpgrade }"
          :disabled="!canUpgrade || !canAffordUpgrade"
          @click="emit('upgrade')"
        >
          <span class="btn-icon">⬆️</span>
          <span class="btn-text">Nâng cấp</span>
          <span class="btn-cost">💰 {{ upgradeCost }}</span>
        </button>
        
        <div v-if="!canAffordUpgrade" class="warning-text">
          Không đủ vàng!
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.building-info-panel {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 16px;
  min-width: 280px;
  z-index: 200;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.building-icon {
  font-size: 32px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.building-title {
  flex: 1;
}

.building-title h3 {
  margin: 0;
  color: #ffffff;
  font-size: 16px;
}

.level-badge {
  font-size: 12px;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
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

.panel-body {
  margin-bottom: 16px;
}

.stat-section {
  margin-bottom: 16px;
}

.stat-label {
  display: flex;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  margin-bottom: 6px;
}

.hp-bar {
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

.hp-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: inherit;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.stat-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}

.stat-icon {
  font-size: 18px;
  display: block;
  margin-bottom: 4px;
}

.stat-value {
  color: #ffffff;
  font-weight: 700;
  font-size: 18px;
  display: block;
}

.stat-name {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

.position-info {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  text-align: center;
}

.panel-footer {
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.upgrade-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 10px;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.upgrade-btn:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.upgrade-btn.disabled {
  background: #4b5563;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-icon {
  font-size: 16px;
}

.btn-text {
  flex: 1;
}

.btn-cost {
  color: #fbbf24;
  font-size: 13px;
}

.warning-text {
  color: #ef4444;
  font-size: 12px;
  text-align: center;
  margin-top: 8px;
}

/* Animations */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(20px);
}
</style>
