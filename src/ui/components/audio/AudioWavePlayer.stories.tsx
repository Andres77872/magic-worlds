import type { Meta, StoryObj } from '@storybook/react-vite'
import { AudioWavePlayer } from './AudioWavePlayer'

// Tiny silent WAV keeps the control interactive without a backend; real theme
// URLs decode into true peaks that morph in on first play.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

const meta = {
  title: 'Components/Audio/AudioWavePlayer',
  component: AudioWavePlayer,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The Reverie audio play bar: circular play/pause beside a waveform seek strip with a mono time readout. Idle tracks show dim deterministic pseudo-peaks seeded per track (`peakSeed`); the real decoded waveform morphs in on first play, and the fetched bytes are shared with the download action\'s cache. Claims app-wide audio focus — one track plays at a time.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[360px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    src: { control: false },
    onPlayingChange: { control: false },
    title: { control: 'text' },
    peakSeed: { control: 'text' },
    durationMs: { control: 'number' },
  },
  args: {
    src: SILENT_WAV,
    title: 'Theme of the Vitrine Expanse',
    durationMs: 94_000,
    peakSeed: 'vitrine-expanse',
  },
} satisfies Meta<typeof AudioWavePlayer>

export default meta
type Story = StoryObj<typeof meta>

/** Dormant: dim pseudo-peaks seeded by the track, duration from metadata fallback. */
export const Default: Story = {}

/** Different seeds render different (but stable) dormant waveforms. */
export const SeedVariety: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <AudioWavePlayer {...args} peakSeed="ember-march" title="Ember March" />
      <AudioWavePlayer {...args} peakSeed="shardwright-lullaby" title="Shardwright Lullaby" />
      <AudioWavePlayer {...args} peakSeed="glassworm-depths" title="Glassworm Depths" />
    </div>
  ),
}
