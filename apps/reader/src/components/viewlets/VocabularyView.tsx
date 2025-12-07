import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useTranslation } from '@flow/reader/hooks'

import { useAiState } from '../../state'

interface VocabularyViewProps {
  onClose?: () => void
}

export const VocabularyView: React.FC<VocabularyViewProps> = ({ onClose }) => {
  const [aiState, setAiState] = useAiState()
  const t = useTranslation('vocabulary')
  const [query, setQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? aiState.vocabulary.filter((v) => {
          return (
            v.word.toLowerCase().includes(q) ||
            (v.explanation && v.explanation.toLowerCase().includes(q))
          )
        })
      : aiState.vocabulary
    
    // Sort by addedAt timestamp in descending order (newest first)
    return [...filtered].sort((a, b) => {
      const timeA = a.addedAt ?? 0
      const timeB = b.addedAt ?? 0
      return timeB - timeA // descending order
    })
  }, [aiState.vocabulary, query])

  const handleRemove = (word: string) => {
    setAiState((prev) => ({
      ...prev,
      vocabulary: prev.vocabulary.filter((v) => v.word !== word),
    }))
  }

  const handleClose = () => {
    onClose?.()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleExportAnki = () => {
    try {
      if (!aiState.vocabulary.length) return
      const lines = aiState.vocabulary.map((item) => {
        // Keep word simple (no newlines in word field)
        const front = (item.word || '').replace(/\r?\n/g, ' ').trim()
        
        // Preserve formatting in explanation by converting newlines to <br>
        const back = (item.explanation || '')
          .replace(/\r?\n/g, '<br>')
          .trim()
        
        // Preserve formatting in context by converting newlines to <br>
        let context = (item.context || '')
          .replace(/\r?\n/g, '<br>')
          .trim()
        
        // Bold the word in context (case-insensitive) using <strong> tag
        if (context && front) {
          // Escape special regex characters in the word
          const escapedWord = front.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi')
          context = context.replace(regex, '<strong>$1</strong>')
        }
        
        return `${front}\t${back}\t${context}`
      })
      const data = lines.join('\n')
      const blob = new Blob([data], { type: 'text/tab-separated-values;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'anki-vocabulary.tsv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // ignore download errors
    }
  }

  const handleExportJson = () => {
    try {
      const data = JSON.stringify(aiState.vocabulary, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'vocabulary.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // ignore download errors
    }
  }

  const handleClickImportJson = () => {
    fileInputRef.current?.click()
  }

  const handleImportJson: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const data = JSON.parse(text) as { word: string; explanation?: string }[]
        if (!Array.isArray(data)) return

        const valid = data.filter((item) => item && typeof item.word === 'string' && item.word.trim())

        if (!valid.length) return

        setAiState((prev) => {
          const existingMap = new Map(prev.vocabulary.map((v) => [v.word.toLowerCase(), v]))
          for (const item of valid) {
            const word = item.word.trim()
            if (!word) continue
            existingMap.set(word.toLowerCase(), {
              word,
              explanation: item.explanation,
            })
          }
          return {
            ...prev,
            vocabulary: Array.from(existingMap.values()),
          }
        })
      } catch {
        // ignore parse errors
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex h-full flex-col bg-surface text-on-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-variant px-4 py-3">
        <div>
          <div className="text-base font-semibold">
            {t('title') || 'Vocabulary Notebook'}
          </div>
          <div className="mt-1 text-xs text-outline">
            {aiState.vocabulary.length}{' '}
            {aiState.vocabulary.length === 1 ? 'word saved' : 'words saved'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportJson}
          />
          <button
            onClick={handleExportAnki}
            className="rounded-full px-2 py-1 text-[11px] text-outline hover:bg-surface-variant/70 hover:text-on-surface-variant"
          >
            {t('export_anki') || 'Export Anki'}
          </button>
          <button
            onClick={handleExportJson}
            className="rounded-full px-2 py-1 text-[11px] text-outline hover:bg-surface-variant/70 hover:text-on-surface-variant"
          >
            {t('export_json') || 'Export JSON'}
          </button>
          <button
            onClick={handleClickImportJson}
            className="rounded-full px-2 py-1 text-[11px] text-outline hover:bg-surface-variant/70 hover:text-on-surface-variant"
          >
            {t('import_json') || 'Import JSON'}
          </button>
          <button
            onClick={handleClose}
            className="rounded-full px-2 py-1 text-xs text-outline hover:bg-surface-variant/70 hover:text-on-surface-variant"
          >
            ×
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="space-y-2 px-4 py-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_placeholder') || 'Search your words...'}
          className="w-full rounded-full border border-surface-variant bg-surface px-4 py-2 text-xs outline-none focus:border-primary"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {items.length === 0 ? (
          <div className="mt-6 text-center text-xs text-outline">
            {aiState.vocabulary.length === 0
              ? t('empty') || 'No words yet. Add from the dictionary or AI panel.'
              : t('no_results') || 'No words match your search.'}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1">
            {items.map((item) => (
              <div
                key={item.word}
                className="flex h-full flex-col rounded-2xl border border-surface-variant bg-surface px-3 py-2 shadow-sm"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold leading-snug">
                    {item.word}
                  </div>
                  <button
                    className="text-[11px] text-outline hover:text-error"
                    onClick={() => handleRemove(item.word)}
                  >
                    {t('delete') || 'Delete'}
                  </button>
                </div>
                {item.explanation && (
                  <div className="mt-1 flex-1 whitespace-pre-wrap text-[11px] leading-relaxed text-on-surface-variant">
                    {item.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
