/**
 * Plays one catalog voice's free sample on demand (D18, 05 §6.1): the voice is
 * the host's `voiceKey`, else what `resolveKey` finds when pressed. One
 * `GET /voices/catalog?keys=` names the voice and picks the sample in
 * `language` (else the voice's primary one); the blob is fetched authed
 * (`useCatalogSample`). Unmetered and read-only, so a host may offer it where
 * the record is read-only (an archived app workspace, 05 §7.9).
 *
 * `heard` names the voice and the sample's language once resolved, for the
 * play button's accessible name (05 §10 "Audio controls": "Play sample of
 * Eldrin, Spanish"). It is dropped when `scope`, `voiceKey` or `language`
 * change. Latest press wins.
 */
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import { catalogSampleUrl } from '../catalogBadges'
import { useCatalogSample } from '../useCatalogSample'

/** The catalog voice a sample resolved to, and the language of that sample. */
export interface HeardVoice {
    name: string
    language: string | null
}

interface VoiceSampleOptions {
    voiceKey?: string | null
    language?: string | null
    /** Finds the voice when the host has no `voiceKey` (e.g. an effective-voice read). */
    resolveKey?: () => Promise<string | null>
    /** What the sample is for (e.g. a flag id): a new scope drops `heard`. */
    scope?: string
}

export function useVoiceSample({ voiceKey = null, language = null, resolveKey, scope = '' }: VoiceSampleOptions = {}) {
    const { t } = useTranslation()
    const sample = useCatalogSample()
    const [resolving, setResolving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [heard, setHeard] = useState<(HeardVoice & { tag: string }) | null>(null)
    const seq = useRef(0)
    const stopSample = sample.stop
    const playSample = sample.play
    const tag = JSON.stringify([scope, voiceKey, language])

    const stop = useCallback(() => {
        seq.current += 1
        setResolving(false)
        stopSample()
    }, [stopSample])

    const listen = useCallback(async () => {
        const mine = ++seq.current
        stopSample()
        setResolving(true)
        setError(null)
        try {
            const key = voiceKey || (resolveKey ? await resolveKey() : null)
            const [item] = key ? await apiService.getVoiceCatalogByKeys([key]) : []
            const url = item ? catalogSampleUrl(item, language) : null
            if (mine !== seq.current) return
            if (!item || !url) throw new Error('No sample for this voice.')
            setHeard({ name: item.display_name, language: item.languages.find((entry) => entry.sample_url === url)?.language ?? null, tag })
            setResolving(false)
            await playSample(url, null)
        } catch {
            if (mine === seq.current) setError(t('voices.preview.unavailable'))
        } finally {
            if (mine === seq.current) setResolving(false)
        }
    }, [language, playSample, resolveKey, stopSample, t, tag, voiceKey])

    return {
        clip: sample.clip,
        loading: resolving || sample.loading,
        playing: Boolean(sample.clip),
        error: error ?? sample.error,
        heard: heard && heard.tag === tag ? { name: heard.name, language: heard.language } : null,
        listen,
        stop,
    }
}
