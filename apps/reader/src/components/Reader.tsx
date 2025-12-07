import { useEventListener } from '@literal-ui/hooks'
import clsx from 'clsx'
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { MdChevronRight, MdWebAsset } from 'react-icons/md'
import { RiBookLine } from 'react-icons/ri'
import { PhotoSlider } from 'react-photo-view'
import useTilg from 'tilg'
import { useSnapshot } from 'valtio'

import { RenditionSpread } from '@flow/epubjs/types/rendition'
import { useAiState, useSettings } from '@flow/reader/state'

import { db } from '../db'
import { handleFiles } from '../file'
import {
  hasSelection,
  useBackground,
  useColorScheme,
  useDisablePinchZooming,
  useMobile,
  useSync,
  useTranslation,
  useTypography,
} from '../hooks'
import { BookTab, reader, useReaderSnapshot } from '../models'
import { isTouchScreen } from '../platform'
import { updateCustomStyle } from '../styles'

import { Annotations } from './Annotation'
import { Tab } from './Tab'
import { TextSelectionMenu } from './TextSelectionMenu'
import { DropZone, SplitView, useDndContext, useSplitViewItem } from './base'
import * as pages from './pages'

function handleKeyDown(tab?: BookTab) {
  return (e: KeyboardEvent) => {
    try {
      switch (e.code) {
        case 'ArrowLeft':
        case 'ArrowUp':
          tab?.prev()
          break
        case 'ArrowRight':
        case 'ArrowDown':
          tab?.next()
          break
        case 'Space':
          e.shiftKey ? tab?.prev() : tab?.next()
      }
    } catch (error) {
      // ignore `rendition is undefined` error
    }
  }
}

export function ReaderGridView() {
  const { groups } = useReaderSnapshot()

  useEventListener('keydown', handleKeyDown(reader.focusedBookTab))

  if (!groups.length) return null
  return (
    <SplitView className={clsx('ReaderGridView')}>
      {groups.map(({ id }, i) => (
        <ReaderGroup key={id} index={i} />
      ))}
    </SplitView>
  )
}

interface ReaderGroupProps {
  index: number
}
function ReaderGroup({ index }: ReaderGroupProps) {
  const group = reader.groups[index]!
  const { focusedIndex } = useReaderSnapshot()
  const { tabs, selectedIndex } = useSnapshot(group)
  const t = useTranslation()

  const { size } = useSplitViewItem(`${ReaderGroup.name}.${index}`, {
    // to disable sash resize
    visible: false,
  })

  const handleMouseDown = useCallback(() => {
    reader.selectGroup(index)
  }, [index])

  return (
    <div
      className="ReaderGroup flex flex-1 flex-col overflow-hidden focus:outline-none"
      onMouseDown={handleMouseDown}
      style={{ width: size }}
    >
      <Tab.List
        className="hidden sm:flex"
        onDelete={() => reader.removeGroup(index)}
      >
        {tabs.map((tab, i) => {
          const selected = i === selectedIndex
          const focused = index === focusedIndex && selected
          return (
            <Tab
              key={tab.id}
              selected={selected}
              focused={focused}
              onClick={() => group.selectTab(i)}
              onDelete={() => reader.removeTab(i, index)}
              Icon={tab instanceof BookTab ? RiBookLine : MdWebAsset}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', `${index},${i}`)
              }}
            >
              {tab.isBook ? tab.title : t(`${tab.title}.title`)}
            </Tab>
          )
        })}
      </Tab.List>

      <DropZone
        className={clsx('flex-1', isTouchScreen || 'h-0')}
        split
        onDrop={async (e, position) => {
          // read `e.dataTransfer` first to avoid get empty value after `await`
          const files = e.dataTransfer.files
          let tabs = []

          if (files.length) {
            tabs = await handleFiles(files)
          } else {
            const text = e.dataTransfer.getData('text/plain')
            const fromTab = text.includes(',')

            if (fromTab) {
              const indexes = text.split(',')
              const groupIdx = Number(indexes[0])

              if (index === groupIdx) {
                if (group.tabs.length === 1) return
                if (position === 'universe') return
              }

              const tabIdx = Number(indexes[1])
              const tab = reader.removeTab(tabIdx, groupIdx)
              if (tab) tabs.push(tab)
            } else {
              const id = text
              const tabParam =
                Object.values(pages).find((p) => p.displayName === id) ??
                (await db?.books.get(id))
              if (tabParam) tabs.push(tabParam)
            }
          }

          if (tabs.length) {
            switch (position) {
              case 'left':
                reader.addGroup(tabs, index)
                break
              case 'right':
                reader.addGroup(tabs, index + 1)
                break
              default:
                tabs.forEach((t) => reader.addTab(t, index))
            }
          }
        }}
      >
        {group.tabs.map((tab, i) => (
          <PaneContainer
            active={i === selectedIndex}
            isPage={!(tab instanceof BookTab)}
            key={tab.id}
          >
            {tab instanceof BookTab ? (
              <BookPane tab={tab} onMouseDown={handleMouseDown} />
            ) : (
              <tab.Component />
            )}
          </PaneContainer>
        ))}
      </DropZone>
    </div>
  )
}

