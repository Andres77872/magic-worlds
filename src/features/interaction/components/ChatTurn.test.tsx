import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatTurn } from './ChatTurn'

vi.mock('../../../infrastructure/api/useAuthenticatedMediaUrl', () => ({
  useAuthenticatedMediaUrl: (url?: string | null) => ({ src: url ?? undefined, loading: false, error: null }),
}))

const PRIVATE_SENTINEL = 'https://fal.media.example/private.png?signature=secret'
const originalClipboard = navigator.clipboard

const baseProps = {
  onForwardOptionClick: vi.fn(),
  onRegenerateClick: vi.fn(),
  onDeleteClick: vi.fn(),
  onEditClick: vi.fn(),
}

describe('ChatTurn generated image rendering', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    })
  })

  it('copies only the stored raw message content', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const rawContent = `Lyra: **The door listens.**

Choose carefully.`
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <ChatTurn
        {...baseProps}
        showForwardOptions
        turn={{
          id: 'ai-copy',
          type: 'ai',
          content: rawContent,
          timestamp: new Date().toISOString(),
          forwardOptions: [
            { label: 'Open the door', message: 'Open the door now.' },
            { label: 'Step back', message: 'Step away from the door.' },
          ],
          imageStatus: 'completed',
          imageAssets: [{ asset_id: 'asset-1', url: '/generated-images/img-1.png', content_type: 'image/png' }],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(rawContent))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Message copied' })).toBeInTheDocument()
  })

  it('keeps copy available when only mutating actions are disabled', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <ChatTurn
        {...baseProps}
        actionsDisabled
        turn={{
          id: 'user-copy',
          type: 'user',
          content: 'I keep my hand on the latch.',
          timestamp: new Date().toISOString(),
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('I keep my hand on the latch.'))
    expect(screen.queryByRole('button', { name: 'Edit message' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete message' })).not.toBeInTheDocument()
  })

  it('renders structured narrator, speech, and thought segments', () => {
    render(
      <ChatTurn
        {...baseProps}
        turn={{
          id: 'ai-structured',
          type: 'ai',
          content: 'Lyra: The door listens.',
          timestamp: new Date().toISOString(),
          segments: [
            { kind: 'narrator', content: 'The lantern gutters.' },
            { kind: 'speech', speaker_id: 'lyra', speaker_name: 'Lyra', content: 'The door listens.' },
            { kind: 'thought', speaker_id: 'morrow', speaker_name: 'Morrow', content: 'It remembers my hands.' },
          ],
        }}
      />,
    )

    expect(screen.getByText('The lantern gutters.')).toBeInTheDocument()
    expect(screen.getByText('Lyra')).toBeInTheDocument()
    expect(screen.getByText('The door listens.')).toBeInTheDocument()
    expect(screen.getByText('Morrow thinks')).toBeInTheDocument()
    expect(screen.getByText('It remembers my hands.')).toBeInTheDocument()
  })

  it('paints a live "is speaking" status and portrait for a streaming segment', () => {
    render(
      <ChatTurn
        {...baseProps}
        aiLabel="Game Master"
        turn={{
          id: 'ai-streaming',
          type: 'ai',
          content: 'Aria: Who',
          timestamp: new Date().toISOString(),
          isStreaming: true,
          narratorIdentity: { name: 'Game Master', image_url: null, kind: 'narrator' },
          segments: [
            { kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', image_url: '/portraits/aria.png', streaming: true, content: 'Who' },
          ],
        }}
      />,
    )

    expect(screen.getByText('Aria is speaking…')).toBeInTheDocument()
    const portrait = screen.getByRole('img', { name: 'Aria' })
    expect(portrait).toHaveAttribute('src', '/portraits/aria.png')
  })

  it('shows the narrator name in the eyebrow when narratorIdentity is set', () => {
    render(
      <ChatTurn
        {...baseProps}
        aiLabel="Game Master"
        turn={{
          id: 'ai-narrator',
          type: 'ai',
          content: 'The hall falls silent.',
          timestamp: new Date().toISOString(),
          isStreaming: true,
          narratorIdentity: { name: 'Game Master', image_url: null, kind: 'narrator' },
          segments: [{ kind: 'narrator', content: 'The hall falls silent.', streaming: true }],
        }}
      />,
    )

    expect(screen.getByText('Game Master is writing…')).toBeInTheDocument()
  })

  it('renders pending image state under assistant narrative', () => {
    render(
      <ChatTurn
        {...baseProps}
        turn={{ id: 'ai-1', type: 'ai', content: 'The gate opens.', timestamp: new Date().toISOString(), imageStatus: 'in_progress' }}
      />,
    )

    expect(screen.getByText('The gate opens.')).toBeInTheDocument()
    expect(screen.getByText(/conjuring the scene/i)).toBeInTheDocument()
  })

  it('renders completed mirrored asset and not provider sentinel URLs', () => {
    render(
      <ChatTurn
        {...baseProps}
        turn={{
          id: 'ai-1',
          type: 'ai',
          content: 'The gate opens.',
          timestamp: new Date().toISOString(),
          imageStatus: 'completed',
          imageAssets: [
            { asset_id: 'asset-1', url: '/generated-images/img-1.png', content_type: 'image/png' },
            { asset_id: 'asset-private', url: PRIVATE_SENTINEL, content_type: 'image/png' },
          ],
        }}
      />,
    )

    const image = screen.getByRole('img', { name: /generated scene/i })
    expect(image).toHaveAttribute('src', '/generated-images/img-1.png')
    expect(document.body).not.toHaveTextContent(PRIVATE_SENTINEL)
  })

  it('renders sanitized failed image feedback', () => {
    render(
      <ChatTurn
        {...baseProps}
        turn={{
          id: 'ai-1',
          type: 'ai',
          content: 'The gate opens.',
          timestamp: new Date().toISOString(),
          imageStatus: 'failed',
          imageError: { category: 'provider_completion', detail: 'Image generation failed.' },
        }}
      />,
    )

    expect(screen.getByText(/image generation failed/i)).toBeInTheDocument()
    expect(screen.getByText('The gate opens.')).toBeInTheDocument()
  })
})
