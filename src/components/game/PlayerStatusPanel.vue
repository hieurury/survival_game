<script setup lang="ts">
/**
 * Player Status Panel Component
 * Displays player stats (HP, Gold, Damage, Attack Range)
 */
import { computed } from 'vue'

interface PlayerStatus {
  id: number
  name: string
  hp: number
  maxHp: number
  gold: number
  damage: number
  attackRange: number
  alive: boolean
  isSleeping: boolean
  isBot?: boolean
}

const props = defineProps<{
  players: PlayerStatus[]
  currentPlayerId: number
}>()

const emit = defineEmits<{
  selectPlayer: [id: number]
}>()

const currentPlayer = computed(() => 
  props.players.find(p => p.id === props.currentPlayerId)
)

const otherPlayers = computed(() =>
  props.players.filter(p => p.id !== props.currentPlayerId)
)

function getHpColor(hp: number, maxHp: number): string {
  const ratio = hp / maxHp
  if (ratio > 0.6) return '#22c55e'
  if (ratio > 0.3) return '#eab308'
  return '#ef4444'
}

function getHpBarWidth(hp: number, maxHp: number): string {
  return `${Math.max(0, (hp / maxHp) * 100)}%`
}
</script>

<template>
  <div class="player-status-panel">
    <!-- Current Player -->
    <div v-if="currentPlayer" class="current-player">
      <div class="player-avatar main" @click="emit('selectPlayer', currentPlayer.id)">
        <div class="avatar-circle">
          <span class="avatar-icon">👤</span>
          <span v-if="currentPlayer.isSleeping" class="sleep-indicator">💤</span>
        </div>
        <div class="player-info">
          <div class="player-name">{{ currentPlayer.name }}</div>
          <div class="hp-bar">
            <div 
              class="hp-fill"
              :style="{
                width: getHpBarWidth(currentPlayer.hp, currentPlayer.maxHp),
                backgroundColor: getHpColor(currentPlayer.hp, currentPlayer.maxHp)
              }"
            ></div>
            <span class="hp-text">{{ currentPlayer.hp }}/{{ currentPlayer.maxHp }}</span>
          </div>
        </div>
      </div>
      
      <div class="stats-row">
        <div class="stat">
          <span class="stat-icon">💰</span>
          <span class="stat-value">{{ currentPlayer.gold }}</span>
        </div>
        <div class="stat">
          <span class="stat-icon">⚔️</span>
          <span class="stat-value">{{ currentPlayer.damage }}</span>
        </div>
        <div class="stat">
          <span class="stat-icon">🎯</span>
          <span class="stat-value">{{ currentPlayer.attackRange }}</span>
        </div>
      </div>
    </div>
    
    <!-- Other Players (Bots) -->
    <div v-if="otherPlayers.length > 0" class="other-players">
      <div 
        v-for="player in otherPlayers" 
        :key="player.id"
        class="player-avatar mini"
        :class="{ dead: !player.alive }"
        @click="emit('selectPlayer', player.id)"
      >
        <div class="avatar-circle small">
          <span class="avatar-icon">🤖</span>
          <span v-if="player.isSleeping" class="sleep-indicator small">💤</span>
        </div>
        <div class="mini-hp-bar">
          <div 
            class="hp-fill"
            :style="{
              width: getHpBarWidth(player.hp, player.maxHp),
              backgroundColor: getHpColor(player.hp, player.maxHp)
            }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-status-panel {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.current-player {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 12px;
  min-width: 200px;
}

.player-avatar {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}

.player-avatar:hover {
  transform: scale(1.02);
}

.player-avatar.mini {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px;
  gap: 8px;
}

.player-avatar.dead {
  opacity: 0.5;
  filter: grayscale(100%);
}

.avatar-circle {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.avatar-circle.small {
  width: 32px;
  height: 32px;
}

.avatar-icon {
  font-size: 20px;
}

.avatar-circle.small .avatar-icon {
  font-size: 14px;
}

.sleep-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 16px;
  animation: float 1.5s ease-in-out infinite;
}

.sleep-indicator.small {
  font-size: 12px;
  top: -4px;
  right: -4px;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.player-info {
  flex: 1;
}

.player-name {
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.hp-bar {
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.mini-hp-bar {
  width: 60px;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.hp-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: inherit;
}

.hp-text {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  color: #ffffff;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.stats-row {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-icon {
  font-size: 14px;
}

.stat-value {
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
}

.other-players {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 250px;
}
</style>
