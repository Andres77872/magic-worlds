import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatTurn } from './ChatTurn'

const PRIVATE_SENTINEL = 'https://fal.media.example/private.png?signature=secret'

const baseProps = {
  onForwardOptionClick: vi.fn(),
  onRegenerateClick: vi.fn(),
  onDeleteClick: vi.fn(),
  onEditClick: vi.fn(),
}

describe('ChatTurn generated image rendering', () => {
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