interface PaneContainerProps {
  active: boolean
  isPage?: boolean
}
const PaneContainer: React.FC<PaneContainerProps> = ({ active, isPage, children }) => {
  return (
    <div className={clsx('h-full', active || 'hidden', isPage && 'overflow-auto')}>
      {children}
    </div>
  )
}

interface BookPaneProps {
  tab: BookTab
  onMouseDown: () => void
}

function BookPane({ tab, onMouseDown }: BookPaneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const prevSize = useRef(0)
  const typography = useTypography(tab)
  const { dark } = useColorScheme()
  const [background] = useBackground()
  const [settings] = useSettings()

  const { iframe, rendition, rendered } = useSnapshot(tab)
  const [aiState, setAiState] = useAiState()

  useTilg()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver(([e]) => {
      const size = e?.contentRect.width ?? 0
      // `display: hidden` will lead `rect` to 0
      if (size !== 0 && prevSize.current !== 0) {
        reader.resize()
      }
      prevSize.current = size
    })

    observer.observe(el)

    return () => {
      observer.disconnect()
    }
  }, [])

  useSync(tab)
  const mobile = useMobile()

  const applyCustomStyle = useCallback(() => {
    const contents = rendition?.getContents()[0]
    updateCustomStyle(contents, typography)
  }, [rendition, typography])

  useEffect(() => {
    tab.onRender = applyCustomStyle
  }, [applyCustomStyle, tab])

  useEffect(() => {
    if (ref.current) tab.render(ref.current)
  }, [tab])

  useEffect(() => {
    /**
     * when `spread` changes, we should call `spread()` to re-layout,
     * then call {@link updateCustomStyle} to update custom style
     * according to the latest layout
     */
    rendition?.spread(typography.spread ?? RenditionSpread.Auto)
  }, [typography.spread, rendition])

  useEffect(() => applyCustomStyle(), [applyCustomStyle])

  useEffect(() => {
    if (dark === undefined) return
    // set `!important` when in dark mode
    rendition?.themes.override('color', dark ? '#bfc8ca' : '#3f484a', dark)
  }, [rendition, dark])

  const [src, setSrc] = useState<string>()

  useEffect(() => {
    if (src) {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement?.blur()
    }
  }, [src])

  const { setDragEvent } = useDndContext()

  // `dragenter` not fired in iframe when the count of times is even, so use `dragover`
  useEventListener(iframe, 'dragover', (e: any) => {
    console.log('drag enter in iframe')
    setDragEvent(e)
  })

  useEventListener(iframe, 'mousedown', onMouseDown)

  useEventListener(iframe, 'click', (e) => {
    // https://developer.chrome.com/blog/tap-to-search
    e.preventDefault()

    for (const el of e.composedPath() as any) {
      // `instanceof` may not work in iframe
      if (el.tagName === 'A' && el.href) {
        tab.showPrevLocation()
        return
      }
      if (
        mobile === false &&
        el.tagName === 'IMG' &&
        el.src.startsWith('blob:')
      ) {
        setSrc(el.src)
        return
      }
    }

    // Disable tap-to-turn-page on touch devices; keep swipe / wheel / keyboard navigation.
    // Previously, when `isTouchScreen && container`, tapping left/right regions would call
    // `tab.prev()` / `tab.next()` or toggle navbar. That behavior is now removed on request.
  })

  useEventListener(iframe, 'wheel', (e) => {
    if (e.deltaY < 0) {
      tab.prev()
    } else {
      tab.next()
    }
  })

  useEventListener(iframe, 'keydown', handleKeyDown(tab))

  useEventListener(iframe, 'touchstart', (e) => {
    const x0 = e.targetTouches[0]?.clientX ?? 0
    const y0 = e.targetTouches[0]?.clientY ?? 0
    const t0 = Date.now()

    if (!iframe) return

    // When selecting text with long tap, `touchend` is not fired,
    // so instead of use `addEventlistener`, we should use `on*`
    // to remove the previous listener.
    iframe.ontouchend = function handleTouchEnd(e: TouchEvent) {
      iframe.ontouchend = undefined
      const selection = iframe.getSelection()
      if (hasSelection(selection)) return

      const x1 = e.changedTouches[0]?.clientX ?? 0
      const y1 = e.changedTouches[0]?.clientY ?? 0
      const t1 = Date.now()

      const deltaX = x1 - x0
      const deltaY = y1 - y0
      const deltaT = t1 - t0

      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      if (absX < 10) return

      if (absY / absX > 2) {
        if (deltaT > 100 || absX < 30) {
          return
        }
      }

      if (deltaX > 0) {
        tab.prev()
      }

      if (deltaX < 0) {
        tab.next()
      }
    }
  })

  useDisablePinchZooming(iframe)

  // Keep a quiz context snippet from the current chapter for reading tests
  useEffect(() => {
    if (!iframe) return
    const doc = iframe.document
    if (!doc || !doc.body) return

    const textContent = doc.body.innerText || doc.body.textContent || ''
    const normalized = textContent
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .trim()

    if (!normalized) return

    // Use the beginning of the chapter so questions cover what was just read.
    // Limit length to keep prompt size reasonable.
    const maxLen = 4000
    const slice = normalized.slice(0, maxLen)

    setAiState((prev) => ({
      ...prev,
      quizContext: slice,
    }))
  }, [iframe, setAiState])

  // Highlight vocabulary words across all books
  useEffect(() => {
    if (!iframe) return

    const vocab = aiState.vocabulary
    const tooltipFontSize = settings.vocabTooltipFontSize ?? 12

    const applyHighlights = () => {
      // Get fresh document reference each time
      const doc = iframe.document
      if (!doc || !doc.body) return

      if (!vocab || vocab.length === 0) {
        clearVocabularyHighlights(doc)
        return
      }

      highlightVocabularyInDocument(doc, vocab, (word) => {
        setAiState((prev) => ({
          ...prev,
          vocabulary: prev.vocabulary.filter(
            (v) => v.word.toLowerCase() !== word.toLowerCase(),
          ),
        }))
      }, tooltipFontSize)
    }

    // Apply highlights initially
    applyHighlights()

    // Reapply highlights when user navigates (e.g., page turn)
    const rendition = tab.rendition
    if (rendition) {
      const handleRelocated = () => {
        // Small delay to ensure DOM is ready
        setTimeout(applyHighlights, 150)
      }
      
      rendition.on('relocated', handleRelocated)
      
      return () => {
        rendition.off('relocated', handleRelocated)
      }
    }
  }, [iframe, aiState.vocabulary, setAiState, settings.vocabTooltipFontSize, tab.rendition])

  return (
    <div className={clsx('flex h-full flex-col', mobile && 'py-[3vw]')}>
      <PhotoSlider
        images={[{ src, key: 0 }]}
        visible={!!src}
        onClose={() => setSrc(undefined)}
        maskOpacity={0.6}
        bannerVisible={false}
      />
      <ReaderPaneHeader tab={tab} />
      <div
        ref={ref}
        className={clsx('relative flex-1', isTouchScreen || 'h-0')}
        // `color-scheme: dark` will make iframe background white
        style={{ colorScheme: 'auto' }}
      >
        <div
          className={clsx(
            'absolute inset-0',
            // do not cover `sash`
            'z-20',
            rendered && 'hidden',
            background,
          )}
        >
          <div className="flex h-full items-center justify-center">
            <span className="typescale-body-medium text-on-surface/80">
              正在加载图书…
            </span>
          </div>
        </div>
        <TextSelectionMenu tab={tab} />
        <Annotations tab={tab} />
      </div>
      <ReaderPaneFooter tab={tab} />
    </div>
  )
}

