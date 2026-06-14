import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { WaveformSeekBar } from './WaveformSeekBar'

// Deterministic pseudo-waveform (no Math.random) so the strip looks stable across runs.
const PEAKS = Array.from({ length: 48 }, (_, i) =>
  Math.min(1, 0.32 + 0.46 * Math.abs(Math.sin(i * 0.7)) + 0.16 * Math.abs(Math.cos(i * 0.31))),
)

const DURATION = 184

const meta = {
  title: 'Components/Audio/WaveformSeekBar',
  component: WaveformSeekBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A waveform strip that *is* the seek bar: 48 peak-sized bars, the played fraction filled ember (candlelight), the rest parchment-dim. Drag to scrub, arrow keys nudge ±5s, Home/End jump to the ends. Presentational — real playback state comes from the global playlist player.',
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
    engaged: { control: 'boolean', description: 'Playback has started — render the strip at full presence.' },
    disabled: { control: 'boolean' },
    label: { control: 'text', description: 'Accessible name for the slider.' },
    peaks: { control: false },
    progress: { control: false },
    currentTime: { control: false },
    duration: { control: false },
    onSeekRatio: { control: false },
  },
  args: {
    engaged: true,
    disabled: false,
    label: 'Seek within Theme of the Vitrine Expanse',
    peaks: PEAKS,
    progress: 0.38,
    currentTime: 0.38 * DURATION,
    duration: DURATION,
    onSeekRatio: () => {},
  },
} satisfies Meta<typeof WaveformSeekBar>

export default meta
type Story = StoryObj<typeof meta>

/** Drag or use the arrow keys — the ember fill follows the played fraction. */
function ControlledWave(args: ComponentProps<typeof WaveformSeekBar>) {
  const [progress, setProgress] = useState(args.progress)
  return (
    <WaveformSeekBar
      {...args}
      progress={progress}
      currentTime={progress * (args.duration ?? DURATION)}
      onSeekRatio={setProgress}
    />
  )
}

export const Default: Story = { render: (args) => <ControlledWave {...args} /> }

export const NotEngaged: Story = { args: { engaged: false }, render: (args) => <ControlledWave {...args} /> }

export const Disabled: Story = { args: { disabled: true }, render: (args) => <ControlledWave {...args} /> }
