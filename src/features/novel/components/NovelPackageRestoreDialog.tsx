/**
 * Restore a project package (.mwnovel) as a new novel. The server checks the whole package first — every scene, note,
 * planning item and saved revision against the rules the editor saves by — and previews what it holds; the restore
 * must be of the same bytes, or it is refused and checked again. Comments and bookmarks, planning and scene history can
 * each be left out. Nothing already in the library changes.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp } from 'lucide-react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import { STORY_IMPORT_ACCEPT } from '@/infrastructure/api/storyImportContract'
import { STORY_PACKAGE_EXTENSION, STORY_PACKAGE_MAX_BYTES, isStoryPackageFile } from '@/infrastructure/api/storyPackageContract'
import type { StoryPackageOptions, StoryPackagePreview, StoryPackageWrite } from '@/shared/types/storyPackage.types'
import { Button, Callout, Field, Icon, Input, Modal, SwitchRow } from '@/ui/primitives'
import { canonicalJson } from '@/utils/json'
import { makeRequestId } from '@/utils/uuid'
import { packageOutline } from './packageOutline'

const ERRORS = ['STORY_PACKAGE_EMPTY', 'STORY_PACKAGE_TOO_LARGE', 'STORY_PACKAGE_UNREADABLE', 'STORY_PACKAGE_ENCRYPTED', 'STORY_PACKAGE_UNSAFE',
    'STORY_PACKAGE_FORMAT_UNSUPPORTED', 'STORY_PACKAGE_VERSION_UNSUPPORTED', 'STORY_PACKAGE_CORRUPT', 'STORY_PACKAGE_INVALID', 'STORY_PACKAGE_SOURCE_CHANGED',
    'STORY_PACKAGE_OPTION_UNAVAILABLE', 'STORY_REQUEST_ID_REUSED', 'STORY_ERASED']
/** A refusal the author can act on, by its server code; anything else gets the general message. */
const reason = (error: unknown, fallback: string) => error instanceof ApiError && ERRORS.includes(String(error.code)) ? String(error.code) : fallback
const SWITCHES = ['notes', 'planning', 'history'] as const
/** The counts each choice restores. */
const HOLDS = { notes: ['comments', 'bookmarks'], planning: ['tasks', 'facts', 'stash'], history: ['revisions'] } as const
const CODEX_SHOWN = 6

type Preview = { state: 'loading' } | { state: 'ready'; preview: StoryPackagePreview; file: File } | { state: 'failed'; reason: string }

interface Props {
    open: boolean
    file: File
    onClose: () => void
    onImported: (storyId: string) => void
    /** Another file was chosen; a manuscript goes back to the manuscript import. */
    onChooseFile: (file: File) => void
}

