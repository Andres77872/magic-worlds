/**
 * GalleryCardSkeleton — the loading placeholder for GalleryCard. It reproduces
 * the card's exact box (a 3:4 Portrait surface with a name/badge bar on the
 * bottom vignette) so the skeleton → card swap reserves layout and never shifts.
 * The shimmer is the existing `.image-shimmer` arcane sweep; reduced motion
 * (handled globally in theme.css) freezes it to a static tint.
 */
import { Card } from '@/ui/primitives'

export interface GalleryCardSkeletonProps {
    /** Match GalleryCard density: `compact` tightens the vignette padding. */
    size?: 'default' | 'compact'
}

export function GalleryCardSkeleton({ size = 'default' }: GalleryCardSkeletonProps) {
    const compact = size === 'compact'
    return (
        <Card
            className="relative flex h-full flex-col"
            aria-hidden="true"
            data-testid="gallery-card-skeleton"
        >
            <div className="image-shimmer relative aspect-[3/4] w-full overflow-hidden">
                {/* Same bottom vignette as the real card so the title bar reads. */}
                <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-[38%] to-ink-800/82"
                />
                <div className={compact ? 'absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-2.5' : 'absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3'}>
                    <div className={compact ? 'h-3.5 w-[68%] rounded bg-parchment-50/15' : 'h-4 w-[70%] rounded bg-parchment-50/15'} />
                    <div className="h-2.5 w-[40%] rounded bg-parchment-50/10" />
                </div>
            </div>
        </Card>
    )
}
