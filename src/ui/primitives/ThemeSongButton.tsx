/**
 * ThemeSongButton — a circular play/pause control overlaid on a card portrait.
 * Lazily owns a single HTMLAudioElement for `src`, toggles playback, and reflects
 * the play state. Clicks never bubble to an enclosing clickable card (the card's
 * own onClick opens the editor / begins the scene), so playing a theme stays inert.
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Pause, Play } from 'lucide-react'
import { claimAudioFocus } from '../components/audio/useAudioPlayer'
import { cx } from './cx'
import { Icon } from './Icon'

export type ThemeSongButtonSize = 'sm' | 'md'

interface ThemeSongButtonProps {
    /** Resolved (absolute) audio URL. */
    src: string
    size?: ThemeSongButtonSize
    className?: string
}

const DIM: Record<ThemeSongButtonSize, { box: string; icon: number }> = {
    sm: { box: 'h-8 w-8', icon: 14 },
    md: { box: 'h-9 w-9', icon: 16 },
}

export function ThemeSongButton({ src, size = 'sm', className }: ThemeSongButtonProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    // Pause + release the element if the card unmounts mid-playback.
    useEffect(() => {
        return () => {
            audioRef.current?.pause()
            audioRef.current = null
        }
    }, [])

    const toggle = (e: MouseEvent) => {
        // Never let the play toggle trigger the enclosing clickable card.
        e.stopPropagation()
        e.preventDefault()
        let audio = audioRef.current
        if (!audio) {
            const created = new Audio(src)
            created.addEventListener('play', () => {
                // One track at a time, app-wide (shared with AudioWavePlayer).
                claimAudioFocus(created)
                setIsPlaying(true)
            })
            created.addEventListener('pause', () => setIsPlaying(false))
            created.addEventListener('ended', () => setIsPlaying(false))
            audioRef.current = created
            audio = created
        }
        if (audio.paused) {
            void audio.play().catch(() => setIsPlaying(false))
        } else {
            audio.pause()
        }
    }

    const dim = DIM[size]
    return (
        <button
            type="button"
            aria-label={isPlaying ? 'Pause theme song' : 'Play theme song'}
            aria-pressed={isPlaying}
            title={isPlaying ? 'Pause theme' : 'Play theme'}
            onClick={toggle}
            className={cx(
                'inline-flex shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition-all',
                'border-parchment-50/20 bg-ink-900/60 text-parchment-50 hover:bg-ink-900/80',
                isPlaying
                    ? 'border-ember-500/60 text-ember-300 shadow-glow-ember'
                    : 'hover:border-ember-500/50 hover:text-ember-200 hover:shadow-glow-ember',
                dim.box,
                className,
            )}
        >
            <Icon icon={isPlaying ? Pause : Play} size={dim.icon} />
        </button>
    )
}
