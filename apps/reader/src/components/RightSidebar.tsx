import { useEffect, useState } from 'react'
import { MdClose } from 'react-icons/md'

import { useMobile } from '../hooks'
import { useAiState } from '../state'

import { useSplitViewItem } from './base'

export const RightSidebar: React.FC = () => {
  const mobile = useMobile()
  const [aiState, setAiState] = useAiState()
  const [isOpen, setIsOpen] = useState(false)

  const hasWord = !!aiState.selectedWord

  // Open sidebar when word is selected
  useEffect(() => {
    if (hasWord) {
      setIsOpen(true)
    }
  }, [hasWord])

  const { size } = useSplitViewItem(RightSidebar, {
    preferredSize: 320,
    minSize: 220,
    visible: isOpen,
  })

  if (mobile || !isOpen) return null

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(() => {
      setAiState((prev) => ({
        ...prev,
        selectedWord: undefined,
      }))
    }, 300)
  }

  return (
    <div
      className="RightSidebar bg-surface flex flex-col border-l border-surface-variant"
      style={{ width: size }}
    >
      <div className="flex items-center justify-between border-b-2 border-outline/20 bg-surface shadow-sm px-3 py-2">
        <div className="text-sm font-medium text-on-surface-variant">
          {aiState.selectedWord || 'No word selected'}
        </div>
        <button
          className="px-3 py-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors rounded"
          onClick={handleClose}
          title="Close"
        >
          <MdClose size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-[4] min-h-0 border-b border-surface-variant">
          <AiExplanationView word={aiState.selectedWord} />
        </div>
        <div className="flex-[6] min-h-0">
          <DictionaryView word={aiState.selectedWord} />
        </div>
      </div>
    </div>
  )
}

interface ViewProps {
  word?: string
}

const DictionaryView: React.FC<ViewProps> = ({ word }) => {
  const [aiState, setAiState] = useAiState()
  const [adding, setAdding] = useState(false)

  if (!word) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-outline">
        Select a word to see dictionary
      </div>
    )
  }

  const template = aiState.config.dictionaryUrlTemplate
  let src: string
  if (template && template.includes('{word}')) {
    src = template.replace(/\{word\}/g, encodeURIComponent(word))
  } else if (template && !template.includes('{word}')) {
    const sep = template.includes('?') ? '&' : '?'
    src = `${template}${sep}q=${encodeURIComponent(word)}`
  } else {
    src = `https://cn.bing.com/dict/search?q=${encodeURIComponent(word)}`
  }

  const handleAdd = async () => {
    if (adding) return

    // If AI config is not ready, at least save the word itself
    const { baseUrl, apiKey, model } = aiState.config
    const context = aiState.context ?? word

    if (!baseUrl || !apiKey || !model) {
      setAiState((prev) => {
        if (prev.vocabulary.some((v) => v.word === word)) return prev
        return {
          ...prev,
          vocabulary: [...prev.vocabulary, { word }],
        }
      })
      return
    }

    setAdding(true)
    try {
      const res = await fetch('/api/ai-explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word, context, config: aiState.config }),
      })

      let explanation: string | undefined
      if (res.ok) {
        const data = await res.json()
        explanation = data.explanation
      }

      setAiState((prev) => {
        if (prev.vocabulary.some((v) => v.word === word)) return prev
        return {
          ...prev,
          vocabulary: [...prev.vocabulary, { word, explanation }],
        }
      })
    } catch {
      // On error, still save the word without explanation
      setAiState((prev) => {
        if (prev.vocabulary.some((v) => v.word === word)) return prev
        return {
          ...prev,
          vocabulary: [...prev.vocabulary, { word }],
        }
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <iframe
        title="Dictionary"
        src={src}
        className="h-full w-full flex-1 border-0"
        sandbox="allow-same-origin allow-forms"
        name="youdaoFrame"
        frameBorder={0}
      />
    </div>
  )
}

const AiExplanationView: React.FC<ViewProps> = ({ word }) => {
  const [aiState, setAiState] = useAiState()
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState<string>()

  const { baseUrl, apiKey, model } = aiState.config
  const context = aiState.context ?? word

  useEffect(() => {
    if (!word) return
    if (!baseUrl || !apiKey || !model) {
      setExplanation('Please configure AI settings (base URL, API key, model).')
      setLoading(false)
      return
    }

    setLoading(true)
    setExplanation(undefined)

    fetch('/api/ai-explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word, context, config: aiState.config }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || res.statusText)
        }
        const data = await res.json()
        setExplanation(data.explanation)
      })
      .catch((e) => {
        setExplanation(String(e))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [word, baseUrl, apiKey, model, context, aiState.config])

  if (!word) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-outline">
        Select a word to see AI explanation
      </div>
    )
  }

  const handleAdd = () => {
    if (!word || !explanation) return
    setAiState((prev) => {
      if (prev.vocabulary.some((v) => v.word === word)) return prev
      return {
        ...prev,
        vocabulary: [...prev.vocabulary, { word, explanation }],
      }
    })
  }

  return (
    <div className="flex h-full flex-col p-4 text-sm text-on-surface-variant">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-base font-medium">{word}</div>
        <button
          className="rounded bg-primary px-3 py-1 text-xs text-on-primary hover:opacity-90 disabled:opacity-50"
          onClick={handleAdd}
          disabled={!explanation}
        >
          Add
        </button>
      </div>
      {loading && (
        <div className="mb-2 text-xs text-outline">Loading AI explanation...</div>
      )}
      {explanation && (
        <div className="scroll-parent flex-1 overflow-auto rounded bg-surface-variant/30 p-3">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {explanation}
          </div>
        </div>
      )}
      {!loading && !explanation && (
        <p className="text-xs text-outline">No explanation yet.</p>
      )}
    </div>
  )
}
