import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioPlaylistContext } from '@/app/providers/audioPlaylistContext'
import { ApiError, type ApiService, type SceneNarrationResponse } from '@/infrastructure/api'
import { useAttestation } from '@/features/legal/attestation/attestationContext'
import { isVoicesFeatureEnabled } from '@/shared/featureFlags'
import type { TurnEntry } from '@/shared/types'
import type { VoiceSessionBasePath } from '@/shared/types/sessionVoice.types'
import type { SceneNarrationRequest } from '@/shared/types/voiceScene.types'
import { clipVolume } from '@/shared/voice/clipVolume'
import { Button } from '@/ui/primitives'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { isGeneratingClipStatus } from '../utils/chatTtsTurnState'

interface Props {
    api: ApiService
    basePath: VoiceSessionBasePath
    sessionId: number
    turn: SceneNarrationRequest
    readOnly?: boolean
}

function SceneRecording({ api, value }: { api: ApiService; value: SceneNarrationResponse }) {
    const { t } = useTranslation()
    const playlist = useContext(AudioPlaylistContext)
    const [media, setMedia] = useState<{ src?: string; error?: boolean }>({})
    const asset = value.job?.assets?.[0]
    useEffect(() => {
        if (!asset?.url) return
        let active = true
        let url: string | undefined
        void api.fetchTtsAudioBlob(asset.url).then(blob => {
            if (!active) return
            url = URL.createObjectURL(blob)
            setMedia({ src: url })
        }).catch(() => { if (active) setMedia({ error: true }) })
        return () => { active = false; if (url) URL.revokeObjectURL(url) }
    }, [api, asset?.url])
    if (media.error) return <p role="alert" className="text-caption text-blood-300">{t('voices.scene.error')}</p>
    if (!media.src) return null
    return <VoiceClipPlayer src={media.src} title={t('voices.scene.recording')} durationMs={asset?.duration_ms}
        volume={clipVolume(playlist?.muted ? 0 : playlist?.volume ?? 1, value.manifest?.playback_gain_db)} />
}

