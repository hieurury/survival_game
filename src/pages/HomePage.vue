<script setup lang="ts">
import { ref } from 'vue'
import { playSfx } from '../composables/useAudio'
import { ASSET_SOURCES } from '../composables/useAssets'
import { useGameState } from '../composables/useGameState'
import type { DifficultyLevel } from '../game/config/difficulty'

const emit = defineEmits<{
  (e: 'start-game'): void
}>()

const { selectedDifficulty: _selectedDifficulty, setDifficulty, availableDifficulties } = useGameState()

const showSettings = ref(false)
const showAssetGuide = ref(false)
const showHowToPlay = ref(false)
const showDifficultySelect = ref(false)

const handleStart = () => {
  playSfx('click')
  showDifficultySelect.value = true
}

const selectDifficultyAndStart = (level: DifficultyLevel) => {
  setDifficulty(level)
  playSfx('click')
  showDifficultySelect.value = false
  emit('start-game')
}

const closeAllPopups = () => {
  showSettings.value = false
  showAssetGuide.value = false
  showHowToPlay.value = false
  showDifficultySelect.value = false
}

const openSettings = () => {
  closeAllPopups()
  showSettings.value = true
  playSfx('click')
}

const openAssetGuide = () => {
  closeAllPopups()
  showAssetGuide.value = true
  playSfx('click')
}

const openHowToPlay = () => {
  closeAllPopups()
  showHowToPlay.value = true
  playSfx('click')
}
</script>

