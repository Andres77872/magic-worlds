import { useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { usePlaylist } from '@/app/hooks/usePlaylist'
import { themeTrack } from '@/app/providers/audioPlaylistContext'
import { PlaylistDock } from './PlaylistDock'

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

function SeededPlaylistDock() {
  const playlist = usePlaylist()

  useEffect(() => {
    playlist.enqueue(
      themeTrack({
        url: `${SILENT_WAV}#luthien`,
        title: 'Luthien Brillaluz',
        cardName: 'Luthien Brillaluz',
        durationMs: 155_000,
      }),
    )
    playlist.enqueue(
      themeTrack({
        url: `${SILENT_WAV}#ember`,
        title: 'Emberglass Waltz',
        cardName: 'The Vitrine Expanse',
        durationMs: 94_000,
      }),
    )
  }, [playlist.enqueue])

  return (
    <div className="min-h-[420px] w-full">
      <PlaylistDock />
    </div>
  )
}

const meta = {
  title: 'Components/Audio/PlaylistDock',
  component: PlaylistDock,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The floating Reverie playlist dock: persistent transport controls, waveform seeking, queue management, volume and mute, download, drag positioning, and repeat modes.',
      },
    },
  },
  argTypes: {
    onOpenCard: { control: false },
  },
} satisfies Meta<typeof PlaylistDock>

export default meta
type Story = StoryObj<typeof meta>

export const Seeded: Story = {
  render: () => <SeededPlaylistDock />,
}
