import { Info, Send, ShieldCheck } from 'lucide-react'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { Badge, Button, Icon } from '@/ui/primitives'
import { CopyableVoiceId } from './CopyableVoiceId'

export interface VoiceResultCardProps {
    tone: 'arcane' | 'ember'
    badgeLabel: string
    voiceId: string
    /** Resolved playable URL (decoded blob or provider demo URL). */
    audioSrc?: string | null
    audioTitle?: string
    durationMs?: number | null
    /** Mono metadata summary line (e.g. duration · sample rate · bitrate). */
    metaLine?: string
    /** Shown when audioSrc is absent (e.g. a decode failure); omit when no audio is expected. */
    audioMissingHint?: string
    /** Amber advisory note shown under the player. */
    caveat?: string
    onSendToLab?: (voiceId: string) => void
}

/** Shared result surface for a designed / cloned / tested voice. */
export function VoiceResultCard({
    tone,
    badgeLabel,
    voiceId,
    audioSrc,
    audioTitle,
    durationMs,
    metaLine,
    audioMissingHint,
    caveat,
    onSendToLab,
}: VoiceResultCardProps) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <Badge tone={tone} icon={<Icon icon={ShieldCheck} size={11} />}>
                        {badgeLabel}
                    </Badge>
                    <CopyableVoiceId value={voiceId} />
                </div>
                {onSendToLab && (
                    <Button
                        kind="secondary"
                        size="sm"
                        iconLeft={<Icon icon={Send} size={14} />}
                        onClick={() => onSendToLab(voiceId)}
                    >
                        Send to lab
                    </Button>
                )}
            </div>

            {audioSrc ? (
                <VoiceClipPlayer src={audioSrc} title={audioTitle} durationMs={durationMs} />
            ) : audioMissingHint ? (
                <p className="font-ui text-sm text-parchment-300">{audioMissingHint}</p>
            ) : null}

            {metaLine && <p className="font-mono text-xs text-parchment-400">{metaLine}</p>}

            {caveat && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <Icon icon={Info} size={14} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="font-ui text-xs leading-relaxed text-parchment-200">{caveat}</p>
                </div>
            )}
        </div>
    )
}
