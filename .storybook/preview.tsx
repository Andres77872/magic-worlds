import { useEffect } from 'react'
import type { Preview, Decorator } from '@storybook/react-vite'
import { I18nextProvider } from 'react-i18next'
// Single source of truth: this pulls in Tailwind, the @theme tokens, the base
// layer (dark ink canvas, parchment text, Hanken UI font, candlelit focus
// ring) and the .chat-prose component styles. Because the base layer styles
// the preview <body>, every story renders on the Reverie canvas automatically.
import '../src/ui/styles/theme.css'
// Side-effect import initialises i18next so components that call useTranslation
// render real copy (not raw keys) inside the isolated preview iframe.
import { i18n } from '../src/app/i18n'
import { AudioPlaylistProvider } from '../src/app/providers/AudioPlaylistProvider'

/**
 * Light frame around each story: brand UI font + comfortable padding, the
 * global playlist context so audio surfaces (ThemeSongButton, AudioWavePlayer,
 * PlaylistDock) render in isolation, and the i18n provider so translated copy
 * resolves. The `locale` toolbar global flips between English and Spanish.
 */
const withReverieFrame: Decorator = (Story, context) => {
  const locale = (context.globals.locale as string) ?? 'en'
  useEffect(() => {
    void i18n.changeLanguage(locale)
  }, [locale])
  return (
    <I18nextProvider i18n={i18n}>
      <AudioPlaylistProvider>
        <div className="font-ui text-parchment-50" style={{ padding: '1.5rem' }}>
          <Story />
        </div>
      </AudioPlaylistProvider>
    </I18nextProvider>
  )
}

const preview: Preview = {
  decorators: [withReverieFrame],
  parameters: {
    layout: 'centered',
    backgrounds: {
      options: {
        ink900: { name: 'ink-900 · void', value: '#0e0c14' },
        ink800: { name: 'ink-800 · canvas', value: '#14111c' },
        ink700: { name: 'ink-700 · surface', value: '#1b1726' },
      },
    },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    a11y: {
      // Surface axe findings in the panel without failing CI — the candlelit
      // low-contrast hairlines and borders are a deliberate aesthetic choice.
      test: 'todo',
    },
    options: {
      storySort: {
        order: [
          'Design System',
          ['Overview', 'Foundations', 'Brand'],
          'Primitives',
          'Components',
          'Creation',
          'Interaction',
          'Landing',
        ],
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: 'ink800' },
    locale: 'en',
  },
  globalTypes: {
    locale: {
      description: 'Interface language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'es', title: 'Español' },
        ],
        dynamicTitle: true,
      },
    },
  },
}

export default preview