<template>
  <div class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-950">
    <!-- Background atmosphere -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,0,0,0.15),_transparent_50%)]"></div>
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,0,0,0.8),_transparent_70%)]"></div>
    
    <!-- Animated fog effect -->
    <div class="pointer-events-none absolute inset-0 opacity-30">
      <div class="animate-fog absolute h-full w-[200%] bg-gradient-to-r from-transparent via-neutral-800/20 to-transparent"></div>
    </div>

    <!-- Main content -->
    <div class="relative z-10 flex flex-col items-center gap-8 px-4">
      <!-- Logo/Title -->
      <div class="text-center">
        <div class="mb-4 text-6xl">🏚️</div>
        <h1 class="font-serif text-5xl font-bold tracking-tight text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)] md:text-6xl">
          Dream Knight
        </h1>
        <p class="mt-3 text-lg text-neutral-400">Trong giấc mơ, ai mới là kẻ săn mồi!</p>
      </div>

      <!-- Menu buttons -->
      <div class="flex flex-col gap-3">
        <button
          class="group relative w-64 overflow-hidden rounded-lg border-2 border-red-900/50 bg-red-950/80 px-8 py-4 font-bold uppercase tracking-wider text-red-100 shadow-lg shadow-red-950/50 transition-all hover:border-red-700 hover:bg-red-900/80 hover:shadow-red-900/50"
          @click="handleStart"
        >
          <span class="relative z-10">▶ Bắt đầu</span>
          <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-red-500/20 to-transparent transition-transform group-hover:translate-x-full"></div>
        </button>

        <button
          class="w-64 rounded-lg border border-neutral-700 bg-neutral-900/80 px-8 py-3 font-medium text-neutral-300 transition-all hover:border-neutral-500 hover:bg-neutral-800"
          @click="openHowToPlay"
        >
          📖 Cách chơi
        </button>

        <button
          class="w-64 rounded-lg border border-neutral-700 bg-neutral-900/80 px-8 py-3 font-medium text-neutral-300 transition-all hover:border-neutral-500 hover:bg-neutral-800"
          @click="openSettings"
        >
          ⚙️ Cài đặt
        </button>

        <button
          class="w-64 rounded-lg border border-neutral-700 bg-neutral-900/80 px-8 py-3 font-medium text-neutral-300 transition-all hover:border-neutral-500 hover:bg-neutral-800"
          @click="openAssetGuide"
        >
          📦 Tài nguyên
        </button>
      </div>

      <!-- Version -->
      <p class="text-xs text-neutral-600">v1.0.0 • PWA Offline Ready</p>
    </div>

    <!-- POPUP: How to Play -->
    <Transition name="popup">
      <div v-if="showHowToPlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" @click.self="closeAllPopups">
        <div class="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
          <button class="absolute right-4 top-4 text-2xl text-neutral-500 hover:text-white" @click="closeAllPopups">✕</button>
          
          <h2 class="mb-4 text-center font-serif text-2xl font-bold text-red-500">Cách chơi</h2>
          
          <div class="space-y-4 text-sm text-neutral-300">
            <div class="rounded-lg bg-neutral-800/50 p-3">
              <p class="font-bold text-amber-400">🌙 Mục tiêu</p>
              <p class="mt-1">Sống sót qua các đêm. Quái vật sẽ tấn công phòng có cửa yếu nhất.</p>
            </div>
            
            <div class="rounded-lg bg-neutral-800/50 p-3">
              <p class="font-bold text-amber-400">💰 Tài nguyên</p>
              <p class="mt-1">Ngủ để nhận vàng mỗi đêm. Dùng vàng để nâng cấp và sửa chữa.</p>
            </div>
            
            <div class="rounded-lg bg-neutral-800/50 p-3">
              <p class="font-bold text-amber-400">🚪 Phòng thủ</p>
              <p class="mt-1">Nâng cấp cửa để tăng máu và giảm sát thương. Xây trụ để tấn công quái.</p>
            </div>
            
            <div class="rounded-lg bg-neutral-800/50 p-3">
              <p class="font-bold text-amber-400">👹 Quái vật</p>
              <p class="mt-1">Mỗi 5 đêm quái sẽ đổi mục tiêu. Tiêu diệt quái để chiến thắng!</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP: Settings -->
    <Transition name="popup">
      <div v-if="showSettings" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" @click.self="closeAllPopups">
        <div class="relative w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
          <button class="absolute right-4 top-4 text-2xl text-neutral-500 hover:text-white" @click="closeAllPopups">✕</button>
          
          <h2 class="mb-6 text-center font-serif text-2xl font-bold text-red-500">Cài đặt</h2>
          
          <div class="space-y-6">
            <div>
              <div class="mb-2 flex items-center justify-between">
                <span class="text-neutral-300">🔊 Nhạc nền</span>
                <span class="text-xs text-neutral-500">Coming soon</span>
              </div>
              <input type="range" min="0" max="100" value="50" class="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-700 accent-red-500" disabled />
            </div>
            
            <div>
              <div class="mb-2 flex items-center justify-between">
                <span class="text-neutral-300">🔔 Hiệu ứng</span>
                <span class="text-xs text-neutral-500">Coming soon</span>
              </div>
              <input type="range" min="0" max="100" value="70" class="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-700 accent-red-500" disabled />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP: Difficulty Selection -->
    <Transition name="popup">
      <div v-if="showDifficultySelect" class="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 p-2 sm:p-4 overflow-y-auto" @click.self="closeAllPopups">
        <div class="relative w-full max-w-2xl rounded-2xl border border-neutral-700 bg-neutral-900 p-4 sm:p-6 shadow-2xl my-4 sm:my-0">
          <button class="absolute right-3 top-3 sm:right-4 sm:top-4 text-xl sm:text-2xl text-neutral-500 hover:text-white z-10" @click="closeAllPopups">✕</button>
          
          <h2 class="mb-1 sm:mb-2 text-center font-serif text-xl sm:text-2xl font-bold text-red-500">Chọn độ khó</h2>
          <p class="mb-4 sm:mb-6 text-center text-xs sm:text-sm text-neutral-400">Độ khó ảnh hưởng đến tài nguyên, số lượng quái và kích thước bản đồ</p>
          
          <div class="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <button
              v-for="diff in availableDifficulties"
              :key="diff.id"
              class="group relative flex flex-col overflow-hidden rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02]"
              :class="{
                'border-green-600/50 bg-green-950/30 hover:border-green-500 hover:bg-green-900/40': diff.id === 'easy',
                'border-amber-600/50 bg-amber-950/30 hover:border-amber-500 hover:bg-amber-900/40': diff.id === 'normal',
                'border-red-600/50 bg-red-950/30 hover:border-red-500 hover:bg-red-900/40': diff.id === 'hard',
              }"
              @click="selectDifficultyAndStart(diff.id)"
            >
              <!-- Header -->
              <div class="mb-3 flex items-center gap-2">
                <span class="text-2xl">
                  {{ diff.id === 'easy' ? '🌱' : diff.id === 'normal' ? '⚔️' : '💀' }}
                </span>
                <span class="text-lg font-bold" :class="{
                  'text-green-400': diff.id === 'easy',
                  'text-amber-400': diff.id === 'normal',
                  'text-red-400': diff.id === 'hard',
                }">{{ diff.name }}</span>
              </div>

              <!-- Stats Grid -->
              <div class="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1.5">
                  <span class="text-neutral-400">🏠</span>
                  <span class="text-neutral-300">{{ diff.map.roomCount }} phòng</span>
                </div>
                <div class="flex items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1.5">
                  <span class="text-neutral-400">🤖</span>
                  <span class="text-neutral-300">{{ diff.player.botCount }} bot</span>
                </div>
                <div class="flex items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1.5">
                  <span class="text-neutral-400">👹</span>
                  <span class="text-neutral-300">{{ diff.monster.count }} quái</span>
                </div>
                <div class="flex items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1.5">
                  <span class="text-neutral-400">💰</span>
                  <span class="text-neutral-300">{{ diff.player.startingGold }} vàng</span>
                </div>
              </div>

              <!-- Healing Points Info -->
              <div class="rounded-lg bg-black/20 p-2 text-xs">
                <div class="mb-1 flex items-center gap-1 text-purple-400">
                  <span>✨</span>
                  <span class="font-medium">Điểm hồi phục quái</span>
                </div>
                <div class="grid grid-cols-2 gap-1 text-neutral-400">
                  <span>{{ diff.healingPoints.count }} điểm</span>
                  <span>{{ diff.healingPoints.maxMana }} mana</span>
                  <span class="col-span-2">Hồi {{ diff.healingPoints.manaRegenRate }} mana/s</span>
                </div>
              </div>

              <!-- Recommended Badge -->
              <div v-if="diff.id === 'easy'" class="mt-3 rounded-full bg-green-600/30 px-2 py-0.5 text-center text-xs font-medium text-green-400">
                Khuyến nghị cho người mới
              </div>
              <div v-else-if="diff.id === 'normal'" class="mt-3 rounded-full bg-amber-600/30 px-2 py-0.5 text-center text-xs font-medium text-amber-400">
                Trải nghiệm cân bằng
              </div>
              <div v-else class="mt-3 rounded-full bg-red-600/30 px-2 py-0.5 text-center text-xs font-medium text-red-400">
                Dành cho người thích thử thách
              </div>
              
              <!-- Hover effect -->
              <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform group-hover:translate-x-full"></div>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP: Asset Guide -->
    <Transition name="popup">
      <div v-if="showAssetGuide" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" @click.self="closeAllPopups">
        <div class="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
          <button class="absolute right-4 top-4 text-2xl text-neutral-500 hover:text-white" @click="closeAllPopups">✕</button>
          
          <h2 class="mb-4 text-center font-serif text-2xl font-bold text-red-500">Tài nguyên Game</h2>
          
          <div class="mb-4 rounded-lg bg-neutral-800/50 p-3 text-sm text-neutral-300">
            <p class="font-bold text-amber-400">📁 Thư mục asset:</p>
            <ul class="mt-2 space-y-1 font-mono text-xs">
              <li>• src/assets/character/</li>
              <li>• src/assets/monster/</li>
              <li>• src/assets/structor/</li>
              <li>• src/assets/items/</li>
            </ul>
          </div>
          
          <p class="mb-3 text-sm font-bold text-neutral-400">Nguồn sprite miễn phí:</p>
          <div class="space-y-2">
            <a
              v-for="source in ASSET_SOURCES"
              :key="source.url"
              :href="source.url"
              target="_blank"
              class="block rounded-lg border border-neutral-700 bg-neutral-800/50 p-3 transition hover:border-red-700 hover:bg-neutral-800"
            >
              <span class="font-medium text-red-400">{{ source.name }}</span>
              <p class="mt-1 text-xs text-neutral-500">{{ source.description }}</p>
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

@keyframes fog {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0%); }
}
.animate-fog {
  animation: fog 20s linear infinite;
}
</style>
