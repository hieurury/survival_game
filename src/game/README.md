# Game Architecture - Restructured

## Tổng quan

Game đã được tái cấu trúc từ 1 file monolithic (~4000 dòng) thành nhiều modules riêng biệt, tuân theo nguyên tắc Single Responsibility Principle.

## Cấu trúc thư mục mới

```
src/
├── game/
│   ├── index.ts              # Export chính
│   ├── config/
│   │   └── constants.ts      # Tất cả game constants (modular)
│   ├── types/
│   │   └── index.ts          # Type definitions
│   └── systems/
│       ├── index.ts          # Export all systems
│       ├── movementSystem.ts # Input & player movement
│       ├── cameraSystem.ts   # Camera control & drag
│       ├── combatSystem.ts   # Damage, projectiles, attacks
│       ├── buildingSystem.ts # Building construction & upgrades
│       ├── monsterAISystem.ts # Monster behavior & pathfinding
│       ├── renderingSystem.ts # Canvas drawing functions
│       └── mapGenerator.ts   # Procedural map generation
│
├── components/
│   └── game/
│       ├── index.ts           # Export all components
│       ├── PlayerStatusPanel.vue   # HP, gold, stats display
│       ├── BuildMenu.vue      # Building selection UI
│       ├── BuildingInfoPanel.vue   # Selected building details
│       ├── WaveInfo.vue       # Wave status display
│       ├── ActionButtons.vue  # Sleep, Build buttons
│       └── MiniMap.vue        # Mini map overview
│
└── pages/
    └── GamePage.vue           # Main game page (simplified)
```

## Các Systems

### 1. Movement System (`movementSystem.ts`)
- Xử lý input từ bàn phím (WASD/Arrow keys)
- Xử lý touch input cho mobile
- Di chuyển mượt mà với frame-rate independence
- Wall sliding khi va chạm

### 2. Camera System (`cameraSystem.ts`)
- Camera drag với chuột/touch
- Threshold detection để phân biệt click vs drag
- Camera clamping với padding
- Coordinate conversion (screen ↔ world)

### 3. Combat System (`combatSystem.ts`)
- Tính toán damage với level scaling
- Turret attack logic
- Projectile updates (homing)
- Vanguard combat
- Monster attack
- Player attack

### 4. Building System (`buildingSystem.ts`)
- Tạo buildings mới
- Tính cost với level scaling
- Upgrade buildings
- Validation (placement, affordability)
- Heal station logic
- Query functions

### 5. Monster AI System (`monsterAISystem.ts`)
- Monster templates (normal, fast, tank)
- Spawn logic
- Target selection
- Pathfinding integration
- State machine updates
- Wave management

### 6. Rendering System (`renderingSystem.ts`)
- Canvas utilities
- Grid rendering (optimized viewport)
- Room rendering
- Building rendering (all types)
- Player rendering
- Monster rendering
- Vanguard rendering
- Projectile rendering
- UI elements (health bars, selection)

### 7. Map Generator (`mapGenerator.ts`)
- Procedural room generation
- Corridor generation (L-shaped)
- Grid creation
- Obstacle placement
- Item spawning

## UI Components

### PlayerStatusPanel
- Hiển thị HP, gold, damage, attack range
- Avatar clickable để focus camera
- Hiển thị trạng thái ngủ

### BuildMenu
- Danh sách buildings có thể xây
- Hiển thị cost và description
- Disable khi không đủ gold

### BuildingInfoPanel
- Chi tiết building được chọn
- HP bar, stats
- Nút nâng cấp

### WaveInfo
- Số wave hiện tại
- Progress bar tiêu diệt quái
- Countdown cho wave tiếp

### ActionButtons
- Nút Sleep/Wake
- Nút Build toggle

### MiniMap
- Overview toàn bản đồ
- Vị trí player, monsters
- Viewport indicator
- Click để navigate

## Cách sử dụng

### Import từ game module
```typescript
import { GAME_CONSTANTS, Player, updatePlayerMovement } from '@/game'
```

### Import components
```typescript
import { PlayerStatusPanel, WaveInfo } from '@/components/game'
```

### Trong GamePage.vue
```vue
<script setup lang="ts">
import { 
  GAME_CONSTANTS,
  updatePlayerMovement,
  updateCamera,
  processTurretAttack,
  // ... other imports
} from '@/game'

import {
  PlayerStatusPanel,
  WaveInfo,
  BuildMenu,
  // ... other components
} from '@/components/game'
</script>

<template>
  <div class="game-container">
    <canvas ref="canvasRef" />
    
    <PlayerStatusPanel 
      :players="players" 
      :current-player-id="currentPlayerId"
      @select-player="handlePlayerSelect"
    />
    
    <WaveInfo 
      :current-wave="wave"
      :monsters-alive="monstersAlive"
      :total-monsters="totalMonsters"
      :countdown="countdown"
      :is-wave-active="isWaveActive"
    />
    
    <!-- ... other components -->
  </div>
</template>
```

## Lợi ích

1. **Maintainability**: Code dễ đọc, dễ sửa đổi
2. **Testability**: Có thể unit test từng system riêng
3. **Reusability**: Systems có thể tái sử dụng
4. **Performance**: Tree-shaking, lazy loading
5. **Team collaboration**: Nhiều người có thể làm việc song song
6. **Type safety**: TypeScript strict mode friendly

## Migration Guide

Để migrate từ GamePage.vue cũ:

1. Import các functions từ `@/game` thay vì define inline
2. Thay thế inline UI bằng components từ `@/components/game`
3. Di chuyển game loop logic vào các system calls
4. Giữ reactive state trong GamePage.vue, truyền vào systems như params

## TODO

- [ ] Integrate systems vào GamePage.vue
- [ ] Add unit tests cho từng system
- [ ] Performance profiling
- [ ] Mobile gesture improvements
- [ ] Sound system extraction
- [ ] Network multiplayer preparation