export function NovelPackageRestoreDialog({ open, file, onClose, onImported, onChooseFile }: Props) {
    const { t, i18n } = useTranslation()
    const text = (key: string, values?: Record<string, unknown>) => t('novelEditor.package.restore.' + key, values)
    const counted = (key: string, values?: Record<string, unknown>) => t('novelEditor.package.' + key, values)
    const { api, capture, isCurrent } = useWorkspace()
    const input = useRef<HTMLInputElement>(null)
    const early = file.size === 0 ? 'STORY_PACKAGE_EMPTY' : file.size > STORY_PACKAGE_MAX_BYTES ? 'STORY_PACKAGE_TOO_LARGE' : null
    const [preview, setPreview] = useState<Preview>({ state: 'loading' })
    const [attempt, setAttempt] = useState(0)
    const [options, setOptions] = useState<StoryPackageOptions>({ notes: true, planning: true, history: true })
    const [title, setTitle] = useState('')
    // The proposed title follows each new preview until the author edits it.
    const titleEdited = useRef(false)
    const [status, setStatus] = useState<{ state: 'idle' } | { state: 'restoring' } | { state: 'failed'; reason: string }>({ state: 'idle' })
    // One request id per reviewed write, reused when the same restore is retried so it can never create two novels.
    const request = useRef<{ key: string; id: string } | null>(null)

    useEffect(() => {
        if (!open || !api || early) return
        const controller = new AbortController(), scope = capture()
        api.previewStoryPackageRestore(file, { signal: controller.signal })
            .then((value) => {
                if (controller.signal.aborted || !isCurrent(scope)) return
                setPreview({ state: 'ready', preview: value, file })
                // Everything the package holds is restored unless the author leaves it out.
                setOptions({ ...value.includes })
                if (!titleEdited.current) setTitle(value.title)
            })
            .catch((error) => { if (!controller.signal.aborted && isCurrent(scope)) setPreview({ state: 'failed', reason: reason(error, 'preview') }) })
        return () => controller.abort()
    }, [open, file, attempt, api, capture, isCurrent, early])

    const ready = preview.state === 'ready' && preview.file === file ? preview.preview : null
    const failed = early ?? (preview.state === 'failed' ? preview.reason : null)
    const trimmed = title.trim()
    const choose = (next: File | null) => {
        if (!next) return
        if (!isStoryPackageFile(next.name)) { onChooseFile(next); return }
        titleEdited.current = false; setTitle(''); setStatus({ state: 'idle' }); setPreview({ state: 'loading' }); onChooseFile(next)
    }
    const submit = async () => {
        if (!ready || !api || !trimmed || status.state === 'restoring') return
        const body = { title: trimmed, packageHash: ready.packageHash, options: { ...options } }
        const identity = canonicalJson(body)
        if (request.current?.key !== identity) request.current = { key: identity, id: makeRequestId('novel-restore') }
        const write: StoryPackageWrite = { requestId: request.current.id, ...body }
        const scope = capture()
        setStatus({ state: 'restoring' })
        try {
            let ack
            try { ack = await api.restoreStoryPackage(file, write) }
            catch (error) {
                // A lost response may still have committed: its receipt says so.
                if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error
                ack = await api.getStoryPackageRestoreResult(write)
                if (!ack) throw error
            }
            if (!isCurrent(scope)) return
            setStatus({ state: 'idle' }); onImported(ack.storyId)
        } catch (error) {
            if (!isCurrent(scope)) return
            const code = reason(error, 'import')
            setStatus({ state: 'failed', reason: code })
            if (code === 'STORY_PACKAGE_SOURCE_CHANGED') { setPreview({ state: 'loading' }); setAttempt((value) => value + 1) }
        }
    }
    const number = (value: number) => value.toLocaleString(i18n.language)
    const busy = status.state === 'restoring'
    const holds = (name: (typeof SWITCHES)[number]) => ready ? HOLDS[name].filter((key) => ready.counts[key] > 0).map((key) => counted('count.' + key, { count: ready.counts[key] })).join(' · ') : ''
    const names = ready ? ready.references.filter((ref) => !ref.removed && ref.name).map((ref) => ref.name as string) : []
    const codex = names.length > CODEX_SHOWN ? text('codexMore', { list: names.slice(0, CODEX_SHOWN).join(', '), count: names.length - CODEX_SHOWN }) : names.join(', ')

    return <Modal open={open} onClose={onClose} title={text('title')} size="lg" footer={<>
        <Button variant="ghost" onClick={onClose}>{text('cancel')}</Button>
        <Button disabled={!ready || !trimmed || busy} onClick={() => void submit()}>{text(busy ? 'restoring' : 'restore')}</Button>
    </>}>
        <div className="flex flex-col gap-4">
            <p className="text-body text-parchment-200">{text('help')}</p>
            <p className="text-caption text-parchment-400">{text('formats')}</p>
            <div className="flex flex-wrap items-center gap-3">
                <input ref={input} type="file" accept={STORY_PACKAGE_EXTENSION + ',' + STORY_IMPORT_ACCEPT} className="sr-only" aria-label={text('file')}
                    onChange={(event) => { const next = event.target.files?.[0] ?? null; event.target.value = ''; choose(next) }} />
                <Button variant="secondary" iconLeft={<Icon icon={FileUp} size={16} />} onClick={() => input.current?.click()} disabled={busy}>{text('change')}</Button>
                <span className="break-all text-caption text-parchment-300">{file.name}</span>
            </div>
            {!ready && !failed && <p role="status" className="text-caption text-parchment-300">{text('loading')}</p>}
            {failed && <Callout tone="warning" role="alert"><p>{text('errors.' + failed)}</p>
                {failed === 'preview' && <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setPreview({ state: 'loading' }); setAttempt((value) => value + 1) }}>{text('retry')}</Button>}
            </Callout>}
            {ready && !failed && <>
                <p className="text-caption text-parchment-300">{text('from', { title: ready.source.title })}</p>
                <Field label={text('novelTitle')}>
                    <Input value={title} maxLength={255} disabled={busy} onChange={(event) => { setTitle(event.target.value); titleEdited.current = true }} />
                </Field>
                <section aria-label={counted('summary')} className="flex flex-col gap-2 rounded-md border border-parchment-50/10 p-3">
                    <h3 className="font-ui text-label text-parchment-100">{counted('summary')}</h3>
                    <p className="text-body text-parchment-200">{packageOutline(ready.counts, counted)}
                        {ready.counts.words !== null && ' · ' + counted('words', { count: ready.counts.words, formatted: number(ready.counts.words) })}</p>
                    {ready.counts.references > 0 && <p className="text-caption text-parchment-300">{counted('count.references', { count: ready.counts.references })}{codex && ' — ' + text('codex', { list: codex })}</p>}
                    {ready.media.map((item) => <p key={item.assetId} className="text-caption text-parchment-400">{text(item.available ? 'coverKept' : 'coverMissing')}</p>)}
                </section>
                <fieldset className="flex flex-col gap-3"><legend className="mb-1 text-label text-parchment-200">{text('include')}</legend>
                    {SWITCHES.map((name) => <SwitchRow key={name} label={text(name)} checked={ready.includes[name] && options[name]} disabled={busy || !ready.includes[name]}
                        description={!ready.includes[name] ? text('notIncluded') : [holds(name), name === 'history' && !options.history ? text('historyHelp') : ''].filter(Boolean).join(' — ') || undefined}
                        onChange={(checked) => { setOptions((current) => ({ ...current, [name]: checked })); setStatus({ state: 'idle' }) }} />)}
                </fieldset>
                <Callout tone="info">{text('kept')}</Callout>
            </>}
            {status.state === 'failed' && <Callout tone="warning" role="alert">{text('errors.' + status.reason)}</Callout>}
        </div>
    </Modal>
}
