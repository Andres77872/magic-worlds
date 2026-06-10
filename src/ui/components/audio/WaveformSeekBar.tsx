/**
 * WaveformSeekBar — a waveform strip that IS the seek bar. 48 flex bars sized
 * by peak value; the played fraction fills ember (candlelight), the rest stays
 * parchment-dim. Pointer-capture drag scrubs live; arrow keys nudge ±5s. Pure
 * and presentational — playback state comes from useAudioPlayer.
 */

import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { cx } from '@/ui/primitives'
import { formatSeconds } from './formatSeconds'

export interface WaveformSeekBarProps {
    /** Normalized 0..1 peak heights (real or pseudo), one per bar. */
    peaks: number[]
    /** Played fraction 0..1. */
    progress: number
    currentTime: number
    duration: number | null
    onSeekRatio: (ratio: number) => void
    /** Playback has started — render the strip at full presence. */
    engaged?: boolean
    disabled?: boolean
    /** Accessible name, e.g. `Seek within Ember Hymn`. */
    label: string
    className?: string
}

const KEY_STEP_SECONDS = 5

export function WaveformSeekBar({
    peaks,
    progress,
    currentTime,
    duration,
    onSeekRatio,
    engaged = false,
    disabled = false,
    label,
    className,
}: WaveformSeekBarProps) {
    const stripRef = useRef<HTMLDivElement>(null!)
    const scrubbingRef = useRef(false)

    const ratioFromPointer = (e: PointerEvent<HTMLDivElement>): number => {
        const rect = stripRef.current.getBoundingClientRect()
        if (rect.width <= 0) return 0
        return Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    }

    const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        if (disabled) return
        e.stopPropagation()
        e.preventDefault()
        scrubbingRef.current = true
        stripRef.current.setPointerCapture?.(e.pointerId)
        stripRef.current.setAttribute('data-scrubbing', 'true')
        onSeekRatio(ratioFromPointer(e))
    }

    const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
        if (!scrubbingRef.current) return
        onSeekRatio(ratioFromPointer(e))
    }

    const endScrub = (e: PointerEvent<HTMLDivElement>) => {
        if (!scrubbingRef.current) return
        scrubbingRef.current = false
        stripRef.current.releasePointerCapture?.(e.pointerId)
        stripRef.current.removeAttribute('data-scrubbing')
    }

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return
        const total = duration ?? 0
        const stepRatio = total > 0 ? KEY_STEP_SECONDS / total : 0.05
        let next: number | null = null
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = progress + stepRatio
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = progress - stepRatio
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = 1
        if (next == null) return
        e.preventDefault()
        e.stopPropagation()
        onSeekRatio(Math.min(Math.max(next, 0), 1))
    }

    const playedBars = Math.round(progress * peaks.length)

    return (
        <div
            ref={stripRef}
            role="slider"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={duration != null ? Math.round(duration) : 100}
            aria-valuenow={duration != null ? Math.round(currentTime) : Math.round(progress * 100)}
            aria-valuetext={
                duration != null ? `${formatSeconds(currentTime)} of ${formatSeconds(duration)}` : undefined
            }
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            className={cx(
                'group/wave flex h-9 w-full touch-none select-none items-end gap-px rounded-sm',
                disabled ? 'cursor-default' : 'cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500/60',
                className,
            )}
            data-testid="waveform-seekbar"
        >
            {peaks.map((peak, index) => (
                <span
                    key={index}
                    style={{ height: `${Math.round(peak * 100)}%` }}
                    className={cx(
                        'min-h-[3px] w-full flex-1 rounded-full',
                        // Height morphs when real peaks replace pseudo; color flips as
                        // playback crosses each bar. Drag kills the lag via data-scrubbing.
                        'transition-[height,background-color] group-data-[scrubbing]/wave:transition-none',
                        index < playedBars
                            ? 'bg-gradient-to-t from-ember-600 to-ember-300'
                            : engaged
                              ? 'bg-parchment-500/30'
                              : 'bg-parchment-500/20',
                    )}
                    aria-hidden="true"
                />
            ))}
        </div>
    )
}
