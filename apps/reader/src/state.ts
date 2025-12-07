import { IS_SERVER } from '@literal-ui/hooks'
import { atom, AtomEffect, useRecoilState } from 'recoil'

import { RenditionSpread } from '@flow/epubjs/types/rendition'

function localStorageEffect<T>(key: string, defaultValue: T): AtomEffect<T> {
  return ({ setSelf, onSet }) => {
    if (IS_SERVER) return

    const savedValue = localStorage.getItem(key)
    if (savedValue === null) {
      localStorage.setItem(key, JSON.stringify(defaultValue))
    } else {
      setSelf(JSON.parse(savedValue))
    }

    onSet((newValue, _, isReset) => {
      isReset
        ? localStorage.removeItem(key)
        : localStorage.setItem(key, JSON.stringify(newValue))
    })
  }
}

export const navbarState = atom<boolean>({
  key: 'navbar',
  default: false,
})

export interface Settings extends TypographyConfiguration {
  theme?: ThemeConfiguration
  enableTextSelectionMenu?: boolean
  // Keyboard shortcut for triggering AI explanation on desktop, e.g. Ctrl+Shift+Y
  aiHotkey?: string
  // WebDAV sync configuration for vocabulary and reading data
  webdavEnabled?: boolean
  webdavUrl?: string
  webdavUsername?: string
  webdavPassword?: string
  // Global font size (px) for vocabulary tooltip popup
  vocabTooltipFontSize?: number
}

export interface TypographyConfiguration {
  fontSize?: string
  fontWeight?: number
  fontFamily?: string
  lineHeight?: number
  spread?: RenditionSpread
  zoom?: number
}

interface ThemeConfiguration {
  source?: string
  background?: number
}

const envWebdavEnabled =
  process.env.NEXT_PUBLIC_WEBDAV_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_WEBDAV_ENABLED === '1'

const envWebdavUrl = process.env.NEXT_PUBLIC_WEBDAV_URL
const envWebdavUsername = process.env.NEXT_PUBLIC_WEBDAV_USERNAME
const envWebdavPassword = process.env.NEXT_PUBLIC_WEBDAV_PASSWORD

export const defaultSettings: Settings = {
  webdavEnabled: envWebdavEnabled,
  webdavUrl: envWebdavUrl,
  webdavUsername: envWebdavUsername,
  webdavPassword: envWebdavPassword,
  vocabTooltipFontSize: 12,
  aiHotkey: 'Ctrl+Shift+Y',
}

const settingsState = atom<Settings>({
  key: 'settings',
  default: defaultSettings,
  effects: [localStorageEffect('settings', defaultSettings)],
})

export function useSettings() {
  return useRecoilState(settingsState)
}

export type AiSidebarMode = 'dictionary' | 'ai' | 'vocab'

export interface AiConfig {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  prompt?: string
  // Template for dictionary URL, e.g. https://dict.youdao.com/result?word={word}
  dictionaryUrlTemplate?: string
}

export interface VocabularyItem {
  word: string
  explanation?: string
  context?: string
  addedAt?: number // timestamp when the word was added
}

export interface AiState {
  selectedWord?: string
  context?: string
  sidebarMode: AiSidebarMode
  vocabulary: VocabularyItem[]
  config: AiConfig
  quizContext?: string
  panelPosition?: 'top' | 'bottom'
}

const envAiBaseUrl = process.env.NEXT_PUBLIC_AI_BASE_URL
const envAiModel = process.env.NEXT_PUBLIC_AI_MODEL
const envAiPrompt = process.env.NEXT_PUBLIC_AI_PROMPT
const envDictTemplate = process.env.NEXT_PUBLIC_DICTIONARY_URL_TEMPLATE

const defaultAiState: AiState = {
  selectedWord: undefined,
  context: undefined,
  sidebarMode: 'dictionary',
  vocabulary: [],
  config: {
    baseUrl: envAiBaseUrl || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: envAiModel || 'doubao-1-5-lite-32k-250115',
    apiKey: process.env.NEXT_PUBLIC_AI_API_KEY,
    prompt:
      envAiPrompt ||
      '根据{context}解释 {word} 。注意：请给出在{context}中 {word} 的拼音发音; 并给出1个包含 {word}的例句.',
    dictionaryUrlTemplate:
      envDictTemplate || 'https://m.youdao.com/dict?le=eng&q={word}',
  },
  quizContext: undefined,
  panelPosition: 'bottom',
}

const aiState = atom<AiState>({
  key: 'ai-state',
  default: defaultAiState,
  effects: [localStorageEffect('ai-state', defaultAiState)],
})

export function useAiState() {
  return useRecoilState(aiState)
}
