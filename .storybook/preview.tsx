import type { Preview, Decorator } from '@storybook/react-vite'
// Single source of truth: this pulls in Tailwind, the @theme tokens, the base
// layer (dark ink canvas, parchment text, Hanken UI font, candlelit focus
// ring) and the .chat-prose component styles. Because the base layer styles
// the preview <body>, every story renders on the Reverie canvas automatically.
import '../src/ui/styles/theme.css'
import { AudioPlaylistProvider } from '../src/app/providers/AudioPlaylistProvider'

/**
 * Light frame around each story: brand UI font + comfortable padding, plus
 * the global playlist context so audio surfaces (ThemeSongButton,
 * AudioWavePlayer, PlaylistDock) render in isolation.
 */
const withReverieFrame: Decorator = (Story) => (
  <AudioPlaylistProvider>
    <div className="font-ui text-parchment-50" style={{ padding: '1.5rem' }}>
      <Story />
    </div>
  </AudioPlaylistProvider>
)

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
  },
}

export default preview
