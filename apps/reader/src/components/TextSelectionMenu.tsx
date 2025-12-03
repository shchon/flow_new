import { Overlay } from '@literal-ui/core'
import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import FocusLock from 'react-focus-lock'
import {
  MdCopyAll,
  MdOutlineAddBox,
  MdOutlineEdit,
  MdOutlineIndeterminateCheckBox,
  MdSearch,
} from 'react-icons/md'
import { useSnapshot } from 'valtio'

import { typeMap, colorMap } from '../annotation'
import {
  isForwardSelection,
  useMobile,
  useSetAction,
  useTextSelection,
  useTranslation,
  useTypography,
} from '../hooks'
import { BookTab } from '../models'
import { isTouchScreen, scale } from '../platform'
import { useSettings, useAiState } from '../state'
import { copy, keys, last } from '../utils'

import { Button, IconButton } from './Button'
import { TextField } from './Form'
import { layout, LayoutAnchorMode, LayoutAnchorPosition } from './base'

interface TextSelectionMenuProps {
  tab: BookTab
}
export const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({
  tab,
}) => {
  const { rendition, annotationRange } = useSnapshot(tab)
  const [settings] = useSettings()
  const [, setAiState] = useAiState()
  const [currentText, setCurrentText] = useState<string | undefined>()
  const [currentContext, setCurrentContext] = useState<string | undefined>()
  const mobile = useMobile()

  // `manager` is not reactive, so we need to use getter
  const view = useCallback(() => {
    return rendition?.manager?.views._views[0]
  }, [rendition])

  const win = view()?.window
  const [selection, setSelection] = useTextSelection(win)

  // On mobile, update AI state immediately when text/context changes
  useEffect(() => {
    if (!currentText || !mobile) return
    setAiState((prev) => ({
      ...prev,
      selectedWord: currentText,
      context: currentContext ?? currentText,
      sidebarMode: 'dictionary',
    }))
  }, [currentText, currentContext, mobile, setAiState])

  // On desktop, trigger AI update only when user presses the configured hotkey
  useEffect(() => {
    if (mobile) return

    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
    const expected = normalize(settings.aiHotkey || 'Ctrl+Shift+Y')

    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      // 忽略纯修饰键
      if (['control', 'shift', 'alt', 'meta'].includes(key)) {
        return
      }

      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('ctrl')
      if (e.shiftKey) parts.push('shift')
      if (e.altKey) parts.push('alt')
      parts.push(key)

      const pressed = normalize(parts.join('+'))
      if (pressed !== expected) return

      // 如果 currentText 还没更新，直接从 iframe 当前选区读取
      let text = currentText
      let context = currentContext
      if (!text && win) {
        const sel = win.getSelection()
        const raw = sel?.toString().trim()
        if (!raw) return
        text = raw
        context = raw
      }
      if (!text) return

      e.preventDefault()
      setAiState((prev) => ({
        ...prev,
        selectedWord: text,
        context: context ?? text,
        sidebarMode: 'dictionary',
      }))
    }

    const targets: (Window | undefined)[] = [window, win]
    targets.forEach((tw) => tw?.addEventListener('keydown', handleKey))
    return () => {
      targets.forEach((tw) => tw?.removeEventListener('keydown', handleKey))
    }
  }, [mobile, currentText, currentContext, settings.aiHotkey, setAiState, win])

  const el = view()?.element as HTMLElement
  if (!el) return null

  // it is possible that both `selection` and `tab.annotationRange`
  // are set when select end within an annotation
  const range = selection?.getRangeAt(0) ?? annotationRange
  if (!range) return null

  // prefer to display above the selection to avoid text selection helpers
  // https://stackoverflow.com/questions/68081757/hide-the-two-text-selection-helpers-in-mobile-browsers
  const forward = isTouchScreen
    ? false
    : selection
    ? isForwardSelection(selection)
    : true

  const rects = [...range.getClientRects()].filter((r) => Math.round(r.width))
  const anchorRect = rects && (forward ? last(rects) : rects[0])
  if (!anchorRect) return null

  const contents = range.cloneContents()
  const text = contents.textContent?.trim()
  if (!text) return null

  // Derive a broader context (sentence/paragraph) from the DOM
  const common = range.commonAncestorContainer
  const elementNode =
    common.nodeType === Node.ELEMENT_NODE
      ? (common as Element)
      : common.parentElement

  const fullText = elementNode?.textContent?.trim() || text

  if (text !== currentText || fullText !== currentContext) {
    setCurrentText(text)
    setCurrentContext(fullText)

    // 记录当前选区在屏幕中的垂直位置，用于决定移动端 AI 抽屉从上还是从下弹出
    const viewportHeight = win?.innerHeight ?? window.innerHeight
    if (viewportHeight) {
      const centerY = anchorRect.top + anchorRect.height / 2
      const panelPosition: 'top' | 'bottom' =
        centerY > viewportHeight / 2 ? 'top' : 'bottom'
      setAiState((prev) => ({
        ...prev,
        panelPosition,
      }))
    }
  }

  // If text selection menu is not explicitly enabled, skip rendering UI
  if (settings.enableTextSelectionMenu !== true) {
    return null
  }

  return (
    // to reset inner state
    <TextSelectionMenuRenderer
      tab={tab}
      range={range as Range}
      anchorRect={anchorRect}
      containerRect={el.parentElement!.getBoundingClientRect()}
      viewRect={el.getBoundingClientRect()}
      text={text}
      forward={forward}
      hide={() => {
        if (selection) {
          selection.removeAllRanges()
          setSelection(undefined)
        }
        /**
         * {@link range}
         */
        if (tab.annotationRange) {
          tab.annotationRange = undefined
        }
      }}
    />
  )
}

