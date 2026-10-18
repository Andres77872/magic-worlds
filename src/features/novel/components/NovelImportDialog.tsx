/**
 * Import a Markdown, plain-text or Word manuscript as a new novel. The server previews the conversion first — the
 * parts, chapters and scenes it will create and what it cannot keep — and the import must match that preview: the
 * same bytes, the same options and the same converted novel, or it is refused and previewed again. The original
 * file is kept with the novel. A project package (.mwnovel) chosen here is restored instead, in its own review.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp } from 'lucide-react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import { STORY_IMPORT_ACCEPT, STORY_IMPORT_MAX_BYTES, storyImportFormat } from '@/infrastructure/api/storyImportContract'
import { STORY_PACKAGE_EXTENSION, isStoryPackageFile } from '@/infrastructure/api/storyPackageContract'
import { STORY_BACK_MATTER, STORY_FRONT_MATTER } from '@/shared/storyUnitDetails'
import type { StoryExportRole } from '@/shared/types/story.types'
import type { StoryImportChapterLevel, StoryImportManifest, StoryImportOptions, StoryImportWrite } from '@/shared/types/storyImport.types'
import { Button, Callout, Field, Icon, Input, Modal, Select, SwitchRow } from '@/ui/primitives'
import { canonicalJson } from '@/utils/json'
import { makeRequestId } from '@/utils/uuid'
import { NovelPackageRestoreDialog } from './NovelPackageRestoreDialog'

const DEFAULTS: StoryImportOptions = { chapterLevel: 'auto', splitScenes: true }
const LEVELS: StoryImportChapterLevel[] = ['auto', 1, 2, 3, 4, 5, 6]
const ERRORS = ['STORY_IMPORT_FORMAT_UNSUPPORTED', 'STORY_IMPORT_TOO_LARGE', 'STORY_IMPORT_EMPTY', 'STORY_IMPORT_ENCODING', 'STORY_IMPORT_UNREADABLE',
    'STORY_IMPORT_ENCRYPTED', 'STORY_IMPORT_LEGACY_WORD', 'STORY_IMPORT_UNSAFE', 'STORY_IMPORT_SCENE_TOO_LARGE', 'STORY_IMPORT_TOO_MANY_CHAPTERS',
    'STORY_IMPORT_TOO_MANY_SCENES', 'STORY_IMPORT_SOURCE_CHANGED', 'STORY_IMPORT_VERSION_CHANGED', 'STORY_REQUEST_ID_REUSED', 'STORY_ERASED']
/** A refusal the author can act on, by its server code; anything else gets the general message. */
const reason = (error: unknown, fallback: string) => error instanceof ApiError && ERRORS.includes(String(error.code)) ? String(error.code) : fallback

type Preview = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; manifest: StoryImportManifest; key: string } | { state: 'failed'; reason: string }

interface Props { open: boolean; onClose: () => void; onImported: (storyId: string) => void }

