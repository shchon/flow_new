import clsx from 'clsx'
import { ComponentProps } from 'react'

import { range } from '@flow/internal'
import {
  useBackground,
  useColorScheme,
  useSourceColor,
  useTranslation,
} from '@flow/reader/hooks'

import { ColorPicker, Label } from '../Form'
import { PaneViewProps, PaneView, Pane } from '../base'

// Preset reading themes optimized for comfortable reading
const PRESET_THEMES = [
  {
    name: '经典白',
    description: 'Classic White',
    previewBg: '#FFFFFF',
    sourceColor: '#1976D2',
    scheme: 'light' as const,
    backgroundIndex: -1,
  },
  {
    name: '护眼绿',
    description: 'Eye-care Green',
    previewBg: '#C7EDCC',
    sourceColor: '#4CAF50', // Green theme color
    scheme: 'light' as const,
    backgroundIndex: 1,
  },
  {
    name: '温暖米',
    description: 'Warm Beige',
    previewBg: '#F5E6D3',
    sourceColor: '#FF9800', // Orange theme color
    scheme: 'light' as const,
    backgroundIndex: 3,
  },
  {
    name: '柔和灰',
    description: 'Soft Gray',
    previewBg: '#E8E8E8',
    sourceColor: '#9C27B0', // Purple theme color
    scheme: 'light' as const,
    backgroundIndex: 5,
  },
  {
    name: '夜间黑',
    description: 'Night Black',
    previewBg: '#1A1A1A',
    sourceColor: '#64B5F6', // Light blue for dark mode
    scheme: 'dark' as const,
    backgroundIndex: -1,
  },
]

export const ThemeView: React.FC<PaneViewProps> = (props) => {
  const { setScheme } = useColorScheme()
  const { sourceColor, setSourceColor } = useSourceColor()
  const [, setBackground] = useBackground()
  const t = useTranslation('theme')

  const applyPresetTheme = (theme: typeof PRESET_THEMES[0]) => {
    setScheme(theme.scheme)
    setSourceColor(theme.sourceColor)
    setBackground(theme.backgroundIndex)
  }

  return (
    <PaneView {...props}>
      <Pane headline={t('title')} className="space-y-4 px-5 pt-2 pb-4">
        {/* Preset Themes */}
        <div>
          <Label name="预设主题 / Preset Themes"></Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {PRESET_THEMES.map((theme, index) => (
              <button
                key={index}
                className="flex flex-col items-start p-3 rounded-lg border-2 border-surface-variant hover:border-primary transition-colors text-left"
                onClick={() => applyPresetTheme(theme)}
                style={{ backgroundColor: theme.previewBg }}
              >
                <div className="font-medium text-sm mb-1" style={{ color: theme.sourceColor }}>
                  {theme.name}
                </div>
                <div className="text-xs opacity-70" style={{ color: theme.scheme === 'dark' ? '#FFFFFF' : '#000000' }}>
                  {theme.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Color Picker */}
        <div>
          <ColorPicker
            name={t('source_color') + ' / 自定义主题色'}
            defaultValue={sourceColor}
            onChange={(e) => {
              setSourceColor(e.target.value)
            }}
          />
        </div>

        {/* Background Color Options */}
        <div>
          <Label name={t('background_color') + ' / 自定义背景'}></Label>
          <div className="flex gap-2 mt-2">
            {range(7)
              .filter((i) => !(i % 2))
              .map((i) => i - 1)
              .map((i) => (
                <Background
                  key={i}
                  className={i > 0 ? `bg-surface${i}` : 'bg-white'}
                  onClick={() => {
                    setScheme('light')
                    setBackground(i)
                  }}
                />
              ))}
            <Background
              className="bg-black"
              onClick={() => {
                setScheme('dark')
              }}
            />
          </div>
        </div>
      </Pane>
    </PaneView>
  )
}

interface BackgroundProps extends ComponentProps<'div'> {}
const Background: React.FC<BackgroundProps> = ({ className, ...props }) => {
  return (
    <div
      className={clsx('border-outline-variant light h-6 w-6 border', className)}
      {...props}
    ></div>
  )
}