const ICON_SIZE = scale(22, 28)
const ANNOTATION_SIZE = scale(24, 30)

interface TextSelectionMenuRendererProps {
  tab: BookTab
  range: Range
  anchorRect: DOMRect
  containerRect: DOMRect
  viewRect: DOMRect
  text: string
  forward: boolean
  hide: () => void
}
const TextSelectionMenuRenderer: React.FC<TextSelectionMenuRendererProps> = ({
  tab,
  range,
  anchorRect,
  containerRect,
  viewRect,
  forward,
  text,
  hide,
}) => {
  const setAction = useSetAction()
  const ref = useRef<HTMLInputElement>(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const mobile = useMobile()
  const t = useTranslation('menu')

  const cfi = tab.rangeToCfi(range)
  const annotation = tab.book.annotations.find((a) => a.cfi === cfi)
  const [annotate, setAnnotate] = useState(!!annotation)

  const position = forward
    ? LayoutAnchorPosition.Before
    : LayoutAnchorPosition.After

  const { zoom } = useTypography(tab)
  const endContainer = forward ? range.endContainer : range.startContainer
  const _lineHeight = parseFloat(
    getComputedStyle(endContainer.parentElement!).lineHeight,
  )
  // no custom line height and the origin is keyword, e.g. 'normal'.
  const lineHeight = isNaN(_lineHeight)
    ? anchorRect.height
    : _lineHeight * (zoom ?? 1)

  return (
    <FocusLock disabled={mobile}>
      <Overlay
        // cover `sash`
        className="!z-50 !bg-transparent"
        onMouseDown={hide}
      />
      <div
        ref={(el) => {
          if (!el) return
          setWidth(el.clientWidth)
          setHeight(el.clientHeight)
          if (!mobile) {
            el.focus()
          }
        }}
        className={clsx(
          'bg-surface text-on-surface-variant shadow-1 absolute z-50 p-2 focus:outline-none',
        )}
        style={{
          left: layout(containerRect.width, width, {
            offset: anchorRect.left + viewRect.left - containerRect.left,
            size: anchorRect.width,
            mode: LayoutAnchorMode.ALIGN,
            position,
          }),
          top: layout(containerRect.height, height, {
            offset: anchorRect.top - (lineHeight - anchorRect.height) / 2,
            size: lineHeight,
            position,
          }),
        }}
        tabIndex={-1}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'c' && e.ctrlKey) {
            copy(text)
          }
        }}
      >
        {annotate ? (
          <div className="mb-3">
            <TextField
              mRef={ref}
              as="textarea"
              name="notes"
              defaultValue={annotation?.notes}
              hideLabel
              className="h-40 w-72"
              autoFocus
            />
          </div>
        ) : (
          <div className="text-on-surface-variant -mx- mb-3 flex gap-1">
            <IconButton
              title={t('copy')}
              Icon={MdCopyAll}
              size={ICON_SIZE}
              onClick={() => {
                hide()
                copy(text)
              }}
            />
            <IconButton
              title={t('search_in_book')}
              Icon={MdSearch}
              size={ICON_SIZE}
              onClick={() => {
                hide()
                setAction('search')
                tab.setKeyword(text)
              }}
            />
            <IconButton
              title={t('annotate')}
              Icon={MdOutlineEdit}
              size={ICON_SIZE}
              onClick={() => {
                setAnnotate(true)
              }}
            />
            {tab.isDefined(text) ? (
              <IconButton
                title={t('undefine')}
                Icon={MdOutlineIndeterminateCheckBox}
                size={ICON_SIZE}
                onClick={() => {
                  hide()
                  tab.undefine(text)
                }}
              />
            ) : (
              <IconButton
                title={t('define')}
                Icon={MdOutlineAddBox}
                size={ICON_SIZE}
                onClick={() => {
                  hide()
                  tab.define([text])
                }}
              />
            )}
          </div>
        )}
        <div className="space-y-2">
          {keys(typeMap).map((type) => (
            <div key={type} className="flex gap-2">
              {keys(colorMap).map((color) => (
                <div
                  key={color}
                  style={{
                    [typeMap[type].style]: colorMap[color],
                    width: ANNOTATION_SIZE,
                    height: ANNOTATION_SIZE,
                    fontSize: scale(16, 20),
                  }}
                  className={clsx(
                    'typescale-body-large text-on-surface-variant flex cursor-pointer items-center justify-center',
                    typeMap[type].class,
                  )}
                  onClick={() => {
                    tab.putAnnotation(
                      type,
                      cfi,
                      color,
                      text,
                      ref.current?.value,
                    )
                    hide()
                  }}
                >
                  A
                </div>
              ))}
            </div>
          ))}
        </div>
        {annotate && (
          <div className="mt-3 flex">
            {annotation && (
              <Button
                compact
                variant="secondary"
                onClick={() => {
                  tab.removeAnnotation(cfi)
                  hide()
                }}
              >
                {t('delete')}
              </Button>
            )}
            <Button
              className="ml-auto"
              compact
              onClick={() => {
                tab.putAnnotation(
                  annotation?.type ?? 'highlight',
                  cfi,
                  annotation?.color ?? 'yellow',
                  text,
                  ref.current?.value,
                )
                hide()
              }}
            >
              {t(annotation ? 'update' : 'create')}
            </Button>
          </div>
        )}
      </div>
    </FocusLock>
  )
}
