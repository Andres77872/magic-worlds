import type { Meta, StoryObj } from '@storybook/react-vite'
import { Portrait } from './Portrait'
import { ThemeSongButton } from './ThemeSongButton'

// Tiny silent WAV so toggling works without a backend (real themes are mp3 URLs).
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

const meta = {
  title: 'Primitives/ThemeSongButton',
  component: ThemeSongButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Circular play/pause control for a card\'s theme song, overlaid on the portrait next to the actions menu. Lazily owns one `HTMLAudioElement`, claims app-wide audio focus on play (one track at a time, shared with AudioWavePlayer), and never lets the click bubble into the enclosing clickable card.',
      },
    },
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    src: { control: false },
  },
  args: { src: SILENT_WAV, size: 'sm' },
} satisfies Meta<typeof ThemeSongButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Medium: Story = { args: { size: 'md' } }

/** In context: top-right of a card portrait, beside where the ⋮ menu sits. */
export const OnAPortrait: Story = {
  render: (args) => (
    <div className="relative w-44 overflow-hidden rounded-xl border border-parchment-50/10">
      <Portrait name="Lyra Dawnwhisper" height={230} />
      <div className="absolute right-2 top-2">
        <ThemeSongButton {...args} />
      </div>
    </div>
  ),
}
