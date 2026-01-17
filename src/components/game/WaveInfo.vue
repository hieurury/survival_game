<script setup lang="ts">
/**
 * Wave Info Component
 * Displays current wave status and countdown
 */
import { computed } from 'vue'

const props = defineProps<{
  currentWave: number
  monstersAlive: number
  totalMonsters: number
  countdown: number
  isWaveActive: boolean
}>()

const progressPercentage = computed(() => {
  if (props.totalMonsters === 0) return 100
  return ((props.totalMonsters - props.monstersAlive) / props.totalMonsters) * 100
})

const formattedCountdown = computed(() => {
  const seconds = Math.ceil(props.countdown)
  return `${seconds}s`
})
</script>

<template>
  <div class="wave-info">
    <div class="wave-header">
      <span class="wave-icon">🌊</span>
      <span class="wave-number">Wave {{ currentWave }}</span>
    </div>
    
    <div v-if="isWaveActive" class="wave-progress">
      <div class="progress-bar">
        <div 
          class="progress-fill"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
      <div class="monster-count">
        <span class="monster-icon">👹</span>
        <span>{{ monstersAlive }} / {{ totalMonsters }}</span>
      </div>
    </div>
    
    <div v-else class="wave-countdown">
      <span class="countdown-label">Làn sóng tiếp theo:</span>
      <span class="countdown-time">{{ formattedCountdown }}</span>
    </div>
  </div>
</template>

<style scoped>
.wave-info {
  position: fixed;
  top: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 180px;
  z-index: 100;
}

.wave-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.wave-icon {
  font-size: 20px;
}

.wave-number {
  color: #ffffff;
  font-weight: 700;
  font-size: 18px;
}

.wave-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  transition: width 0.3s ease;
  border-radius: inherit;
}

.monster-count {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.monster-icon {
  font-size: 14px;
}

.wave-countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.countdown-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.countdown-time {
  color: #fbbf24;
  font-weight: 700;
  font-size: 24px;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
