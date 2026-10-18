/**
 * Export the saved manuscript as Word, EPUB, Markdown, plain text or PDF, or a companion file of the same scenes (the
 * author's review notes, or the AI proposals accepted into them). A summary of exactly what the file holds (scenes in
 * reading order, scenes left out and why, what the format changes, size and SHA-256) is read first; the download
 * must match it, so a manuscript saved in between is refused and summarized again instead of silently exported.
 * The same summary can also be built in the background as an export job with progress, a log and retry (X10).
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, BookText, FileText, FileType, Hash, MessageSquareText, Palette, Printer, Sparkles } from 'lucide-react'
import { ApiError } from '@/infrastructure/api'
import type { StoryExportDocument, StoryExportFormat, StoryExportGlossaryCandidate, StoryExportManifest, StoryExportOptions, StoryExportPdfLayout } from '@/shared/types/storyExport.types'
import { Button, Callout, Field, Icon, Modal, SegmentedControl, Select, SwitchRow } from '@/ui/primitives'
import { canonicalJson } from '@/utils/json'
import { downloadBlob } from '@/utils/download'
import { STORY_BACK_MATTER, STORY_FRONT_MATTER } from '@/shared/storyUnitDetails'
import type { StoryExportRole } from '@/shared/types/story.types'
import type { ManuscriptExportSource } from '../hooks/useManuscriptExportSource'
import { NovelExportJobs } from './NovelExportJobs'

const DEFAULTS: StoryExportOptions = { format: 'docx', includeArchived: false, titlePage: true, partTitles: true, chapterTitles: true, sceneTitles: false, chapterBreaks: true, contents: false, glossary: [], pdf: null,
    document: 'manuscript', resolvedNotes: false }
/** A companion file sends the manuscript's title, page-break, contents and glossary choices at their defaults. */
const COMPANION = { titlePage: true, partTitles: true, chapterTitles: true, sceneTitles: false, chapterBreaks: true, contents: false, glossary: [] as string[] }
const LAYOUT: StoryExportPdfLayout = { pageSize: 'trade', fontSize: 11, lineSpacing: 'relaxed', margins: 'normal', fontFamily: 'serif', pageNumbers: true, justify: true }
const LAYOUT_CHOICES = { pageSize: ['trade', 'digest', 'a5', 'a4', 'letter'], lineSpacing: ['single', 'relaxed', 'double'], margins: ['narrow', 'normal', 'wide'], fontFamily: ['serif', 'sans'] } as const
const SWITCHES = ['titlePage', 'contents', 'partTitles', 'chapterTitles', 'sceneTitles', 'includeArchived', 'chapterBreaks'] as const
/** Choices that only some formats use; the rest apply to every format. */
const ONLY: Partial<Record<(typeof SWITCHES)[number], StoryExportFormat[]>> = { chapterBreaks: ['docx', 'pdf'], contents: ['docx', 'epub', 'pdf'] }
/** The front- or back-matter roles in the file, once per chapter, in file order. */
function matterRoles(manifest: StoryExportManifest, side: 'front' | 'back'): StoryExportRole[] {
    const roles = side === 'front' ? STORY_FRONT_MATTER : STORY_BACK_MATTER, seen = new Set<string>(), out: StoryExportRole[] = []
    for (const row of manifest.scenes) {
        if (!row.role || !roles.includes(row.role) || seen.has(row.chapterId)) continue
        seen.add(row.chapterId); out.push(row.role)
    }
    return out
}
type Candidates = { state: 'idle' | 'loading' | 'failed' } | { state: 'ready'; items: StoryExportGlossaryCandidate[] }
type Summary = { state: 'loading' } | { state: 'ready'; manifest: StoryExportManifest; key: string } | { state: 'failed'; code?: string }

interface Props { open: boolean; onClose: () => void; source: ManuscriptExportSource; savedVersion: string }