function clearVocabularyHighlights(doc: Document) {
  const spans = Array.from(doc.querySelectorAll<HTMLSpanElement>('.vocab-highlight'))
  for (const span of spans) {
    const parent = span.parentNode
    if (!parent) continue
    parent.replaceChild(doc.createTextNode(span.textContent || ''), span)
    parent.normalize()
  }
  const tooltip = doc.getElementById('vocab-tooltip')
  if (tooltip && tooltip.parentNode) {
    tooltip.parentNode.removeChild(tooltip)
  }
}

interface VocabItem {
  word: string
  explanation?: string
  context?: string
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightVocabularyInDocument(
  doc: Document,
  vocabulary: VocabItem[],
  onDelete: (word: string) => void,
  tooltipFontSize: number,
) {
  clearVocabularyHighlights(doc)

  const words = Array.from(
    new Set(
      vocabulary
        .map((v) => v.word.trim())
        .filter((w) => w.length > 0),
    ),
  )

  if (words.length === 0) return

  const pattern = words.map(escapeRegExp).join('|')
  const regex = new RegExp(`\\b(${pattern})\\b`, 'gi')

  const body = doc.body
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (!current.parentElement) continue
    // Skip inside existing highlights or script/style
    const parentTag = current.parentElement.tagName
    if (
      current.parentElement.closest('.vocab-highlight') ||
      parentTag === 'SCRIPT' ||
      parentTag === 'STYLE'
    ) {
      continue
    }
    textNodes.push(current as Text)
  }

