import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { GalleryCardSkeleton } from './GalleryCardSkeleton'

describe('GalleryCardSkeleton', () => {
    it('renders an aria-hidden placeholder with the shimmer sweep', () => {
        const { getByTestId, container } = render(<GalleryCardSkeleton />)
        const skeleton = getByTestId('gallery-card-skeleton')
        expect(skeleton).toHaveAttribute('aria-hidden', 'true')
        expect(container.querySelector('.image-shimmer')).not.toBeNull()
    })

    it('keeps the 3:4 box so the card swap does not shift layout', () => {
        const { container } = render(<GalleryCardSkeleton />)
        expect(container.querySelector('.aspect-\\[3\\/4\\]')).not.toBeNull()
    })
})
