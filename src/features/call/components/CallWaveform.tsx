/**
 * CallWaveform — a lightweight, reactive bar meter for the live call.
 *
 * Driven by the controller's throttled `level` (0..1) while the user speaks/listens
 * (ember), or by a gentle synthetic animation while the character speaks (arcane), since
 * the assistant audio level isn't analyzed client-side.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/ui/primitives'

interface CallWaveformProps {
    /** Live input level 0..1 (used when tone='ember'). */
    level: number
    tone: 'ember' | 'arcane' | 'idle'
    /** Animate bars independent of `level` (e.g. character speaking). */
    animated?: boolean
    bars?: number
    className?: string
}

// A fixed centre-weighted envelope so the meter reads like a voice, not a flat row.
function envelope(count: number): number[] {
    return Array.from({ length: count }, (_, i) => {
        const t = count <= 1 ? 0.5 : i / (count - 1)
        // raised cosine, 0.45..1
        return 0.45 + 0.55 * Math.sin(Math.PI * t)
    })
}

export function CallWaveform({ level, tone, animated = false, bars = 28, className }: CallWaveformProps) {
    const { t } = useTranslation()
    const weights = useMemo(() => envelope(bars), [bars])
    const clamped = Math.max(0, Math.min(1, level))

    const barColor =
        tone === 'arcane'
            ? 'bg-arcane-400/80'
            : tone === 'ember'
              ? 'bg-ember-400/80'
              : 'bg-parchment-50/20'

    return (
        <div
            className={cx('flex h-16 items-center justify-center gap-[3px]', className)}
            role="img"
            aria-label={t('call.waveform.label')}
            data-testid="call-waveform"
        >
            {weights.map((weight, index) => {
                // ember reacts to the live level; arcane/idle use a gentle resting height
                // (CSS-animated when `animated`), so the meter is never dead.
                const reactive = tone === 'ember'
                const scale = reactive ? Math.max(0.12, Math.min(1, 0.12 + clamped * weight * 1.6)) : 0.2 + weight * 0.25
                return (
                    <span
                        key={index}
                        className={cx('w-[3px] rounded-full transition-transform duration-100 ease-out', barColor, animated && 'animate-call-wave')}
                        style={{
                            height: '100%',
                            // While animated, the keyframe drives scaleY; otherwise it's level-reactive.
                            transform: animated ? undefined : `scaleY(${scale})`,
                            animationDelay: animated ? `${(index % 7) * 90}ms` : undefined,
                        }}
                    />
                )
            })}
        </div>
    )
}