  for (const node of textNodes) {
    const text = node.textContent
    if (!text) continue
    if (!regex.test(text)) {
      regex.lastIndex = 0
      continue
    }
    regex.lastIndex = 0

    const frag = doc.createDocumentFragment()
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text))) {
      const matchText = match[0] ?? ''
      const start = match.index
      if (start > lastIndex) {
        frag.appendChild(doc.createTextNode(text.slice(lastIndex, start)))
      }
      const span = doc.createElement('span')
      span.className = 'vocab-highlight'
      span.textContent = matchText
      span.setAttribute('data-word', matchText.toLowerCase())
      frag.appendChild(span)
      lastIndex = start + matchText.length
    }
    if (lastIndex < text.length) {
      frag.appendChild(doc.createTextNode(text.slice(lastIndex)))
    }
    node.parentNode?.replaceChild(frag, node)
  }

  // Inject styles to both iframe and main window
  const styleContent = (titleFontSize: number, bodyFontSize: number) => `
    .vocab-highlight {
      text-decoration-line: underline;
      text-decoration-style: wavy;
      text-decoration-color: #ef4444; /* red */
      text-decoration-thickness: 1.5px;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    #vocab-tooltip {
      position: absolute;
      min-width: 146px;
      max-width: 240px;
      max-height: 320px;
      overflow-y: auto;
      overflow-x: auto;
      background: #ffffff;
      color: #111827;
      border-radius: 0.5rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.18);
      padding: 0.5rem 0.75rem;
      font-size: ${titleFontSize}px !important;
      line-height: 1.5;
      z-index: 99999 !important;
    }
    @media (max-width: 640px) {
      #vocab-tooltip {
        min-width: 200px;
        max-width: 90vw;
      }
    }
    #vocab-tooltip-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
      font-size: ${titleFontSize}px !important;
    }
    #vocab-tooltip-body {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: ${bodyFontSize}px !important;
    }
  `

  const titleFontSize = tooltipFontSize
  const bodyFontSize = Math.max(tooltipFontSize - 1, 8)
  
  // Inject to iframe document
  let style = doc.getElementById('vocab-style') as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = 'vocab-style'
    doc.head.appendChild(style)
  }
  style.textContent = styleContent(titleFontSize, bodyFontSize)
  
  // Also inject to main window document for mobile tooltips
  let mainStyle = window.document.getElementById('vocab-style-main') as HTMLStyleElement | null
  if (!mainStyle) {
    mainStyle = window.document.createElement('style')
    mainStyle.id = 'vocab-style-main'
    window.document.head.appendChild(mainStyle)
  }
  mainStyle.textContent = styleContent(titleFontSize, bodyFontSize)

  // Attach click handler
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target) return
    const span = target.closest('.vocab-highlight') as HTMLElement | null

    // Remove existing tooltip from both iframe and main window
    const existingInIframe = doc.getElementById('vocab-tooltip')
    if (existingInIframe && existingInIframe.parentNode) {
      existingInIframe.parentNode.removeChild(existingInIframe)
    }
    const existingInWindow = window.document.getElementById('vocab-tooltip')
    if (existingInWindow && existingInWindow.parentNode) {
      existingInWindow.parentNode.removeChild(existingInWindow)
    }

    if (!span) return

    const word = (span.getAttribute('data-word') || span.textContent || '').toLowerCase()
    const item = vocabulary.find((v) => v.word.toLowerCase() === word)

    const rect = span.getBoundingClientRect()
    
    // Detect mobile to decide positioning strategy
    const windowWidth = window.innerWidth
    const isMobileDevice = windowWidth <= 640
    
    // Always create tooltip in main window to ensure it appears above RightSidebar
    const targetDoc = window.document
    const tooltip = targetDoc.createElement('div')
    tooltip.id = 'vocab-tooltip'

    const title = targetDoc.createElement('div')
    title.id = 'vocab-tooltip-title'
    title.style.display = 'flex'
    title.style.alignItems = 'center'
    title.style.justifyContent = 'flex-start'

    const wordSpan = targetDoc.createElement('span')
    wordSpan.textContent = item?.word || span.textContent || ''

    const deleteBtn = targetDoc.createElement('button')
    deleteBtn.textContent = 'Delete'
    deleteBtn.style.fontSize = '11px'
    deleteBtn.style.color = '#b91c1c'
    deleteBtn.style.cursor = 'pointer'
    deleteBtn.style.background = 'transparent'
    deleteBtn.style.border = 'none'
    deleteBtn.style.marginLeft = '8px'
    deleteBtn.onclick = (ev) => {
      ev.stopPropagation()
      onDelete(word)
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip)
      }
    }

    title.appendChild(wordSpan)
    title.appendChild(deleteBtn)

    const body = targetDoc.createElement('div')
    body.id = 'vocab-tooltip-body'
    body.textContent = item?.explanation || 'No explanation saved yet.'

    tooltip.appendChild(title)
    tooltip.appendChild(body)

    const viewportHeight = doc.defaultView?.innerHeight ?? 0

    // Detect mobile by checking main window width, not iframe width
    const mainWindowWidth = window.innerWidth
    const isMobile = mainWindowWidth <= 640 // Same as useMobile hook

    // Detect RightSidebar width to avoid overlap (desktop only)
    let rightSidebarWidth = 0
    
    if (!isMobile) {
      try {
        const rightSidebar = window.document.querySelector('.RightSidebar')
        if (rightSidebar) {
          const sidebarRect = rightSidebar.getBoundingClientRect()
          rightSidebarWidth = sidebarRect.width
        }
      } catch (e) {
        // Ignore errors if sidebar not found
      }
    }

    // First attach to measure size
    tooltip.style.visibility = 'hidden'
    targetDoc.body.appendChild(tooltip)
    const tipRect = tooltip.getBoundingClientRect()

    let top = rect.bottom + 6
    // If tooltip would go out of viewport bottom, show above the word
    if (top + tipRect.height > viewportHeight - 8) {
      top = rect.top - tipRect.height - 6
      if (top < 8) top = 8
    }

    let left = rect.left
    
    // Always use fixed positioning since tooltip is in main window
    tooltip.style.position = 'fixed'
    
    if (isMobileDevice) {
      // Mobile: center on screen
      const mainWindowHeight = window.innerHeight
      left = (windowWidth - tipRect.width) / 2
      top = (mainWindowHeight - tipRect.height) / 2
    } else {
      // Desktop: position near the word, avoid right sidebar
      const padding = 16
      const mainWindowWidth = window.innerWidth
      const availableWidth = mainWindowWidth - rightSidebarWidth - padding
      const maxLeft = availableWidth - tipRect.width
      if (left > maxLeft) left = maxLeft
      if (left < 8) left = 8
      
      // No need to add scrollX/scrollY for fixed positioning
    }
    
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${top}px`
    tooltip.style.visibility = 'visible'
  }

  // To avoid stacking multiple handlers, remove previous and add new
  const previousHandler = (doc as any)._vocabClickHandler
  if (previousHandler) {
    doc.removeEventListener('click', previousHandler)
  }
  ;(doc as any)._vocabClickHandler = handleClick
  doc.addEventListener('click', handleClick)
}

interface ReaderPaneHeaderProps {
  tab: BookTab
}
const ReaderPaneHeader: React.FC<ReaderPaneHeaderProps> = ({ tab }) => {
  const { location } = useSnapshot(tab)
  const navPath = tab.getNavPath()

  useEffect(() => {
    navPath.forEach((i) => (i.expanded = true))
  }, [navPath])

  const handlePageClick = () => {
    if (!location) return
    const current = location.start.displayed.page
    const total = location.start.displayed.total
    if (!total || total <= 0) return

    const input = window.prompt(`输入页码 (1-${total})`, String(current))
    if (!input) return

    const target = Number.parseInt(input, 10)
    if (!Number.isFinite(target) || target < 1 || target > total) return

    const delta = target - current
    if (delta === 0) return

    try {
      if (delta > 0) {
        for (let i = 0; i < delta; i++) tab.next()
      } else {
        for (let i = 0; i < -delta; i++) tab.prev()
      }
    } catch {
      // ignore navigation errors
    }
  }

  return (
    <Bar>
      <div className="scroll-h flex">
        {navPath.map((item, i) => (
          <button
            key={i}
            className="hover:text-on-surface flex shrink-0 items-center"
          >
            {item.label}
            {i !== navPath.length - 1 && <MdChevronRight size={20} />}
          </button>
        ))}
      </div>
      {location && (
        <button
          type="button"
          onClick={handlePageClick}
          className="hover:text-on-surface shrink-0 underline-offset-2 hover:underline"
        >
          {location.start.displayed.page} / {location.start.displayed.total}
        </button>
      )}
    </Bar>
  )
}

interface FooterProps {
  tab: BookTab
}
const ReaderPaneFooter: React.FC<FooterProps> = ({ tab }) => {
  const { locationToReturn, location, book } = useSnapshot(tab)

  return (
    <Bar>
      {locationToReturn ? (
        <>
          <button
            className={clsx(locationToReturn || 'invisible')}
            onClick={() => {
              tab.hidePrevLocation()
              tab.display(locationToReturn.end.cfi, false)
            }}
          >
            Return to {locationToReturn.end.cfi}
          </button>
          <button
            onClick={() => {
              tab.hidePrevLocation()
            }}
          >
            Stay
          </button>
        </>
      ) : (
        <>
          <div>{location?.start.href}</div>
          <div>{((book.percentage ?? 0) * 100).toFixed()}%</div>
        </>
      )}
    </Bar>
  )
}

interface LineProps extends ComponentProps<'div'> {}
const Bar: React.FC<LineProps> = ({ className, ...props }) => {
  return (
    <div
      className={clsx(
        'typescale-body-small text-outline flex h-6 items-center justify-between gap-2 px-[4vw] sm:px-2',
        className,
      )}
      {...props}
    ></div>
  )
}
