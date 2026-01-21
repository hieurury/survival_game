<script setup lang="ts">
/**
 * Game Icons Component
 * Using Lucide Icons library for professional game UI
 */
import {
  Coins,
  Ghost,
  Heart,
  Skull,
  Moon,
  Timer,
  BedDouble,
  Crosshair,
  Flame,
  Sword,
  Landmark,
  Sparkles,
  DoorOpen,
  User,
  Bot,
  Zap,
  Target,
  Shield,
  CircleDollarSign,
  Clock,
  Activity,
  Trash2,
  Users,
  Settings
} from 'lucide-vue-next'

defineProps<{
  name: string
  size?: number | string
  class?: string
}>()

// Map icon names to components and default colors
const iconConfig: Record<string, { component: any; color: string }> = {
  gold: { component: Coins, color: '#FBBF24' },
  soul: { component: Ghost, color: '#A78BFA' },
  heart: { component: Heart, color: '#EF4444' },
  health: { component: Heart, color: '#EF4444' },
  monster: { component: Skull, color: '#FECACA' },  // Light red/pink for visibility
  skull: { component: Skull, color: '#9CA3AF' },    // Lighter gray
  sleep: { component: Moon, color: '#60A5FA' },
  timer: { component: Timer, color: '#F59E0B' },
  bed: { component: BedDouble, color: '#D97706' },
  turret: { component: Crosshair, color: '#3B82F6' },
  smg: { component: Flame, color: '#F97316' },
  vanguard: { component: Sword, color: '#6366F1' },
  atm: { component: Landmark, color: '#10B981' },
  collector: { component: Sparkles, color: '#8B5CF6' },
  door: { component: DoorOpen, color: '#92400E' },
  player: { component: User, color: '#60A5FA' },
  bot: { component: Bot, color: '#22C55E' },
  active: { component: Zap, color: '#FBBF24' },
  target: { component: Target, color: '#EF4444' },
  shield: { component: Shield, color: '#3B82F6' },
  money: { component: CircleDollarSign, color: '#10B981' },
  clock: { component: Clock, color: '#F59E0B' },
  hp: { component: Activity, color: '#EF4444' },
  trash: { component: Trash2, color: '#EF4444' },
  users: { component: Users, color: '#6366F1' },
  settings: { component: Settings, color: '#9CA3AF' },
  sword: { component: Sword, color: '#EF4444' }
}
</script>

<template>
  <component 
    v-if="iconConfig[name]"
    :is="iconConfig[name]!.component"
    :size="size || 20"
    :color="iconConfig[name]!.color"
    :class="$props.class"
    :stroke-width="2.5"
  />
  <span v-else class="inline-flex items-center justify-center" :style="{ width: (size || 20) + 'px', height: (size || 20) + 'px' }">?</span>
</template>
