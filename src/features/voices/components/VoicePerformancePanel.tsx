import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { VoicePerformance, UtterancePerformance, VoicePerformanceCapabilities, VoiceDelivery, VoiceReaction, VoiceEmotion } from '@/shared'
import { Badge, Button, Field, Select, Textarea } from '@/ui/primitives'
import { performanceSelection, selectedWords } from '../performanceSelection'
import { useRecipePreview } from '../useRecipePreview'
import { usePreviewCreditConfirm } from '../usePreviewCreditConfirm'
import { PreviewAllowanceHint, PreviewProblemNotice } from './PreviewAllowanceHint'
import { PreviewCreditDialog } from './PreviewCreditDialog'
import { RecipePreviewPlayer } from './RecipePreviewPlayer'
import { PronunciationEditor } from './PronunciationEditor'

interface Props {
    voiceKey: string
    language: string
    emotion: VoiceEmotion | null
    value: VoicePerformance | null
    onChange: (value: VoicePerformance | null) => void
    userHash?: string | null
}

export function VoicePerformancePanel({ voiceKey, language, emotion, value, onChange, userHash }: Props) {
    const { t } = useTranslation()
    const key = (name: string) => t(`voices.performance.${name}`)
    const [capabilities, setCapabilities] = useState<VoicePerformanceCapabilities | null>(null)
    const [text, setText] = useState(language === 'es' ? 'Quédate cerca. Aeloria tiene 24 monedas y volverá al amanecer.' : 'Stay close. Aeloria has 24 coins and will return at dawn.')
    const [delivery, setDelivery] = useState<VoiceDelivery>('whisper')
    const [reaction, setReaction] = useState<VoiceReaction>('pause_short')
    const [spans, setSpans] = useState<UtterancePerformance['spans']>([])
    const [events, setEvents] = useState<UtterancePerformance['events']>([])
    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
    const [selectionError, setSelectionError] = useState(false)
    const available = capabilities?.available === true && capabilities.languages.includes(language)
    const preview = useRecipePreview({ enabled: available })
    const credit = usePreviewCreditConfirm(userHash)
    useEffect(() => {
        let live = true
        // Older deployments and test fixtures can omit this explicit extension.
        Promise.resolve().then(() => apiService.getVoicePerformanceCapabilities()).then(result => { if (live) setCapabilities(result) }).catch(() => {})
        return () => { live = false }
    }, [])
    const change = (patch: Partial<VoicePerformance>) => {
        const next: VoicePerformance = { version: 1, dictionary_refs: [], ...value, ...patch }
        onChange(next.direction || next.dictionary_refs.length ? next : null)
    }
    const addDelivery = () => {
        if (!selection || selection.start === selection.end || spans.some(span => span.start < selection.end && span.end > selection.start)) { setSelectionError(true); return }
        setSpans(current => [...current, { ...selection, delivery }]); setSelectionError(false); preview.reset()
    }
    const addEvent = () => {
        if (!selection) { setSelectionError(true); return }
        setEvents(current => [...current, { at: selection.start, event: reaction }]); setSelectionError(false); preview.reset()
    }
    const run = (directed: boolean) => {
        const performance: UtterancePerformance = { version: 1, offset_unit: 'unicode_code_points', dictionary_refs: [], spans: [], events: [],
            ...(directed ? { ...value, spans, events } : {}) }
        credit.guard(preview.nextCostsCredit, () => void preview.run({ provider: 'fish_audio', voiceKey, settings: null,
            emotion: directed ? emotion : null, textId: 'narration', language, tier: 'standard', authoredText: text, performance }))
    }
    if (!available) return value ? <p className="text-caption text-fg-muted">{key('unavailable')}</p> : null
    return <details className="rounded-lg border border-line-faint p-4">
        <summary className="cursor-pointer font-ui text-label text-fg-primary">{key('title')}</summary>
        <div className="mt-4 flex flex-col gap-4">
            <Field label={key('direction')} helper={key('directionHint')}><Textarea rows={2} maxLength={capabilities.max_direction_chars} value={value?.direction ?? ''} onChange={event => { change({ direction: event.target.value || null }); preview.reset() }} /></Field>
            <PronunciationEditor key={language} language={language as 'en' | 'es'} phonemes={capabilities.phoneme_languages.includes(language)} value={value?.dictionary_refs ?? []} onChange={dictionary_refs => { change({ dictionary_refs }); preview.reset() }} />
            <Field label={key('text')} helper={key('textHint')}><Textarea lang={language} rows={4} value={text} onSelect={event => setSelection(performanceSelection(text, event.currentTarget.selectionStart, event.currentTarget.selectionEnd))} onChange={event => { setText(event.target.value); setSpans([]); setEvents([]); setSelection(null); preview.reset() }} /></Field>
            <p className="text-caption text-fg-muted">{Array.from(text).length} / {capabilities.max_text_chars}</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={key('delivery')}><Select value={delivery} options={capabilities.deliveries.map(value => ({ value, label: key(`deliveries.${value}`) }))} onChange={value => setDelivery(value as VoiceDelivery)} /></Field>
                <Button variant="secondary" size="sm" disabled={spans.length >= 16} onClick={addDelivery}>{key('addDelivery')}</Button>
                <Field label={key('reaction')}><Select value={reaction} options={capabilities.events.map(value => ({ value, label: key(`events.${value}`) }))} onChange={value => setReaction(value as VoiceReaction)} /></Field>
                <Button variant="secondary" size="sm" disabled={events.length >= 12} onClick={addEvent}>{key('addEvent')}</Button>
            </div>
            {selectionError && <p role="alert" className="text-caption text-blood-300">{key('selectionError')}</p>}
            <ul className="flex flex-col gap-2" aria-label={key('compare')}>
                {spans.map((span, index) => <li key={`s${index}`} className="flex flex-wrap items-center gap-2"><Badge tone="neutral">{key(`deliveries.${span.delivery}`)} · {selectedWords(text, span.start, span.end)}</Badge><Button size="sm" variant="ghost" aria-label={t('voices.performance.remove', { label: key(`deliveries.${span.delivery}`) })} onClick={() => { setSpans(current => current.filter((_, i) => i !== index)); preview.reset() }}>×</Button></li>)}
                {events.map((event, index) => <li key={`e${index}`} className="flex flex-wrap items-center gap-2"><Badge tone="neutral">{key(`events.${event.event}`)} · {event.at}</Badge><Button size="sm" variant="ghost" aria-label={t('voices.performance.remove', { label: key(`events.${event.event}`) })} onClick={() => { setEvents(current => current.filter((_, i) => i !== index)); preview.reset() }}>×</Button></li>)}
            </ul>
            <p className="text-caption text-fg-muted">{key('localOnly')}</p>
            <p className="text-caption text-fg-muted">{key('cost')}</p>
            <div className="flex flex-wrap gap-2">{[false, true].map(directed => <Button key={String(directed)} variant="secondary" size="sm" disabled={preview.loading || preview.limitReached || !text.trim() || Array.from(text).length > capabilities.max_text_chars} onClick={() => run(directed)}>{key(directed ? 'directed' : 'neutral')}</Button>)}</div>
            <PreviewAllowanceHint previewsLeft={preview.previewsLeft} loading={preview.loading} />
            <PreviewProblemNotice problem={preview.problem} membershipInNewTab />
            {preview.clip && <RecipePreviewPlayer src={preview.clip.src} volume={preview.clip.volume} title={key('compare')} transcript={preview.clip.text ?? text} lang={language} />}
        </div>
        <PreviewCreditDialog confirm={credit} />
    </details>
}
