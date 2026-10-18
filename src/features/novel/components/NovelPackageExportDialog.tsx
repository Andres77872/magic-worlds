/**
 * Back up the whole saved novel as a project package (.mwnovel): every part, chapter and scene, archived and trashed
 * ones too, its settings and Codex references, and by choice its comments and bookmarks, planning items and saved scene
 * revisions. A summary of what the package holds, its size and SHA-256 is read first; the download must match it, so a
 * novel saved in between is refused and summarized again instead of silently backed up.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import type { StoryPackageManifest, StoryPackageOptions } from '@/shared/types/storyPackage.types'
import { Button, Callout, Modal, SwitchRow } from '@/ui/primitives'
import { canonicalJson } from '@/utils/json'
import { downloadBlob } from '@/utils/download'
import type { NovelPackageSource } from '../hooks/useNovelPackageSource'
import { packageOutline } from './packageOutline'

const DEFAULTS: StoryPackageOptions = { notes: true, planning: true, history: false }
const SWITCHES = ['notes', 'planning', 'history'] as const
/** What the summary lists beyond the outline, in this order, when there is any. */
const EXTRAS = ['references', 'comments', 'bookmarks', 'tasks', 'facts', 'stash', 'revisions'] as const

type Summary = { state: 'loading' } | { state: 'ready'; manifest: StoryPackageManifest; key: string } | { state: 'failed'; code?: string }

interface Props { open: boolean; onClose: () => void; source: NovelPackageSource }

export function NovelPackageExportDialog({ open, onClose, source }: Props) {
    const { t, i18n } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.package.' + key, values)
    const [options, setOptions] = useState<StoryPackageOptions>(DEFAULTS)
    const [summary, setSummary] = useState<Summary>({ state: 'loading' })
    const [attempt, setAttempt] = useState(0)
    const [status, setStatus] = useState<'idle' | 'downloading' | 'changed' | 'failed' | 'done'>('idle')
    const key = canonicalJson(options)

    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        // Choices settle before the summary is read again.
        const timer = window.setTimeout(() => {
            source.preview(options, controller.signal)
                .then((manifest) => { if (!controller.signal.aborted && source.isCurrent()) setSummary({ state: 'ready', manifest, key }) })
                .catch((error) => { if (!controller.signal.aborted && source.isCurrent()) setSummary({ state: 'failed', code: error instanceof ApiError ? error.code : undefined }) })
        }, 200)
        return () => { window.clearTimeout(timer); controller.abort() }
    }, [open, source, options, key, attempt])

    const manifest = summary.state === 'ready' && summary.key === key ? summary.manifest : null
    const loading = summary.state === 'loading' || summary.state === 'ready' && summary.key !== key
    const choose = (change: Partial<StoryPackageOptions>) => { setOptions((current) => ({ ...current, ...change })); setStatus('idle'); if (summary.state === 'failed') setSummary({ state: 'loading' }) }
    const download = async () => {
        if (!manifest || status === 'downloading') return
        setStatus('downloading')
        try {
            downloadBlob(await source.download(manifest), manifest.filename)
            setStatus('done')
        } catch (error) {
            if (error instanceof ApiError && error.code === 'STORY_PACKAGE_SOURCE_CHANGED') { setStatus('changed'); setSummary({ state: 'loading' }); setAttempt((value) => value + 1) }
            else setStatus('failed')
        }
    }
    const number = (value: number) => value.toLocaleString(i18n.language)
    const size = (bytes: number) => bytes < 1024 ? text('bytes', { count: bytes }) : bytes < 1024 * 1024 ? text('kilobytes', { size: (bytes / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })
        : text('megabytes', { size: (bytes / 1024 / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })
    const extras = manifest ? EXTRAS.filter((name) => manifest.counts[name] > 0).map((name) => text('count.' + name, { count: manifest.counts[name] })) : []

    return <Modal open={open} onClose={onClose} title={text('title')} size="lg" footer={<>
        <Button variant="ghost" onClick={onClose}>{text('close')}</Button>
        <Button disabled={!manifest || status === 'downloading'} onClick={() => void download()}>{text(status === 'downloading' ? 'downloading' : 'download')}</Button>
    </>}>
        <div className="flex flex-col gap-4">
            <p className="text-body text-parchment-200">{text('help')}</p>
            <Callout tone="info">{text('savedOnly')}</Callout>
            <fieldset className="flex flex-col gap-3"><legend className="mb-1 text-label text-parchment-200">{text('include')}</legend>
                {SWITCHES.map((name) => <SwitchRow key={name} label={text(name)} description={text(name + 'Help')} checked={options[name]}
                    disabled={status === 'downloading'} onChange={(checked) => choose({ [name]: checked })} />)}
            </fieldset>
            {loading && <p role="status" className="text-caption text-parchment-300">{text('loading')}</p>}
            {summary.state === 'failed' && <Callout tone="warning" role="alert"><p>{text(summary.code === 'STORY_PACKAGE_TOO_LARGE' ? 'tooLarge' : 'summaryFailed')}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setSummary({ state: 'loading' }); setAttempt((value) => value + 1) }}>{text('retry')}</Button></Callout>}
            {manifest && <section aria-label={text('summary')} className="flex flex-col gap-2 rounded-md border border-parchment-50/10 p-3">
                <h3 className="font-ui text-label text-parchment-100">{text('summary')}</h3>
                <p className="text-body text-parchment-200">{packageOutline(manifest.counts, text)}
                    {manifest.counts.words !== null && ' · ' + text('words', { count: manifest.counts.words, formatted: number(manifest.counts.words) })} · {size(manifest.bytes)}</p>
                {extras.length > 0 && <p className="text-caption text-parchment-300">{extras.join(' · ')}</p>}
                {manifest.media.length > 0 && <p className="text-caption text-parchment-400">{text('cover')}</p>}
                <p className="break-all font-mono text-caption text-parchment-400">{manifest.filename} · SHA-256 {manifest.sha256.slice(0, 16)}…</p>
            </section>}
            {status === 'changed' && <Callout tone="warning" role="alert">{text('changed')}</Callout>}
            {status === 'failed' && <Callout tone="warning" role="alert">{text('failed')}</Callout>}
            {status === 'done' && manifest && <Callout tone="info" role="status">{text('done', { name: manifest.filename })}</Callout>}
        </div>
    </Modal>
}