/** One explicit, paid alternative. Status recovery performs reads only. */
export function SceneNarrationPanel({ api, basePath, sessionId, turn, readOnly = false }: Props) {
    const { t } = useTranslation()
    const attestation = useAttestation()
    const [value, setValue] = useState<SceneNarrationResponse | null>(null)
    const [open, setOpen] = useState(false)
    const [error, setError] = useState(false)
    const [saving, setSaving] = useState(false)
    const [reading, setReading] = useState(false)
    const [uncertain, setUncertain] = useState(false)
    const alive = useRef(true)
    const readSequence = useRef(0)
    const submitLock = useRef(false)
    const messageId = turn.assistant_message_id
    const turnId = turn.turn_id
    const read = useCallback(async () => {
        const sequence = ++readSequence.current
        try {
            const next = await api.getSceneNarration(basePath, sessionId, { assistant_message_id: messageId, turn_id: turnId })
            if (alive.current && sequence === readSequence.current) { setValue(next); setError(false); setUncertain(false) }
            return true
        } catch (failure) {
            if (alive.current && sequence === readSequence.current && !(failure instanceof ApiError && failure.status === 404)) setError(true)
            return false
        }
    }, [api, basePath, sessionId, messageId, turnId])

    useEffect(() => {
        alive.current = true
        void Promise.resolve().then(read)
        return () => { alive.current = false }
    }, [read])

    const jobId = value?.job?.job_id
    const pending = isGeneratingClipStatus(value?.job?.status)
    useEffect(() => {
        if (!pending) return
        let active = true
        let timer: ReturnType<typeof setTimeout>
        const deadline = Date.now() + 180_000
        const poll = async () => {
            if (!active) return
            const observed = await read()
            if (!active) return
            if (observed && Date.now() < deadline) timer = setTimeout(() => void poll(), 2000)
            else if (Date.now() >= deadline) setError(true)
        }
        timer = setTimeout(() => void poll(), 1500)
        return () => { active = false; clearTimeout(timer) }
    }, [jobId, pending, read])

    const refresh = async () => {
        setReading(true)
        await read()
        if (alive.current) setReading(false)
    }
    const generate = async () => {
        if (!value?.available || readOnly || pending || uncertain || submitLock.current) return
        submitLock.current = true
        readSequence.current++
        setSaving(true)
        setError(false)
        try {
            const operation = () => api.generateSceneNarration(basePath, sessionId, { assistant_message_id: messageId, turn_id: turnId })
            const next = attestation ? await attestation.withAttestation(operation) : await operation()
            if (alive.current) { setValue(next); setUncertain(false) }
        } catch (failure) {
            // An HTTP failure may follow an admitted job. Require a status read;
            // never repeat a POST as network recovery.
            if (alive.current) {
                if (failure instanceof ApiError && failure.status === 409 && failure.code?.startsWith('scene_')) {
                    setValue(previous => previous && ({ ...previous, available: false, reason: failure.code! }))
                } else { setError(true); setUncertain(true) }
            }
        } finally {
            submitLock.current = false
            if (alive.current) setSaving(false)
        }
    }

    if (value && !value.enabled && !value.job) return null
    if (!value && !error) return null
    const completed = value?.job?.status === 'completed'
    const complete = completed && Boolean(value?.job?.assets?.length)
    const failed = Boolean(value?.job && !pending && !completed)
    const action = value?.job && !value.matches_current ? 'update' : failed ? 'retry' : 'generate'
    const canGenerate = value?.available && !readOnly && !pending && !(complete && value.matches_current)
    const reason = value?.reason
    const reasonKey = reason && t(`voices.scene.reasons.${reason}`, { defaultValue: t('voices.scene.reasons.unavailable') })

    return <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-line-faint bg-surface-raised p-3" data-testid="scene-narration">
        <Button variant="ghost" size="sm" className="justify-start" aria-expanded={open} onClick={() => setOpen(previous => !previous)}>{t('voices.scene.title')}</Button>
        {open && <div className="flex min-w-0 flex-col gap-3">
            <p className="text-caption text-fg-muted">{t('voices.scene.description')}</p>
            {readOnly && <p className="text-caption text-fg-muted">{t('voices.scene.readOnly')}</p>}
            {reasonKey && <p className="text-caption text-fg-muted">{reasonKey}</p>}
            {value?.manifest && <div className="flex flex-col gap-1">
                <p className="text-caption font-semibold text-fg">{t('voices.scene.cast')}</p>
                <ul className="list-none space-y-1 p-0 text-caption text-fg-muted">
                    {value.manifest.cast.map(member => <li key={member.speaker_index}>
                        {member.speaker_name || (member.speaker_id ? member.speaker_id : t('voices.scene.narrator'))}: {member.voice_name || t('voices.scene.unnamedVoice')}
                    </li>)}
                </ul>
                {!value.matches_current && <p className="text-caption text-fg-muted">{t('voices.scene.savedCast')}</p>}
            </div>}
            {pending && <p role="status" className="text-caption text-fg-muted">{t('voices.scene.pending')}</p>}
            {complete && value && <SceneRecording key={jobId} api={api} value={value} />}
            {completed && !complete && <p className="text-caption text-fg-muted">{t('voices.scene.recordingUnavailable')}</p>}
            {failed && <p role="status" className="text-caption text-fg-muted">{t('voices.scene.failed')}</p>}
            {error && <p role="alert" className="text-caption text-blood-300">{t('voices.scene.error')}</p>}
            {canGenerate && <Button size="sm" disabled={saving || reading || uncertain} onClick={() => void generate()}>
                {t(`voices.scene.${action}`, { count: value.estimated_credits })}
            </Button>}
            <Button variant="ghost" size="sm" disabled={saving || reading} onClick={() => void refresh()}>{t('voices.scene.refresh')}</Button>
        </div>}
    </section>
}

/** Keep the current alternative alongside cast controls; never enter the fragment queue. */
export function SessionSceneNarration({ turns, revision, ...props }: Omit<Props, 'turn'> & { turns: TurnEntry[]; revision?: string }) {
    if (!isVoicesFeatureEnabled()) return null
    const latest = [...turns].reverse().find(turn => turn.type === 'ai' && !turn.isStreaming && turn.assistantMessageId && turn.turnId)
    if (!latest?.assistantMessageId || !latest.turnId) return null
    return <SceneNarrationPanel key={`${props.sessionId}:${latest.assistantMessageId}:${latest.turnId}:${revision}:${latest.content}:${JSON.stringify(latest.segments)}`}
        {...props} turn={{ assistant_message_id: latest.assistantMessageId, turn_id: latest.turnId }} />
}
