import { useEffect, useState } from 'react'
import { MdClose } from 'react-icons/md'

import { useMobile } from '../hooks'
import { useAiState } from '../state'

import { useSplitViewItem } from './base'

export const RightSidebar: React.FC = () => {
  const mobile = useMobile()
  const [aiState, setAiState] = useAiState()
  const [isOpen, setIsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const hasWord = !!aiState.selectedWord

  // Open sidebar when appropriate
  useEffect(() => {
    if (!hasWord) return
    // Desktop: auto-open when a word is selected
    if (!mobile) {
      setIsOpen(true)
      return
    }
    // Mobile: only open when sidebarMode is explicitly set to 'ai'
    if (aiState.sidebarMode === 'ai') {
      setIsOpen(true)
    }
  }, [hasWord, mobile, aiState.sidebarMode])

  const { size } = useSplitViewItem(RightSidebar, {
    preferredSize: 320,
    minSize: 220,
    visible: isOpen,
  })

  if (!isOpen) return null

  const containerClass = mobile
    ? aiState.panelPosition === 'top'
      ? 'RightSidebar fixed inset-x-0 top-0 z-50 bg-surface flex flex-col border-b border-surface-variant shadow-xl rounded-b-2xl pointer-events-auto'
      : 'RightSidebar fixed inset-x-0 bottom-0 z-50 bg-surface flex flex-col border-t border-surface-variant shadow-xl rounded-t-2xl pointer-events-auto'
    : 'RightSidebar bg-surface flex flex-col border-l border-surface-variant'

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(() => {
      setAiState((prev) => ({
        ...prev,
        selectedWord: undefined,
      }))
    }, 300)
  }

  const mobileStyle = mobile
    ? { height: expanded ? '90vh' : '33vh' }
    : undefined

  const desktopStyle = mobile ? mobileStyle : { width: size }

  return (
    <>
      {mobile && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          style={{ pointerEvents: 'auto' }}
          onClick={handleClose}
        />
      )}
      <div
        className={containerClass}
        style={desktopStyle}
      >
        {mobile && (
          <button
            className="mx-auto mt-1 mb-1 h-1.5 w-16 rounded-full bg-outline/40"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse AI panel' : 'Expand AI panel'}
          />
        )}
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
        <div className="flex-1 flex flex-col min-h-0">
          {mobile ? (
            <div 
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
            >
              <AiExplanationView word={aiState.selectedWord} />
            </div>
          ) : (
            <>
              <div className="flex-[4] min-h-0 border-b border-surface-variant">
                <AiExplanationView word={aiState.selectedWord} />
              </div>
              <div className="flex-[6] min-h-0">
                <DictionaryView word={aiState.selectedWord} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

interface ViewProps {
  word?: string
}

const DictionaryView: React.FC<ViewProps> = ({ word }) => {
  const [aiState] = useAiState()

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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <iframe
        title="Dictionary"
        src={src}
        className="h-full w-full flex-1 border-0 overflow-auto"
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
    <div className="flex h-full flex-col p-4 text-sm text-on-surface-variant select-text">
      <div className="mb-2 flex items-center justify-between flex-none">
        <div className="text-base font-medium truncate" title={word}>
          {word}
        </div>
        <button
          className="rounded bg-primary px-3 py-1 text-xs text-on-primary hover:opacity-90 disabled:opacity-50"
          onClick={handleAdd}
          disabled={!explanation}
        >
          Add
        </button>
      </div>
      <div 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {loading && (
          <div className="mb-2 text-xs text-outline">Loading AI explanation...</div>
        )}
        {explanation && (
          <div className="scroll-parent rounded bg-surface-variant/30 p-3">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {explanation}
            </div>
          </div>
        )}
        {!loading && !explanation && (
          <p className="text-xs text-outline">No explanation yet.</p>
        )}
      </div>
    </div>
  )
}
