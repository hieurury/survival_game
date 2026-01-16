import { ref, readonly } from 'vue'
import type { GameSettings } from '../types/game'

const defaultSettings: GameSettings = {
  musicVolume: 0.3,
  sfxVolume: 0.5,
  musicEnabled: true,
  sfxEnabled: true,
}

const settings = ref<GameSettings>({ ...defaultSettings })

let audioContext: AudioContext | null = null
let bgmOscillator: OscillatorNode | null = null
let bgmGain: GainNode | null = null
let isAudioInitialized = false

export const initAudio = async (): Promise<boolean> => {
  if (isAudioInitialized) return true
  try {
    audioContext = new AudioContext()
    await audioContext.resume()
    isAudioInitialized = true
    return true
  } catch {
    return false
  }
}

export const playSfx = (type: 'coin' | 'hit' | 'attack' | 'build' | 'win' | 'lose' | 'click') => {
  if (!settings.value.sfxEnabled || !audioContext || !isAudioInitialized) return

  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  const now = audioContext.currentTime

  const freqMap: Record<string, number> = {
    coin: 880,
    hit: 220,
    attack: 150,
    build: 440,
    win: 660,
    lose: 110,
    click: 1000,
  }

  const base = freqMap[type] || 440
  oscillator.type = type === 'coin' ? 'sine' : 'triangle'
  oscillator.frequency.setValueAtTime(base, now)
  oscillator.frequency.exponentialRampToValueAtTime(base * 0.6, now + 0.15)

  const vol = settings.value.sfxVolume * 0.3
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.25)
}

export const startBgm = () => {
  if (!settings.value.musicEnabled || !audioContext || bgmOscillator) return

  bgmOscillator = audioContext.createOscillator()
  bgmGain = audioContext.createGain()
  bgmOscillator.type = 'sine'
  bgmOscillator.frequency.value = 110
  bgmGain.gain.value = settings.value.musicVolume * 0.1
  bgmOscillator.connect(bgmGain).connect(audioContext.destination)
  bgmOscillator.start()
}

export const stopBgm = () => {
  if (bgmOscillator) {
    bgmOscillator.stop()
    bgmOscillator.disconnect()
    bgmOscillator = null
  }
  if (bgmGain) {
    bgmGain.disconnect()
    bgmGain = null
  }
}

export const updateMusicVolume = (volume: number) => {
  settings.value.musicVolume = volume
  if (bgmGain) {
    bgmGain.gain.value = volume * 0.1
  }
}

export const updateSfxVolume = (volume: number) => {
  settings.value.sfxVolume = volume
}

export const toggleMusic = (enabled: boolean) => {
  settings.value.musicEnabled = enabled
  if (enabled) {
    startBgm()
  } else {
    stopBgm()
  }
}

export const toggleSfx = (enabled: boolean) => {
  settings.value.sfxEnabled = enabled
}

export const cleanupAudio = () => {
  stopBgm()
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  isAudioInitialized = false
}

export const useAudio = () => ({
  settings: readonly(settings),
  initAudio,
  playSfx,
  startBgm,
  stopBgm,
  updateMusicVolume,
  updateSfxVolume,
  toggleMusic,
  toggleSfx,
  cleanupAudio,
})
