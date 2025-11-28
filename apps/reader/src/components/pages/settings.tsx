import Dexie from 'dexie'
import { useRouter } from 'next/router'
import { useState, type ChangeEvent } from 'react'

import { useTranslation } from '@flow/reader/hooks'
import { useSettings, useAiState } from '@flow/reader/state'

import { Button } from '../Button'
import { Checkbox, Select, TextField } from '../Form'
import { Page } from '../Page'

const envAiPrompt = process.env.NEXT_PUBLIC_AI_PROMPT
const envAiPromptEnglish = process.env.NEXT_PUBLIC_AI_PROMPT_EN

export const Settings: React.FC = () => {
  const { asPath, push, locale } = useRouter()
  const [settings, setSettings] = useSettings()
  const [aiState, setAiState] = useAiState()
  const t = useTranslation('settings')

  return (
    <Page headline="">
      <div className="pr-2 space-y-6">
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
        <AiConfiguration aiState={aiState} setAiState={setAiState} t={t} />
        <WebDavSync
          settings={settings}
          setSettings={setSettings}
          aiState={aiState}
          setAiState={setAiState}
        />
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

const WebDavSync: React.FC<{
  settings: any
  setSettings: any
  aiState: any
  setAiState: any
}> = ({ settings, setSettings, aiState, setAiState }) => {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string>()
  const t = useTranslation('settings.synchronization')

  const enabled = settings.webdavEnabled ?? false

  const handleToggle = (e: ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      webdavEnabled: e.target.checked,
    })
  }

  const handleChangeField = (
    field: 'webdavUrl' | 'webdavUsername' | 'webdavPassword',
  ) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setSettings({
        ...settings,
        [field]: e.target.value,
      })
    }

  const handleUpload = async () => {
    if (!enabled || !settings.webdavUrl) {
      setMessage('Please enable WebDAV and fill in the URL.')
      return
    }
    setSyncing(true)
    setMessage(undefined)
    try {
      const res = await fetch('/api/webdav-vocab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upload',
          url: settings.webdavUrl,
          username: settings.webdavUsername,
          password: settings.webdavPassword,
          vocabulary: aiState.vocabulary,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `HTTP ${res.status} ${res.statusText}`)
      }
      setMessage('✓ Vocabulary uploaded to WebDAV.')
    } catch (error) {
      setMessage('✗ Failed to upload: ' + String(error))
    } finally {
      setSyncing(false)
    }
  }

  const handleDownload = async () => {
    if (!enabled || !settings.webdavUrl) {
      setMessage('Please enable WebDAV and fill in the URL.')
      return
    }
    setSyncing(true)
    setMessage(undefined)
    try {
      const res = await fetch('/api/webdav-vocab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'download',
          url: settings.webdavUrl,
          username: settings.webdavUsername,
          password: settings.webdavPassword,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `HTTP ${res.status} ${res.statusText}`)
      }
      const { data } = await res.json()
      const remoteVocab = Array.isArray(data?.vocabulary) ? data.vocabulary : data
      if (!Array.isArray(remoteVocab)) {
        throw new Error('Invalid vocabulary format in WebDAV file.')
      }
      setAiState((prev: any) => ({
        ...prev,
        vocabulary: remoteVocab,
      }))
      setMessage('✓ Vocabulary downloaded from WebDAV.')
    } catch (error) {
      setMessage('✗ Failed to download: ' + String(error))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Item title={t('webdav_title') || 'WebDAV Sync'}>
      <div className="space-y-3">
        <p className="text-sm text-on-surface-variant">
          Configure WebDAV to sync your vocabulary notebook across devices.
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            name="enable-webdav"
            checked={enabled}
            onChange={handleToggle}
          />
          <span className="text-sm text-on-surface-variant">
            Enable WebDAV Sync
          </span>
        </div>
        <TextField
          name="webdav-url"
          placeholder="WebDAV File URL (e.g. https://example.com/dav/vocabulary.json)"
          value={settings.webdavUrl || ''}
          onChange={handleChangeField('webdavUrl')}
        />
        <TextField
          name="webdav-username"
          placeholder="Username"
          value={settings.webdavUsername || ''}
          onChange={handleChangeField('webdavUsername')}
        />
        <TextField
          name="webdav-password"
          type="password"
          placeholder="Password"
          value={settings.webdavPassword || ''}
          onChange={handleChangeField('webdavPassword')}
        />
        <div className="flex gap-2">
          <Button onClick={handleUpload} disabled={syncing || !enabled}>
            {syncing ? 'Syncing...' : '上传到云端'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownload}
            disabled={syncing || !enabled}
          >
            {syncing ? 'Syncing...' : 'Download Vocabulary'}
          </Button>
        </div>
        {message && (
          <div className="rounded bg-surface-variant/60 p-3 text-xs text-on-surface-variant">
            {message}
          </div>
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

  const englishPromptTemplate =
    envAiPromptEnglish ||
    '根据{context}解释单词 {word} ，如果{word}在{context}中有固定搭配，请提取出英文短语的搭配并解释。注意：请用中文解释主要含义,并附上单词的美国英标; 给出1个包含该单词的英文例句，并附中文翻译.'

  const chinesePromptTemplate =
    envAiPrompt ||
    '根据{context}解释 {word} 。注意：请给出在{context}中 {word} 的拼音发音; 并给出1个包含 {word}的例句.'

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
        <div className="flex items-center gap-2">
          <span className="text-sm text-on-surface-variant">AI Prompt</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              compact
              onClick={() =>
                setConfig({ ...config, prompt: englishPromptTemplate })
              }
            >
              英文翻译 Prompt
            </Button>
            <Button
              variant="secondary"
              compact
              onClick={() =>
                setConfig({ ...config, prompt: chinesePromptTemplate })
              }
            >
              中文解释 Prompt
            </Button>
          </div>
        </div>
        <TextField
          name="ai-prompt"
          as="textarea"
          hideLabel
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
