import { useEventListener } from '@literal-ui/hooks'
import Dexie from 'dexie'
import { useRouter } from 'next/router'
import { parseCookies, destroyCookie } from 'nookies'
import { useState, type ChangeEvent } from 'react'

import {
  ColorScheme,
  useColorScheme,
  useForceRender,
  useTranslation,
} from '@flow/reader/hooks'
import { useSettings, useAiState } from '@flow/reader/state'
import { dbx, mapToToken, OAUTH_SUCCESS_MESSAGE } from '@flow/reader/sync'

import { Button } from '../Button'
import { Checkbox, Select, TextField } from '../Form'
import { Page } from '../Page'

export const Settings: React.FC = () => {
  const { scheme, setScheme } = useColorScheme()
  const { asPath, push, locale } = useRouter()
  const [settings, setSettings] = useSettings()
  const [aiState, setAiState] = useAiState()
  const t = useTranslation('settings')

  return (
    <Page headline={t('title')}>
      <div className="space-y-6">
        <Item title={t('language')}>
          <Select
            value={locale}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              push(asPath, undefined, { locale: e.target.value })
            }}
          >
            <option value="en-US">English</option>
            <option value="zh-CN">简体中文</option>
            <option value="ja-JP">日本語</option>
          </Select>
        </Item>
        <Item title={t('color_scheme')}>
          <Select
            value={scheme}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setScheme(e.target.value as ColorScheme)
            }}
          >
            <option value="system">{t('color_scheme.system')}</option>
            <option value="light">{t('color_scheme.light')}</option>
            <option value="dark">{t('color_scheme.dark')}</option>
          </Select>
        </Item>
        <Item title={t('text_selection_menu')}>
          <Checkbox
            name={t('text_selection_menu.enable')}
            checked={settings.enableTextSelectionMenu}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setSettings({
                ...settings,
                enableTextSelectionMenu: e.target.checked,
              })
            }}
          />
        </Item>
        <AiConfiguration aiState={aiState} setAiState={setAiState} t={t} />
        <Synchronization />
        <Item title={t('cache')}>
          <Button
            variant="secondary"
            onClick={() => {
              window.localStorage.clear()
              Dexie.getDatabaseNames().then((names) => {
                names.forEach((n) => Dexie.delete(n))
              })
            }}
          >
            {t('cache.clear')}
          </Button>
        </Item>
      </div>
    </Page>
  )
}

const Synchronization: React.FC = () => {
  const cookies = parseCookies()
  const refreshToken = cookies[mapToToken['dropbox']]
  const render = useForceRender()
  const t = useTranslation('settings.synchronization')

  useEventListener('message', (e) => {
    if (e.data === OAUTH_SUCCESS_MESSAGE) {
      // init app (generate access token, fetch remote data, etc.)
      window.location.reload()
    }
  })

  return (
    <Item title={t('title')}>
      <Select>
        <option value="dropbox">Dropbox</option>
      </Select>
      <div className="mt-2">
        {refreshToken ? (
          <Button
            variant="secondary"
            onClick={() => {
              destroyCookie(null, mapToToken['dropbox'])
              render()
            }}
          >
            {t('unauthorize')}
          </Button>
        ) : (
          <Button
            onClick={() => {
              const redirectUri =
                window.location.origin + '/api/callback/dropbox'

              dbx.auth
                .getAuthenticationUrl(
                  redirectUri,
                  JSON.stringify({ redirectUri }),
                  'code',
                  'offline',
                )
                .then((url) => {
                  window.open(url as string, '_blank')
                })
            }}
          >
            {t('authorize')}
          </Button>
        )}
      </div>
    </Item>
  )
}

interface PartProps {
  title: string
}
const Item: React.FC<PartProps> = ({ title, children }) => {
  return (
    <div>
      <h3 className="typescale-title-small text-on-surface-variant">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

const AiConfiguration: React.FC<{
  aiState: any
  setAiState: any
  t: any
}> = ({ aiState, setAiState, t }) => {
  const [config, setConfig] = useState(aiState.config)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string>()
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setAiState((prev: any) => ({
      ...prev,
      config,
    }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(undefined)
    try {
      const res = await fetch('/api/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: 'test', config }),
      })
      if (res.ok) {
        const data = await res.json()
        setTestResult('✓ Success: ' + data.explanation.substring(0, 100) + '...')
      } else {
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        setTestResult('✗ Failed: ' + (errorData.error || res.statusText))
      }
    } catch (error) {
      setTestResult('✗ Network Error: ' + String(error))
    } finally {
      setTesting(false)
    }
  }

  return (
    <Item title={t('ai_configuration') || 'AI Configuration'}>
      <div className="space-y-3">
        <TextField
          name="ai-base-url"
          placeholder="Base URL (e.g. https://api.openai.com or https://api.deepseek.com)"
          value={config.baseUrl}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setConfig({ ...config, baseUrl: e.target.value })
          }
        />
        <TextField
          name="ai-model"
          placeholder="Model (e.g. gpt-4o-mini, deepseek-chat)"
          value={config.model}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setConfig({ ...config, model: e.target.value })
          }
        />
        <TextField
          name="ai-api-key"
          placeholder="API Key"
          value={config.apiKey}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setConfig({ ...config, apiKey: e.target.value })
          }
        />
        <TextField
          name="ai-prompt"
          as="textarea"
          placeholder="Custom prompt. You can use {word} and {context} as placeholders."
          value={config.prompt}
          className="min-h-[100px]"
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setConfig({ ...config, prompt: e.target.value })
          }
        />
        <TextField
          name="dictionary-url-template"
          placeholder="Dictionary URL template, e.g. https://cn.bing.com/dict/search?q={word}"
          value={config.dictionaryUrlTemplate}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setConfig({ ...config, dictionaryUrlTemplate: e.target.value })
          }
        />
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saved}>
            {saved ? 'Saved!' : 'Save Configuration'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={testing || !config.baseUrl || !config.apiKey}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
        {testResult && (
          <div
            className={`rounded p-3 text-sm ${
              testResult.startsWith('✓')
                ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                : 'bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            {testResult}
          </div>
        )}
      </div>
    </Item>
  )
}

Settings.displayName = 'settings'