export function NovelImportDialog({ open, onClose, onImported }: Props) {
    const { t, i18n } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.import.' + key, values)
    const { api, capture, isCurrent } = useWorkspace()
    const input = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    // A project package is a backup, not a manuscript: it is reviewed and restored by the package dialog.
    const [packageFile, setPackageFile] = useState<File | null>(null)
    const [options, setOptions] = useState<StoryImportOptions>(DEFAULTS)
    const [preview, setPreview] = useState<Preview>({ state: 'idle' })
    const [attempt, setAttempt] = useState(0)
    const [title, setTitle] = useState('')
    // The proposed title follows each new preview until the author edits it.
    const titleEdited = useRef(false)
    const [status, setStatus] = useState<{ state: 'idle' } | { state: 'importing' } | { state: 'failed'; reason: string }>({ state: 'idle' })
    // One request id per reviewed write, reused when the same import is retried so it can never create two novels.
    const request = useRef<{ key: string; id: string } | null>(null)
    const key = file ? canonicalJson([file.name, file.size, file.lastModified, options]) : ''

    useEffect(() => {
        if (!open || !file || !api) return
        const controller = new AbortController(), scope = capture()
        // Option changes settle before the file is converted again.
        const timer = window.setTimeout(() => {
            api.previewStoryImport(file, options, { signal: controller.signal })
                .then((manifest) => {
                    if (controller.signal.aborted || !isCurrent(scope)) return
                    setPreview({ state: 'ready', manifest, key })
                    if (!titleEdited.current) setTitle(manifest.title)
                })
                .catch((error) => { if (!controller.signal.aborted && isCurrent(scope)) setPreview({ state: 'failed', reason: reason(error, 'preview') }) })
        }, 200)
        return () => { window.clearTimeout(timer); controller.abort() }
    }, [open, file, options, key, attempt, api, capture, isCurrent])

    const manifest = preview.state === 'ready' && preview.key === key ? preview.manifest : null
    const loading = !!file && (preview.state === 'loading' || preview.state === 'ready' && preview.key !== key)
    const trimmed = title.trim()
    const choose = (next: File | null) => {
        if (!next) return
        if (isStoryPackageFile(next.name)) { setPackageFile(next); return }
        setPackageFile(null); setFile(next); titleEdited.current = false; setTitle(''); setStatus({ state: 'idle' })
        // Refusals the browser can see are explained without uploading.
        if (!storyImportFormat(next.name)) setPreview({ state: 'failed', reason: 'STORY_IMPORT_FORMAT_UNSUPPORTED' })
        else if (next.size > STORY_IMPORT_MAX_BYTES) setPreview({ state: 'failed', reason: 'STORY_IMPORT_TOO_LARGE' })
        else if (next.size === 0) setPreview({ state: 'failed', reason: 'STORY_IMPORT_EMPTY' })
        else setPreview({ state: 'loading' })
    }
    const change = (patch: Partial<StoryImportOptions>) => {
        setOptions((current) => ({ ...current, ...patch })); setStatus({ state: 'idle' })
        if (preview.state === 'failed' && file && storyImportFormat(file.name)) setPreview({ state: 'loading' })
    }
    const submit = async () => {
        if (!file || !manifest || !api || !trimmed || status.state === 'importing') return
        const body = { title: trimmed, sourceHash: manifest.sourceHash, importVersion: manifest.importVersion, options: manifest.options }
        const identity = canonicalJson(body)
        if (request.current?.key !== identity) request.current = { key: identity, id: makeRequestId('novel-import') }
        const write: StoryImportWrite = { requestId: request.current.id, ...body }
        const scope = capture()
        setStatus({ state: 'importing' })
        try {
            let ack
            try { ack = await api.importStory(file, write) }
            catch (error) {
                // A lost response may still have committed: its receipt says so.
                if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error
                ack = await api.getStoryImportResult(write)
                if (!ack) throw error
            }
            if (!isCurrent(scope)) return
            setStatus({ state: 'idle' }); onImported(ack.storyId)
        } catch (error) {
            if (!isCurrent(scope)) return
            const code = reason(error, 'import')
            setStatus({ state: 'failed', reason: code })
            if (code === 'STORY_IMPORT_SOURCE_CHANGED' || code === 'STORY_IMPORT_VERSION_CHANGED') { setPreview({ state: 'loading' }); setAttempt((value) => value + 1) }
        }
    }
    const number = (value: number) => value.toLocaleString(i18n.language)
    const words = (value: number | null, name = 'words') => value === null ? '' : text(name, { count: value, formatted: number(value) })
    const levelLabel = (level: StoryImportChapterLevel) => level !== 'auto' ? text('levels.heading', { level })
        : manifest && options.chapterLevel === 'auto' ? manifest.chapterLevel ? text('levels.auto_detected', { level: manifest.chapterLevel }) : text('levels.auto_none') : text('levels.auto')
    const counted = (name: string, count: number) => text('count.' + name, { count })
    const scenes = manifest ? manifest.chapters.reduce((total, chapter) => total + chapter.scenes.length, 0) : 0
    const roleName = (role: StoryExportRole) => t('novelEditor.export.roles.' + role)
    const matter = (side: 'front' | 'back') => manifest ? manifest.chapters.flatMap((chapter) => chapter.role && (side === 'front' ? STORY_FRONT_MATTER : STORY_BACK_MATTER).includes(chapter.role) ? [chapter.role] : []) : []

    if (packageFile) return <NovelPackageRestoreDialog open={open} file={packageFile} onClose={onClose} onImported={onImported} onChooseFile={choose} />
    return <Modal open={open} onClose={onClose} title={text('title')} size="lg" footer={<>
        <Button variant="ghost" onClick={onClose}>{text('cancel')}</Button>
        <Button disabled={!manifest || !trimmed || status.state === 'importing'} onClick={() => void submit()}>{text(status.state === 'importing' ? 'importing' : 'import')}</Button>
    </>}>
        <div className="flex flex-col gap-4">
            <p className="text-body text-parchment-200">{text('help')}</p>
            <p className="text-caption text-parchment-400">{text('formats')} {text('packages')}</p>
            <div className="flex flex-wrap items-center gap-3">
                <input ref={input} type="file" accept={STORY_IMPORT_ACCEPT + ',' + STORY_PACKAGE_EXTENSION} className="sr-only" aria-label={text('file')}
                    onChange={(event) => { const next = event.target.files?.[0] ?? null; event.target.value = ''; choose(next) }} />
                <Button variant="secondary" iconLeft={<Icon icon={FileUp} size={16} />} onClick={() => input.current?.click()} disabled={status.state === 'importing'}>
                    {text(file ? 'change' : 'choose')}</Button>
                {file && <span className="break-all text-caption text-parchment-300">{file.name}</span>}
            </div>
            {file && <>
                <fieldset className="flex flex-col gap-3"><legend className="mb-1 text-label text-parchment-200">{text('options')}</legend>
                    <Field label={text('chapterLevel')} helper={text('chapterLevelHelp')}>
                        <Select value={String(options.chapterLevel)} disabled={status.state === 'importing'}
                            onChange={(value) => change({ chapterLevel: value === 'auto' ? 'auto' : Number(value) as StoryImportChapterLevel })}
                            options={LEVELS.map((level) => ({ value: String(level), label: levelLabel(level) }))} />
                    </Field>
                    <SwitchRow label={text('splitScenes')} description={text('splitScenesHelp')} checked={options.splitScenes} disabled={status.state === 'importing'}
                        onChange={(splitScenes) => change({ splitScenes })} />
                </fieldset>
                {loading && <p role="status" className="text-caption text-parchment-300">{text('loading')}</p>}
                {preview.state === 'failed' && <Callout tone="warning" role="alert"><p>{text('errors.' + preview.reason)}</p>
                    {preview.reason === 'preview' && <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setPreview({ state: 'loading' }); setAttempt((value) => value + 1) }}>{text('retry')}</Button>}
                </Callout>}
            </>}
            {manifest && <>
                <Field label={text('novelTitle')}>
                    <Input value={title} maxLength={255} disabled={status.state === 'importing'} onChange={(event) => { setTitle(event.target.value); titleEdited.current = true }} />
                </Field>
                <section aria-label={text('summary')} className="flex flex-col gap-2 rounded-md border border-parchment-50/10 p-3">
                    <h3 className="font-ui text-label text-parchment-100">{text('summary')}</h3>
                    <p className="text-body text-parchment-200">
                        {text(manifest.parts.length ? 'holdsParts' : 'holds', { parts: counted('parts', manifest.parts.length), chapters: counted('chapters', manifest.chapters.length), scenes: counted('scenes', scenes) })}
                        {manifest.wordCount !== null && ' · ' + words(manifest.wordCount)} · {text('format.' + manifest.format)}
                    </p>
                    {manifest.language && <p className="text-caption text-parchment-300">{text('language', { language: manifest.language })}</p>}
                    {(['front', 'back'] as const).map((side) => {
                        const roles = matter(side)
                        return roles.length > 0 && <p key={side} className="text-caption text-parchment-300">{t('novelEditor.export.' + side, { list: roles.map(roleName).join(', ') })}</p>
                    })}
                    {manifest.chapters.some((chapter) => chapter.role) && <p className="text-caption text-parchment-400">{text('matterNote')}</p>}
                    <details><summary className="cursor-pointer text-caption text-parchment-300">{text('outline')}</summary>
                        <ol className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1 text-caption text-parchment-300">
                            {manifest.chapters.map((chapter, index) => <li key={index}>
                                <p className="text-parchment-100">{chapter.part !== null && <span className="text-parchment-400">{manifest.parts[chapter.part].title} · </span>}{chapter.title}
                                    {chapter.role && <span className="text-parchment-400"> · {t(STORY_FRONT_MATTER.includes(chapter.role) ? 'novelEditor.structure.frontMatter' : 'novelEditor.structure.backMatter', { role: roleName(chapter.role) })}</span>}</p>
                                <ul className="ml-3 space-y-0.5">{chapter.scenes.map((scene, position) => <li key={position}>
                                    {text('scene', { title: scene.title, words: words(scene.words, 'sceneWords') })}
                                    {scene.excerpt && <span className="block truncate text-parchment-400">{scene.excerpt}</span>}
                                </li>)}</ul>
                            </li>)}
                        </ol>
                    </details>
                    <h4 className="mt-1 font-ui text-label text-parchment-100">{text('losses')}</h4>
                    {manifest.losses.length ? <ul className="list-disc space-y-1 pl-5 text-caption text-parchment-300">
                        {manifest.losses.map((loss) => <li key={loss.code}>{text('loss.' + loss.code, { count: loss.count })}</li>)}</ul>
                        : <p className="text-caption text-parchment-300">{text('noLosses')}</p>}
                </section>
                <Callout tone="info">{text('kept')}</Callout>
            </>}
            {status.state === 'failed' && <Callout tone="warning" role="alert">{text('errors.' + status.reason)}</Callout>}
        </div>
    </Modal>
}
