<script setup lang="ts">
/**
 * Action Buttons Component
 * Quick action buttons (Sleep, Build, etc.)
 */
const props = defineProps<{
  isSleeping: boolean
  canSleep: boolean
  showBuildMenu: boolean
}>()

const emit = defineEmits<{
  toggleSleep: []
  toggleBuild: []
}>()
</script>

<template>
  <div class="action-buttons">
    <button
      class="action-btn sleep-btn"
      :class="{ active: isSleeping, disabled: !canSleep }"
      :disabled="!canSleep"
      @click="emit('toggleSleep')"
    >
      <span class="btn-icon">{{ isSleeping ? '☀️' : '😴' }}</span>
      <span class="btn-label">{{ isSleeping ? 'Thức dậy' : 'Ngủ' }}</span>
    </button>
    
    <button
      class="action-btn build-btn"
      :class="{ active: showBuildMenu }"
      @click="emit('toggleBuild')"
    >
      <span class="btn-icon">🏗️</span>
      <span class="btn-label">Xây dựng</span>
    </button>
  </div>
</template>

<style scoped>
    
.action-buttons {
  position: fixed;
  bottom: 16px;
  left: 16px;
  display: flex;
  gap: 10px;
  z-index: 100;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 72px;
  height: 72px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover:not(.disabled) {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.9);
}

.action-btn.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.2);
}

.action-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sleep-btn.active {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.2);
}

.btn-icon {
  font-size: 24px;
}

.btn-label {
  color: #ffffff;
  font-size: 11px;
  font-weight: 500;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .action-btn {
    width: 64px;
    height: 64px;
  }
  
  .btn-icon {
    font-size: 20px;
  }
  
  .btn-label {
    font-size: 10px;
  }
}
</style>
