/**
 * CallLiveTranscript — the running transcript of the live call, oldest first.
 *
 * Follows the conversation like a chat log: it keeps itself scrolled to the newest
 * line while the reader is at the bottom, and offers "Jump to latest" once they
 * scrolled up to reread (it never yanks them back). Character lines never show the
 * speech markup the model writes for the voice (`<#0.5#>`, `(laughs)`); a streaming
 * line may end mid-token, so it is stripped as a partial. A reply cut short by an
 * interruption is labelled so the reader knows the character stopped there.
 *
 * Screen readers: the list is a `log`, but each line is announced once, complete,
 * from a separate polite live region — a streaming reply would otherwise be read
 * chunk by chunk.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, Mic, Volume2 } from 'lucide-react'
import type { CallTranscriptSegment } from '@/shared'
import { Button, Icon, cx } from '@/ui/primitives'
import { lineDisplayText, type LiveTranscriptLine } from '../liveTranscript'
import { SavedTranscriptAudioClip } from './CallTranscriptLines'

export interface CallLiveTranscriptProps {
    lines: readonly LiveTranscriptLine[]
    /** The character's name (speaker label of its lines). */
    name: string
    /** Saved transcript segments hydrated when the call ends, enabling audio replay on the end panel. */
    savedSegments?: readonly CallTranscriptSegment[]
    id?: string
    className?: string
}

/** How close to the bottom (px) still counts as "following" the conversation. */
const FOLLOW_THRESHOLD_PX = 48

/** The newest line that is complete (never a streaming reply): what the live region reads. */
function latestCompleteLine(lines: readonly LiveTranscriptLine[]): LiveTranscriptLine | null {
    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index]
        if (!line.streaming && line.text.trim()) return line
    }
    return null
}

export function CallLiveTranscript({ lines, name, savedSegments, id, className }: CallLiveTranscriptProps) {
    const { t } = useTranslation()
    const scrollRef = useRef<HTMLDivElement>(null)
    // The effect reads the ref; rendering reads the state that mirrors it.
    const followingRef = useRef(true)
    const [following, setFollowing] = useState(true)
    const [unseen, setUnseen] = useState(false)

    const savedAudioByTurnId = useMemo(() => {
        const map = new Map<string, CallTranscriptSegment>()
        if (!savedSegments) return map
        for (const seg of savedSegments) {
            if (seg.role === 'assistant' && seg.turn_id && seg.audio_url) {
                map.set(seg.turn_id, seg)
            }
        }
        return map
    }, [savedSegments])

    const follow = (next: boolean) => {
        followingRef.current = next
        setFollowing(next)
        if (next) setUnseen(false)
    }

    const scrollNodeToLatest = (behavior: ScrollBehavior = 'auto') => {
        const node = scrollRef.current
        if (!node) return
        if (typeof node.scrollTo === 'function') node.scrollTo({ top: node.scrollHeight, behavior })
        else node.scrollTop = node.scrollHeight
    }

    const lastLine = lines[lines.length - 1]
    const contentKey = `${lines.length}:${lastLine?.id ?? ''}:${lastLine?.text.length ?? 0}`
    // New text while the reader is scrolled up: offer "Jump to latest" (adjusted during render).
    const [seenKey, setSeenKey] = useState(contentKey)
    if (seenKey !== contentKey) {
        setSeenKey(contentKey)
        if (!following && lines.length) setUnseen(true)
    }
    // Before paint: a reader at the bottom never sees the list jump.
    useLayoutEffect(() => {
        if (followingRef.current) scrollNodeToLatest()
    }, [contentKey])

    const onScroll = () => {
        const node = scrollRef.current
        if (!node) return
        follow(node.scrollHeight - node.scrollTop - node.clientHeight <= FOLLOW_THRESHOLD_PX)
    }
    const showJump = !following && unseen

    // Changes only when a line completes, so the region reads each line once.
    const announced = latestCompleteLine(lines)
    const announcement = announced ? `${announced.role === 'assistant' ? name : t('call.screen.youName')}: ${lineDisplayText(announced)}` : ''

    return (
        <section id={id} aria-label={t('call.live.title')} className={cx('relative flex min-h-0 flex-col', className)} data-testid="call-live-transcript">
            <div
                ref={scrollRef}
                onScroll={onScroll}
                role="log"
                aria-live="off"
                tabIndex={0}
                aria-label={t('call.live.title')}
                className="min-h-0 flex-1 overflow-y-auto px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-500"
            >
                {lines.length === 0 ? (
                    <p className="py-6 text-center text-caption text-parchment-400">{t('call.live.empty')}</p>
                ) : (
                    <ol className="flex flex-col gap-2.5">
                        {lines.map((line) => {
                            const text = lineDisplayText(line)
                            const assistant = line.role === 'assistant'
                            const savedSeg = assistant && !line.streaming ? savedAudioByTurnId.get(line.turnId) : undefined
                            return (
                                <li
                                    key={line.id}
                                    data-role={line.role}
                                    className={cx('border-l-2 py-1.5 pl-3 text-left text-body text-parchment-100', assistant ? 'border-arcane-500/40' : 'border-ember-500/40')}
                                >
                                    <span className={cx('mb-0.5 flex items-center gap-1 text-caption font-semibold', assistant ? 'text-arcane-300' : 'text-ember-300')}>
                                        <Icon icon={assistant ? Volume2 : Mic} size={12} />
                                        {assistant ? name : t('call.screen.youName')}
                                    </span>
                                    {text ? (
                                        <span className={cx(assistant && 'font-narrative')}>{text}</span>
                                    ) : line.streaming ? (
                                        <span className="text-parchment-400">{t('call.live.thinking')}</span>
                                    ) : null}
                                    {line.streaming && text && <span aria-hidden className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-arcane-300/70" />}
                                    {line.interrupted && (
                                        <span className="ml-1.5 whitespace-nowrap text-caption italic text-parchment-400">{t('call.live.interrupted')}</span>
                                    )}
                                    {savedSeg?.audio_url && (
                                        <SavedTranscriptAudioClip
                                            audioUrl={savedSeg.audio_url}
                                            speaker={name}
                                            durationMs={savedSeg.duration_ms}
                                        />
                                    )}
                                </li>
                            )
                        })}
                    </ol>
                )}
            </div>
            {showJump && (
                <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                    <Button variant="secondary" size="sm" className="pointer-events-auto shadow-md" iconLeft={<Icon icon={ArrowDown} size={14} />} onClick={() => {
                        scrollNodeToLatest('smooth')
                        follow(true)
                    }}>
                        {t('call.live.jumpToLatest')}
                    </Button>
                </div>
            )}
            <p aria-live="polite" className="sr-only" data-testid="call-live-announcement">{announcement}</p>
        </section>
    )
}
