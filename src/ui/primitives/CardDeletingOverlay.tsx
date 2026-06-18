/**
 * CardDeletingOverlay — the shared "deleting…" scrim shown over a card while its
 * delete request is in flight. One markup so every card dims identically; pair it
 * with `pointer-events-none opacity-60` + `aria-busy` on the card surface.
 */
import { cx } from './cx'

interface CardDeletingOverlayProps {
    label: string
    className?: string
}

export function CardDeletingOverlay({ label, className }: CardDeletingOverlayProps) {
    return (
        <div
            className={cx(
                'absolute inset-0 z-[3] flex items-center justify-center bg-ink-900/70 font-medium text-parchment-50',
                className,
            )}
        >
            {label}
        </div>
    )
}
