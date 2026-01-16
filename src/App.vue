<script setup lang="ts">
import { ref, onMounted } from 'vue'
import HomePage from './pages/HomePage.vue'
import GamePage from './pages/GamePage.vue'
import { initAssets } from './composables/useAssets'

type Page = 'home' | 'game'

const currentPage = ref<Page>('home')

const navigateToGame = () => {
  currentPage.value = 'game'
}

const navigateToHome = () => {
  currentPage.value = 'home'
}

onMounted(() => {
  initAssets()
})
</script>

<template>
  <Transition name="page" mode="out-in">
    <HomePage v-if="currentPage === 'home'" @start-game="navigateToGame" />
    <GamePage v-else @back-home="navigateToHome" />
  </Transition>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
