/**
 * Reverie avatar — character initial on a warm gradient (or image).
 * ring: ember (you) / arcane (AI) / none. status: live / think (pulses) / none.
 */
import { cx } from './cx'
import { gradientFor } from './gradient'
import { useAuthenticatedMediaUrl } from '@/infrastructure/api/useAuthenticatedMediaUrl'

export type AvatarRing = 'ember' | 'arcane' | 'none'
export type AvatarStatus = 'live' | 'think' | 'none'

interface AvatarProps {
    name?: string
    /** Override the derived single-letter initial (e.g. "GM"). */
    initial?: string
    src?: string | null
    /** Override the derived gradient. */
    gradient?: string
    size?: number
    ring?: AvatarRing
    status?: AvatarStatus
    className?: string
}

export function Avatar({
    name = '',
    initial,
    src,
    gradient,
    size = 40,
    ring = 'none',
    status = 'none',
    className,
}: AvatarProps) {
    const glyph = initial ?? (name.trim().charAt(0).toUpperCase() || '?')
    const dot = Math.max(10, Math.round(size * 0.28))
    const media = useAuthenticatedMediaUrl(src, 'image/*')
    const imageSrc = media.src
    return (
        <span
            className={cx(
                'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold text-parchment-100',
                // ring + a soft candlelit halo (centered glow, not a downward drop)
                ring === 'ember' && 'shadow-ring-ember',
                ring === 'arcane' && 'shadow-ring-arcane',
                status === 'think' && 'animate-think',
                className,
            )}
            style={{
                width: size,
                height: size,
                fontSize: Math.round(size * (glyph.length > 1 ? 0.32 : 0.42)),
                background: imageSrc ? undefined : gradient || gradientFor(name || 'reverie'),
            }}
        >
            {imageSrc ? <img src={imageSrc} alt={name} className="h-full w-full object-cover" /> : glyph}
            {status === 'live' && (
                <span
                    className="absolute bottom-0 right-0 rounded-full bg-verdant-500 border-2 border-ink-800"
                    style={{ width: dot, height: dot }}
                />
            )}
        </span>
    )
}
