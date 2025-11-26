import React, { useEffect, useState } from 'react'

import { useTranslation } from '@flow/reader/hooks'

import { useAiState } from '../../state'

interface QuizViewProps {
  onClose?: () => void
}

interface QuizQuestion {
  question: string
  options: string[]
  answerIndex: number
  explanation?: string
}

export const QuizView: React.FC<QuizViewProps> = ({ onClose }) => {
  const [aiState] = useAiState()
  const t = useTranslation('quiz')

  const [questionCount, setQuestionCount] = useState<number>(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [showAnswers, setShowAnswers] = useState(false)

  const context = aiState.quizContext

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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleGenerate = async () => {
    if (!context) {
      setError(
        t('no_context') ||
          'No reading context available. Please open a book and scroll to the part you want to test.',
      )
      return
    }
    setLoading(true)
    setError(undefined)
    setShowAnswers(false)
    setQuestions([])
    setAnswers([])
    try {
      const res = await fetch('/api/reading-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          questionCount,
          config: aiState.config,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || res.statusText)
      }
      const data = await res.json()
      const qs: QuizQuestion[] = data.questions || []
      setQuestions(qs)
      setAnswers(new Array(qs.length).fill(-1))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (qIndex: number, optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[qIndex] = optionIndex
      return next
    })
  }

  const handleReveal = () => {
    if (!questions.length) return
    setShowAnswers(true)
  }

  return (
    <div className="flex h-full flex-col bg-surface text-on-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-variant px-4 py-3">
        <div>
          <div className="text-base font-semibold">
            {t('title') || 'Reading Quiz'}
          </div>
          <div className="mt-1 text-xs text-outline">
            {t('subtitle') || 'Generate multiple-choice questions from the current passage.'}
          </div>
        </div>
        <button
          onClick={handleClose}
          className="rounded-full px-2 py-1 text-xs text-outline hover:bg-surface-variant/70 hover:text-on-surface-variant"
        >
          ×
        </button>
      </div>

      {/* Controls */}
      <div className="border-b border-surface-variant px-4 py-3 text-xs text-on-surface-variant">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span>{t('question_count') || 'Number of questions:'}</span>
          {[3, 5, 10].map((n) => (
            <button
              key={n}
              className={`rounded-full px-3 py-1 text-xs border border-surface-variant ${
                questionCount === n
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-variant/70'
              }`}
              onClick={() => setQuestionCount(n)}
              disabled={loading}
            >
              {n}
            </button>
          ))}
          <button
            className="ml-auto rounded-full bg-primary px-4 py-1 text-xs text-on-primary hover:bg-primary/90 disabled:opacity-50"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading
              ? t('generating') || 'Generating...'
              : t('generate_quiz') || 'Generate Quiz'}
          </button>
        </div>
        {!context && (
          <div className="text-[11px] text-outline">
            {t('no_context_hint') ||
              'Open a book and scroll to the section you want to test, then click "Generate Quiz".'}
          </div>
        )}
        {error && (
          <div className="mt-1 rounded bg-error/10 px-2 py-1 text-[11px] text-error">
            {error}
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-auto px-4 pb-4 pt-3">
        {questions.length === 0 && !loading && !error && (
          <div className="mt-4 text-center text-xs text-outline">
            {t('empty') || 'Click "Generate Quiz" to create questions from the current passage.'}
          </div>
        )}
        {questions.length > 0 && (
          <div className="space-y-4">
            {questions.map((q, qi) => {
              const userAnswer = answers[qi]
              return (
                <div
                  key={qi}
                  className="rounded-2xl border border-surface-variant bg-surface px-3 py-2 text-xs shadow-sm"
                >
                  <div className="mb-2 font-semibold">
                    {qi + 1}. {q.question}
                  </div>
                  <div className="space-y-1">
                    {q.options.map((opt, oi) => {
                      const isCorrect = showAnswers && oi === q.answerIndex
                      const isUser = userAnswer === oi
                      return (
                        <button
                          key={oi}
                          className={`flex w-full items-center rounded px-2 py-1 text-left text-[11px] border ${
                            isCorrect
                              ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300'
                              : isUser
                              ? 'border-primary bg-primary/10 text-on-surface'
                              : 'border-transparent hover:border-surface-variant hover:bg-surface-variant/60'
                          }`}
                          onClick={() => !showAnswers && handleSelect(qi, oi)}
                          disabled={showAnswers}
                        >
                          <span className="mr-2 font-semibold">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                  {showAnswers && (
                    <div className="mt-2 text-[11px] text-on-surface-variant">
                      <div>
                        <span className="font-semibold">Answer: </span>
                        {String.fromCharCode(65 + q.answerIndex)}
                      </div>
                      {q.explanation && (
                        <div className="mt-1 whitespace-pre-wrap">
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-surface-variant px-4 py-2 text-right">
        <button
          className="rounded-full px-4 py-1 text-xs text-outline hover:bg-surface-variant/70 hover:text-on-surface-variant disabled:opacity-50"
          onClick={handleReveal}
          disabled={!questions.length}
        >
          {showAnswers
            ? t('answers_shown') || 'Answers Shown'
            : t('reveal_answers') || 'Reveal Answers'}
        </button>
      </div>
    </div>
  )
}
