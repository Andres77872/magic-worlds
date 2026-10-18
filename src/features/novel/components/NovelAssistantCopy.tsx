import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import { Button, Callout, Card, Field, Textarea } from '@/ui/primitives'

export type NovelCopyField = 'description' | 'synopsis'
export type NovelCopyOutcome = 'saved' | 'changed' | 'unavailable' | 'failed'
/** Saves reviewed book copy as the novel's description or synopsis, refused when the novel's details moved past `reviewedRevision`. */
export type NovelCopyWriter = (field: NovelCopyField, text: string, reviewedRevision: number) => Promise<NovelCopyOutcome>

// The limits the novel's details accept: the description in UTF-8 bytes, the synopsis in characters.
const fits = (field: NovelCopyField, text: string) => field === 'description' ? new TextEncoder().encode(text).length <= 60_000 : [...text].length <= 20_000

/**
 * A book-copy reply (A26) offered as the novel's description (a blurb) or synopsis (a submission synopsis). The author
 * sees what it would replace, can edit the text, and saves it; nothing is written until then.
 */
export function NovelAssistantCopy({ record, story, writer, readOnly }: {
    record: NovelAssistantRecord; story: StoryOutline; readOnly: boolean
    /** Absent where the novel's details cannot change. */
    writer?: NovelCopyWriter
}) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistantActions.use.' + key, values)
    const action = record.context.request.action
    const field: NovelCopyField | null = action?.kind !== 'copy' ? null : action.form === 'blurb' ? 'description' : action.form === 'synopsis' ? 'synopsis' : null
    // Replies since the copy field carry the copy alone; earlier ones only the answer.
    const answer = (record.result.copy ?? record.result.answer).trim()
    const [value, setValue] = useState(answer)
    const [working, setWorking] = useState(false), [outcome, setOutcome] = useState<NovelCopyOutcome | null>(null)
    if (!field || !answer || !writer || readOnly) return null
    const current = (field === 'description' ? story.description : story.details.synopsis)?.trim() || ''
    const draft = value.trim(), valid = Boolean(draft) && fits(field, draft)
    async function save() {
        if (!writer || !field || working || !valid) return
        setWorking(true); setOutcome(null)
        const result = await writer(field, draft, story.metadataRevision)
        setWorking(false); setOutcome(result)
    }
    return <section aria-label={text(field + '.title')} className="space-y-3">
        <h3 className="font-display text-h3">{text(field + '.title')}</h3>
        <p className="text-caption text-parchment-300">{text(field + '.help')}</p>
        <Card className="space-y-2 p-3">
            <h4 className="text-label text-parchment-50">{text(field + '.current')}</h4>
            {current ? <p className="whitespace-pre-wrap break-words text-body text-parchment-200">{current}</p>
                : <p className="text-caption text-parchment-400">{text(field + '.empty')}</p>}
        </Card>
        <Field label={text('edit')} error={draft && !valid ? text(field + '.tooLong') : !draft ? text('needsText') : undefined}>
            <Textarea rows={8} value={value} disabled={working} onChange={(event) => { setValue(event.target.value); setOutcome(null) }} />
        </Field>
        {outcome && <Callout tone={outcome === 'saved' ? 'info' : 'warning'} role={outcome === 'saved' ? 'status' : 'alert'}>{text(outcome === 'saved' ? field + '.saved' : outcome)}</Callout>}
        <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" disabled={working || !valid || draft === current} onClick={() => void save()}>{text(working ? 'saving' : field + '.save')}</Button>
            {draft === current && <span className="text-caption text-parchment-400">{text('same')}</span>}
        </div>
    </section>
}
