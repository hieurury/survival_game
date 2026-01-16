import { ref, shallowRef } from 'vue'

export interface SpriteAsset {
  image: HTMLImageElement | null
  ready: boolean
  src: string
}

const characterSprites = shallowRef<string[]>([])
const structorSprites = shallowRef<string[]>([])
const monsterSprites = shallowRef<string[]>([])
const itemSprites = shallowRef<string[]>([])

const loadedSprites = ref<Map<string, SpriteAsset>>(new Map())

export const initAssets = () => {
  characterSprites.value = Object.values(
    import.meta.glob('../assets/character/*.{png,jpg,jpeg,webp,gif}', { eager: true, as: 'url' }),
  ) as string[]

  structorSprites.value = Object.values(
    import.meta.glob('../assets/structor/*.{png,jpg,jpeg,webp,gif}', { eager: true, as: 'url' }),
  ) as string[]

  monsterSprites.value = Object.values(
    import.meta.glob('../assets/monster/*.{png,jpg,jpeg,webp,gif}', { eager: true, as: 'url' }),
  ) as string[]

  itemSprites.value = Object.values(
    import.meta.glob('../assets/items/*.{png,jpg,jpeg,webp,gif}', { eager: true, as: 'url' }),
  ) as string[]
}

export const loadSprite = (src: string): SpriteAsset => {
  if (loadedSprites.value.has(src)) {
    return loadedSprites.value.get(src)!
  }

  const asset: SpriteAsset = {
    image: null,
    ready: false,
    src,
  }

  const img = new Image()
  img.src = src
  img.onload = () => {
    asset.image = img
    asset.ready = true
  }
  img.onerror = () => {
    asset.ready = false
  }

  asset.image = img
  loadedSprites.value.set(src, asset)
  return asset
}

export const getCharacterSprite = (index = 0): SpriteAsset | null => {
  const sprites = characterSprites.value
  if (sprites.length === 0) return null
  const src = sprites[index % sprites.length]
  if (!src) return null
  return loadSprite(src)
}

export const getMonsterSprite = (index = 0): SpriteAsset | null => {
  const sprites = monsterSprites.value
  if (sprites.length === 0) return null
  const src = sprites[index % sprites.length]
  if (!src) return null
  return loadSprite(src)
}

export const getStructorSprite = (index = 0): SpriteAsset | null => {
  const sprites = structorSprites.value
  if (sprites.length === 0) return null
  const src = sprites[index % sprites.length]
  if (!src) return null
  return loadSprite(src)
}

export const getItemSprite = (index = 0): SpriteAsset | null => {
  const sprites = itemSprites.value
  if (sprites.length === 0) return null
  const src = sprites[index % sprites.length]
  if (!src) return null
  return loadSprite(src)
}

export const useAssets = () => ({
  characterSprites,
  structorSprites,
  monsterSprites,
  itemSprites,
  initAssets,
  loadSprite,
  getCharacterSprite,
  getMonsterSprite,
  getStructorSprite,
  getItemSprite,
})

export const ASSET_SOURCES = [
  {
    name: 'Kenney Assets (miễn phí, CC0)',
    url: 'https://kenney.nl/assets',
    description: 'Bộ asset 2D chất lượng cao, hoàn toàn miễn phí.',
  },
  {
    name: 'OpenGameArt',
    url: 'https://opengameart.org',
    description: 'Kho tài nguyên game mở, nhiều lựa chọn.',
  },
  {
    name: 'Itch.io - Free Game Assets',
    url: 'https://itch.io/game-assets/free',
    description: 'Nhiều pack sprite và animation miễn phí.',
  },
  {
    name: 'CraftPix (free packs)',
    url: 'https://craftpix.net/freebies/',
    description: 'Asset 2D chuyên nghiệp, có bản miễn phí.',
  },
  {
    name: 'Game-Icons.net',
    url: 'https://game-icons.net',
    description: 'Icon game đơn giản, dễ dùng cho UI.',
  },
]
