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
  // WebDAV sync configuration for vocabulary and reading data
  webdavEnabled?: boolean
  webdavUrl?: string
  webdavUsername?: string
  webdavPassword?: string
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

export const defaultSettings: Settings = {}

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
}

export interface AiState {
  selectedWord?: string
  context?: string
  sidebarMode: AiSidebarMode
  vocabulary: VocabularyItem[]
  config: AiConfig
  quizContext?: string
}

const defaultAiState: AiState = {
  selectedWord: undefined,
  context: undefined,
  sidebarMode: 'dictionary',
  vocabulary: [],
  config: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-1-5-lite-32k-250115',
    prompt:
      '根据{context}解释单词 {word} ，如果{word}在{context}中有固定搭配，请提取出英文短语的搭配并解释。\n- 输出要求：\n  1. 用中文解释主要含义\n  2. 给出1个包含该单词的英文例句，并附中文翻译',
    dictionaryUrlTemplate: 'https://m.youdao.com/dict?le=eng&q={word}',
  },
  quizContext: undefined,
}

const aiState = atom<AiState>({
  key: 'ai-state',
  default: defaultAiState,
  effects: [localStorageEffect('ai-state', defaultAiState)],
})

export function useAiState() {
  return useRecoilState(aiState)
}