export function NovelExportDialog({ open, onClose, source, savedVersion }: Props) {
    const { t, i18n } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.export.' + key, values)
    const [options, setOptions] = useState<StoryExportOptions>(DEFAULTS)
    // The PDF layout is kept while another format is chosen, and sent only with a PDF.
    const [layout, setLayout] = useState<StoryExportPdfLayout>(LAYOUT)
    const [summary, setSummary] = useState<Summary>({ state: 'loading' })
    const [attempt, setAttempt] = useState(0)
    const [status, setStatus] = useState<'idle' | 'downloading' | 'changed' | 'failed' | 'done'>('idle')
    // The glossary picker reads the novel's Codex entries only when the author turns it on.
    const [glossaryOn, setGlossaryOn] = useState(false), [candidates, setCandidates] = useState<Candidates>({ state: 'idle' })
    // The manuscript choices are kept while a companion file is chosen, so they come back unchanged.
    const companion = options.document !== 'manuscript'
    // The style sheet comes from the novel's saved details, not from its scenes.
    const styleSheet = options.document === 'style_sheet'
    const requested = useMemo<StoryExportOptions>(() => companion ? { ...options, ...COMPANION } : options, [companion, options])
    const key = canonicalJson(requested) + '\u0000' + savedVersion

    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        // Choices settle before the summary is read again.
        const timer = window.setTimeout(() => {
            source.preview(requested, controller.signal)
                .then((manifest) => { if (!controller.signal.aborted && source.isCurrent()) setSummary({ state: 'ready', manifest, key }) })
                .catch((error) => { if (!controller.signal.aborted && source.isCurrent()) setSummary({ state: 'failed', code: error instanceof ApiError ? error.code : undefined }) })
        }, 200)
        return () => { window.clearTimeout(timer); controller.abort() }
    }, [open, source, requested, key, attempt])

    useEffect(() => {
        if (!open || !glossaryOn || candidates.state !== 'loading') return
        const controller = new AbortController()
        source.glossaryCandidates(controller.signal)
            .then((items) => { if (!controller.signal.aborted && source.isCurrent()) setCandidates({ state: 'ready', items }) })
            .catch(() => { if (!controller.signal.aborted && source.isCurrent()) setCandidates({ state: 'failed' }) })
        return () => controller.abort()
    }, [open, glossaryOn, candidates.state, source])

    const manifest = summary.state === 'ready' && summary.key === key ? summary.manifest : null
    const exportable = manifest && (styleSheet || manifest.scenes.length > 0) && manifest.entries !== 0 ? manifest : null
    const reread = () => { setSummary({ state: 'loading' }); setAttempt((value) => value + 1) }
    const loading = summary.state === 'loading' || summary.state === 'ready' && summary.key !== key
    const choose = (change: Partial<StoryExportOptions>) => { setOptions((current) => ({ ...current, ...change })); setStatus('idle'); if (summary.state === 'failed') setSummary({ state: 'loading' }) }
    const download = async () => {
        if (!manifest || status === 'downloading') return
        setStatus('downloading')
        try {
            downloadBlob(await source.download(manifest), manifest.filename)
            setStatus('done')
        } catch (error) {
            if (error instanceof ApiError && error.code === 'STORY_EXPORT_SOURCE_CHANGED') { setStatus('changed'); reread() }
            else setStatus('failed')
        }
    }
    const toggleGlossary = (on: boolean) => {
        setGlossaryOn(on)
        if (on && candidates.state !== 'ready') setCandidates({ state: 'loading' })
        if (!on) choose({ glossary: [] })
    }
    const pick = (refs: string[]) => choose({ glossary: refs })
    const chooseFormat = (format: StoryExportFormat) => choose({ format, pdf: format === 'pdf' ? layout : null })
    const chooseDocument = (document: StoryExportDocument) => choose({ document, resolvedNotes: document === 'review_notes' && options.resolvedNotes })
    const arrange = (change: Partial<StoryExportPdfLayout>) => { const next = { ...layout, ...change }; setLayout(next); choose({ pdf: next }) }
    const number = (value: number) => value.toLocaleString(i18n.language)
    const size = (bytes: number) => bytes < 1024 ? text('bytes', { count: bytes }) : bytes < 1024 * 1024 ? text('kilobytes', { size: (bytes / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })
        : text('megabytes', { size: (bytes / 1024 / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })

    return <Modal open={open} onClose={onClose} title={text('title')} size="lg" footer={<>
        <Button variant="ghost" onClick={onClose}>{text('close')}</Button>
        <Button disabled={!exportable || status === 'downloading'} onClick={() => void download()}>{text(status === 'downloading' ? 'downloading' : 'download')}</Button>
    </>}>
        <div className="flex flex-col gap-4">
            <p className="text-body text-parchment-200">{text('help')}</p>
            <div className="flex flex-col gap-2">
                <p className="text-label text-parchment-200">{text('document')}</p>
                <SegmentedControl<StoryExportDocument> aria-label={text('document')} showLabels value={options.document} onChange={chooseDocument}
                    options={[{ value: 'manuscript', label: text('documents.manuscript'), icon: <Icon icon={BookText} size={14} /> },
                        { value: 'review_notes', label: text('documents.review_notes'), icon: <Icon icon={MessageSquareText} size={14} /> },
                        { value: 'ai_changes', label: text('documents.ai_changes'), icon: <Icon icon={Sparkles} size={14} /> },
                        { value: 'style_sheet', label: text('documents.style_sheet'), icon: <Icon icon={Palette} size={14} /> }]} />
                <p className="text-caption text-parchment-400">{text('documentHelp.' + options.document)}</p>
            </div>
            <Callout tone="info">{text(styleSheet ? 'savedOnlyStyle' : companion ? 'savedOnlyCompanion' : 'savedOnly')}</Callout>
            <div className="flex flex-col gap-2">
                <p className="text-label text-parchment-200">{text('format')}</p>
                <SegmentedControl<StoryExportFormat> aria-label={text('format')} showLabels value={options.format} onChange={chooseFormat}
                    options={[{ value: 'docx', label: text('formats.docx'), icon: <Icon icon={FileType} size={14} /> },
                        { value: 'epub', label: text('formats.epub'), icon: <Icon icon={BookOpen} size={14} /> },
                        { value: 'markdown', label: text('formats.markdown'), icon: <Icon icon={Hash} size={14} /> },
                        { value: 'text', label: text('formats.text'), icon: <Icon icon={FileText} size={14} /> },
                        { value: 'pdf', label: text('formats.pdf'), icon: <Icon icon={Printer} size={14} /> }]} />
                <p className="text-caption text-parchment-400">{text('formatHelp.' + options.format)}</p>
            </div>
            {styleSheet ? null : companion ? <fieldset className="flex flex-col gap-1"><legend className="mb-1 text-label text-parchment-200">{text('scenesTitle')}</legend>
                <SwitchRow label={text('options.includeArchived')} description={text('optionHelp.includeArchived')} checked={options.includeArchived}
                    onChange={(includeArchived) => choose({ includeArchived })} />
                {options.document === 'review_notes' && <SwitchRow label={text('options.resolvedNotes')} description={text('optionHelp.resolvedNotes')}
                    checked={options.resolvedNotes} onChange={(resolvedNotes) => choose({ resolvedNotes })} />}
            </fieldset> : <fieldset className="flex flex-col gap-1"><legend className="mb-1 text-label text-parchment-200">{text('contents')}</legend>
                {SWITCHES.filter((name) => ONLY[name]?.includes(options.format) ?? true).map((name) => <SwitchRow key={name} label={text('options.' + name)}
                    description={text('optionHelp.' + name)} checked={options[name]} onChange={(checked) => choose({ [name]: checked })} />)}
            </fieldset>}
            {options.format === 'pdf' && <fieldset className="flex flex-col gap-3"><legend className="mb-1 text-label text-parchment-200">{text('layout.title')}</legend>
                <p className="text-caption text-parchment-400">{text('layout.help')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={text('layout.pageSize')}><Select value={layout.pageSize} onChange={(value) => arrange({ pageSize: value as StoryExportPdfLayout['pageSize'] })}
                        options={LAYOUT_CHOICES.pageSize.map((value) => ({ value, label: text('layout.sizes.' + value) }))} /></Field>
                    <Field label={text('layout.margins')}><Select value={layout.margins} onChange={(value) => arrange({ margins: value as StoryExportPdfLayout['margins'] })}
                        options={LAYOUT_CHOICES.margins.map((value) => ({ value, label: text('layout.marginSizes.' + value) }))} /></Field>
                    <Field label={text('layout.fontFamily')}><Select value={layout.fontFamily} onChange={(value) => arrange({ fontFamily: value as StoryExportPdfLayout['fontFamily'] })}
                        options={LAYOUT_CHOICES.fontFamily.map((value) => ({ value, label: text('layout.fonts.' + value) }))} /></Field>
                    <Field label={text('layout.fontSize')}><Select value={String(layout.fontSize)} onChange={(value) => arrange({ fontSize: Number(value) })}
                        options={[9, 10, 11, 12, 13, 14, 15, 16].map((size) => ({ value: String(size), label: text('layout.points', { size }) }))} /></Field>
                    <Field label={text('layout.lineSpacing')}><Select value={layout.lineSpacing} onChange={(value) => arrange({ lineSpacing: value as StoryExportPdfLayout['lineSpacing'] })}
                        options={LAYOUT_CHOICES.lineSpacing.map((value) => ({ value, label: text('layout.spacings.' + value) }))} /></Field>
                </div>
                <SwitchRow label={text('layout.pageNumbers')} description={text('layout.pageNumbersHelp')} checked={layout.pageNumbers} onChange={(pageNumbers) => arrange({ pageNumbers })} />
                <SwitchRow label={text('layout.justify')} description={text('layout.justifyHelp')} checked={layout.justify} onChange={(justify) => arrange({ justify })} />
            </fieldset>}
            {!companion && <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-label text-parchment-200">{text('glossary.title')}</legend>
                <SwitchRow label={text('glossary.add')} description={text('glossary.help')} checked={glossaryOn} onChange={toggleGlossary} />
                {glossaryOn && candidates.state === 'loading' && <p role="status" className="text-caption text-parchment-300">{text('glossary.loading')}</p>}
                {glossaryOn && candidates.state === 'failed' && <Callout tone="warning" role="alert"><p>{text('glossary.failed')}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => setCandidates({ state: 'loading' })}>{text('retry')}</Button></Callout>}
                {glossaryOn && candidates.state === 'ready' && (candidates.items.length === 0 ? <p className="text-caption text-parchment-300">{text('glossary.none')}</p> : <>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-caption text-parchment-300">{text('glossary.chosen', { count: options.glossary.length, total: candidates.items.length })}</span>
                        <Button size="sm" variant="ghost" onClick={() => pick(candidates.items.slice(0, 200).map((item) => item.refId))}>{text('glossary.all')}</Button>
                        <Button size="sm" variant="ghost" disabled={!options.glossary.length} onClick={() => pick([])}>{text('glossary.clear')}</Button>
                    </div>
                    <ul className="max-h-60 space-y-1 overflow-y-auto pr-1" aria-label={text('glossary.entries')}>
                        {candidates.items.map((item) => <li key={item.refId}><label className="flex items-start gap-2 text-caption text-parchment-200">
                            <input type="checkbox" className="mt-1 shrink-0" checked={options.glossary.includes(item.refId)}
                                disabled={!options.glossary.includes(item.refId) && options.glossary.length >= 200}
                                onChange={(event) => pick(event.target.checked ? [...options.glossary, item.refId] : options.glossary.filter((ref) => ref !== item.refId))} />
                            <span><span className="font-semibold text-parchment-100">{item.term}</span>{item.definition && <span className="block line-clamp-2 text-parchment-400">{item.definition}</span>}</span>
                        </label></li>)}
                    </ul>
                    <p className="text-caption text-parchment-400">{text('glossary.privacy')}</p>
                </>)}
            </fieldset>}
            {status === 'changed' && <Callout tone="warning" role="alert">{text('changed')}</Callout>}
            {status === 'failed' && <Callout tone="warning" role="alert">{text('failed')}</Callout>}
            {status === 'done' && manifest && <Callout tone="info" role="status">{text('done', { name: manifest.filename })}</Callout>}
            {loading && <p role="status" className="text-caption text-parchment-300">{text('loading')}</p>}
            {summary.state === 'failed' && <Callout tone="warning" role="alert"><p>{text(summary.code === 'STORY_EXPORT_PDF_UNAVAILABLE' ? 'pdfUnavailable' : 'summaryFailed')}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={reread}>{text('retry')}</Button></Callout>}
            {manifest && <section aria-label={text('summary')} className="flex flex-col gap-2 rounded-md border border-parchment-50/10 p-3">
                <h3 className="font-ui text-label text-parchment-100">{text('summary')}</h3>
                {!styleSheet && !manifest.scenes.length ? <Callout tone="warning" role="status">{text('nothing')}</Callout>
                    : manifest.entries === 0 ? <Callout tone="warning" role="status">{text('noEntries.' + options.document)}</Callout>
                    : <p className="text-body text-parchment-200">{manifest.entries !== null
                        ? text('entries.' + options.document, { count: manifest.entries, scenes: text('scenes', { count: manifest.scenes.length }) })
                        : text('holds', { scenes: text('scenes', { count: manifest.scenes.length }), chapters: text('chapters', { count: new Set(manifest.scenes.map((row) => row.chapterId)).size }) })}
                    {manifest.wordCount !== null && ' · ' + text('words', { count: manifest.wordCount, formatted: number(manifest.wordCount) })} · {size(manifest.bytes)}</p>}
                {!styleSheet && (['front', 'back'] as const).map((side) => {
                    const roles = matterRoles(manifest, side)
                    return roles.length > 0 && <p key={side} className="text-caption text-parchment-300">{text(side, { list: roles.map((role) => text('roles.' + role)).join(', ') })}</p>
                })}
                {manifest.glossary.length > 0 && <p className="text-caption text-parchment-300">{text('glossary.inFile', { count: manifest.glossary.length })}</p>}
                <p className="break-all text-caption text-parchment-400">{text('file', { name: manifest.filename })}</p>
                {manifest.notes.length > 0 && <ul className="list-disc space-y-1 pl-5 text-caption text-parchment-300">
                    {manifest.notes.map((note) => <li key={note.code}>{text('notes.' + note.code, { count: note.count })}</li>)}</ul>}
                {!styleSheet && manifest.excluded.length > 0 && <details><summary className="cursor-pointer text-caption text-parchment-300">{text('leftOut', { count: manifest.excluded.length })}</summary>
                    <ul className="mt-1 space-y-1 text-caption text-parchment-300">{manifest.excluded.map((row) => <li key={row.sceneId}>{row.chapterTitle} · {row.title} — {text('reasons.' + row.reason)}</li>)}</ul></details>}
                <p className="break-all font-mono text-caption text-parchment-400">{text('hash', { hash: manifest.sha256 })}</p>
            </section>}
            <NovelExportJobs source={source} manifest={exportable} onSourceChanged={reread} />
        </div>
    </Modal>
}
