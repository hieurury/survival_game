/**
 * Localization Composable
 * Hệ thống bản địa hóa với hỗ trợ đa ngôn ngữ
 */

import { ref, computed } from 'vue'
import vi_VN, { type LocaleMessages } from '../locales/vi-VN'

// Supported locales
export type SupportedLocale = 'vi-VN' | 'en-US'

// Current locale (default to Vietnamese)
const currentLocale = ref<SupportedLocale>('vi-VN')

// Available locale messages
const locales: Record<SupportedLocale, LocaleMessages> = {
  'vi-VN': vi_VN,
  'en-US': vi_VN, // Fallback to Vietnamese (can add English later)
}

// Get current messages
const messages = computed(() => locales[currentLocale.value])

/**
 * Get a nested value from an object using dot notation
 * @param obj The object to get the value from
 * @param path The dot-notation path (e.g., 'messages.startedSleeping')
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }

  return typeof current === 'string' ? current : undefined
}

/**
 * Replace placeholders in a string with values
 * @param template The template string with {placeholder} markers
 * @param params The values to replace placeholders with
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key]
    return value !== undefined ? String(value) : `{${key}}`
  })
}

/**
 * Main translation function
 * @param key The translation key using dot notation (e.g., 'messages.startedSleeping')
 * @param params Optional parameters for interpolation
 * @returns The translated and interpolated string
 * 
 * @example
 * t('messages.startedSleeping') // 'Bắt đầu ngủ - đang kiếm vàng!'
 * t('messages.notEnoughGoldNeed', { cost: 100 }) // 'Không đủ vàng! Cần 100g'
 * t('ui.spawnsIn', { time: 30 }) // '🐉 Xuất hiện sau 30giây'
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const value = getNestedValue(messages.value as unknown as Record<string, unknown>, key)
  
  if (value === undefined) {
    console.warn(`[i18n] Missing translation key: ${key}`)
    return key
  }

  return interpolate(value, params)
}

/**
 * Get building type name in Vietnamese
 */
export function getBuildingTypeName(type: string): string {
  const typeKey = type as keyof typeof messages.value.buildingTypes
  return messages.value.buildingTypes[typeKey] || type
}

/**
 * useLocale composable
 * Provides access to localization functions and current locale
 */
export function useLocale() {
  const setLocale = (locale: SupportedLocale) => {
    currentLocale.value = locale
  }

  const getLocale = () => currentLocale.value

  return {
    t,
    locale: currentLocale,
    setLocale,
    getLocale,
    messages,
    getBuildingTypeName,
  }
}

export default useLocale
