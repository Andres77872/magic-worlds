/**
 * Files built in the background (X10). The reviewed summary is queued as a job that reads the saved scenes, builds the
 * file (printing a PDF), and stores it, logging each step. A job keeps going after the dialog closes. A failed,
 * canceled or interrupted job can be tried again with its same choices, but a novel changed since is refused instead
 * of exported. A finished file is saved only when its size and SHA-256 match the job's.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import type { StoryExportJob, StoryExportManifest } from '@/shared/types/storyExport.types'
import { Badge, type BadgeTone, Button, Callout } from '@/ui/primitives'
import { downloadBlob } from '@/utils/download'
import type { ManuscriptExportSource } from '../hooks/useManuscriptExportSource'

type Jobs = { state: 'loading' } | { state: 'ready'; items: StoryExportJob[] } | { state: 'failed' }
type Notice = { tone: 'info' | 'warning'; key: string; values?: Record<string, unknown> }
const POLL_MS = 1500
const active = (job: StoryExportJob) => job.status === 'queued' || job.status === 'running'
const TONES: Record<StoryExportJob['status'], BadgeTone> = { queued: 'neutral', running: 'neutral', completed: 'live', failed: 'danger', canceled: 'neutral' }
/** The failure reasons with their own explanation; any other reads as a general failure. */
const REASONS = ['STORY_EXPORT_SOURCE_CHANGED', 'STORY_EXPORT_INTERRUPTED', 'STORY_EXPORT_PDF_UNAVAILABLE', 'STORY_NOT_FOUND']
const ERRORS = ['STORY_EXPORT_SOURCE_CHANGED', 'STORY_EXPORT_BUSY', 'STORY_EXPORT_JOB_NOT_RETRYABLE', 'STORY_EXPORT_FILE_REMOVED', 'STORY_EXPORT_FILE_MISMATCH']

interface Props {
    source: ManuscriptExportSource
    /** The summary a new job builds; null while it is read or when it holds nothing to export. */
    manifest: StoryExportManifest | null
    /** The saved manuscript changed after the summary: read it again. */
    onSourceChanged: () => void
}

export function NovelExportJobs({ source, manifest, onSourceChanged }: Props) {
    const { t, i18n } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.export.jobs.' + key, values)
    const [jobs, setJobs] = useState<Jobs>({ state: 'loading' })
    const [poll, setPoll] = useState(0)
    // 'build' or the id of the job an action is running on; one action at a time.
    const [busy, setBusy] = useState<string | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)
    const running = jobs.state === 'ready' && jobs.items.some(active)

    useEffect(() => {
        const controller = new AbortController()
        source.jobs.list(controller.signal)
            .then((items) => { if (!controller.signal.aborted && source.isCurrent()) setJobs({ state: 'ready', items }) })
            // A failed poll keeps the list it has; only a first read that fails says so.
            .catch(() => { if (!controller.signal.aborted && source.isCurrent()) setJobs((current) => current.state === 'ready' ? current : { state: 'failed' }) })
        return () => controller.abort()
    }, [source, poll])

    // While a job is queued or building, the list is read again until every job has finished.
    useEffect(() => {
        if (!running) return
        const timer = window.setTimeout(() => setPoll((value) => value + 1), POLL_MS)
        return () => window.clearTimeout(timer)
    }, [running, jobs])

    const put = (job: StoryExportJob) => setJobs((current) => {
        const items = current.state === 'ready' ? current.items : []
        return { state: 'ready', items: items.some((item) => item.id === job.id) ? items.map((item) => item.id === job.id ? job : item) : [job, ...items] }
    })
    const failure = (error: unknown, retry = false): Notice => {
        const code = error instanceof ApiError ? error.code : undefined
        if (code === 'STORY_EXPORT_SOURCE_CHANGED') return { tone: 'warning', key: retry ? 'errors.retryChanged' : 'errors.STORY_EXPORT_SOURCE_CHANGED' }
        return { tone: 'warning', key: code && ERRORS.includes(code) ? 'errors.' + code : 'errors.failed' }
    }
    const act = async (key: string, run: () => Promise<void>) => {
        if (busy) return
        setBusy(key); setNotice(null)
        try { await run() }
        finally { if (source.isCurrent()) setBusy(null) }
    }
    const build = () => act('build', async () => {
        if (!manifest) return
        try { const job = await source.jobs.start(manifest); if (source.isCurrent()) put(job) }
        catch (error) {
            if (!source.isCurrent()) return
            setNotice(failure(error))
            if (error instanceof ApiError && error.code === 'STORY_EXPORT_SOURCE_CHANGED') onSourceChanged()
        }
    })
    const cancel = (job: StoryExportJob) => act(job.id, async () => {
        try { const next = await source.jobs.cancel(job); if (source.isCurrent()) put(next) }
        catch (error) { if (source.isCurrent()) setNotice(failure(error)) }
    })
    const retry = (job: StoryExportJob) => act(job.id, async () => {
        try { const next = await source.jobs.retry(job); if (source.isCurrent()) put(next) }
        catch (error) { if (source.isCurrent()) setNotice(failure(error, true)) }
    })
    const download = (job: StoryExportJob) => act(job.id, async () => {
        if (!job.file) return
        try {
            const blob = await source.jobs.download(job)
            if (!source.isCurrent()) return
            downloadBlob(blob, job.file.filename)
            setNotice({ tone: 'info', key: 'downloaded', values: { name: job.file.filename } })
        } catch (error) { if (source.isCurrent()) setNotice(failure(error)) }
    })

    const when = (value: string) => new Date(value).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
    const time = (value: string) => new Date(value).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const size = (bytes: number) => bytes < 1024 * 1024 ? text('kilobytes', { size: Math.max(0.1, bytes / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })
        : text('megabytes', { size: (bytes / 1024 / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })
    const state = (job: StoryExportJob) => job.status === 'running' ? text('stages.' + job.stage) : text('status.' + job.status)
    const label = (job: StoryExportJob) => job.file?.filename ?? text('pending', {
        document: t('novelEditor.export.documents.' + job.request.document), format: t('novelEditor.export.formats.' + job.request.format) })
    const reason = (job: StoryExportJob) => text('reasons.' + (job.errorCode && REASONS.includes(job.errorCode) ? job.errorCode : 'failed'))

    return <section aria-labelledby="novel-export-jobs" className="flex flex-col gap-2">
        <h3 id="novel-export-jobs" className="font-ui text-label text-parchment-100">{text('title')}</h3>
        <p className="text-caption text-parchment-400">{text('help')}</p>
        <div><Button size="sm" variant="secondary" disabled={!manifest || busy !== null} onClick={() => void build()}>{text(busy === 'build' ? 'building' : 'build')}</Button></div>
        {notice && <Callout tone={notice.tone} role={notice.tone === 'info' ? 'status' : 'alert'}>{text(notice.key, notice.values)}</Callout>}
        {jobs.state === 'loading' && <p role="status" className="text-caption text-parchment-300">{text('loading')}</p>}
        {jobs.state === 'failed' && <Callout tone="warning" role="alert"><p>{text('loadFailed')}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setJobs({ state: 'loading' }); setPoll((value) => value + 1) }}>{text('reload')}</Button></Callout>}
        {jobs.state === 'ready' && (jobs.items.length === 0 ? <p className="text-caption text-parchment-300">{text('none')}</p>
            : <ul className="flex flex-col gap-2" aria-label={text('list')}>{jobs.items.map((job) => <li key={job.id} className="flex flex-col gap-1 rounded-md border border-parchment-50/10 p-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-all text-body text-parchment-100">{label(job)}</span>
                    <Badge tone={TONES[job.status]} role={active(job) ? 'status' : undefined}>{state(job)}</Badge>
                    {job.attempt > 1 && <span className="text-caption text-parchment-400">{text('attempt', { count: job.attempt })}</span>}
                </div>
                <p className="text-caption text-parchment-400">{text('queuedAt', { time: when(job.createdAt) })}
                    {job.sceneCount !== null && ' · ' + t('novelEditor.export.scenes', { count: job.sceneCount })}
                    {job.file && !job.file.removed && ' · ' + size(job.file.bytes)}</p>
                {job.status === 'failed' && <p className="text-caption text-blood-300">{reason(job)}</p>}
                {job.file?.removed && <p className="text-caption text-parchment-300">{text('removed')}</p>}
                {job.file && !job.file.removed && <p className="break-all font-mono text-caption text-parchment-400">{t('novelEditor.export.hash', { hash: job.file.sha256 })}</p>}
                <div className="flex flex-wrap items-center gap-2">
                    {job.file && !job.file.removed && <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void download(job)}>{text(busy === job.id ? 'downloading' : 'download')}</Button>}
                    {active(job) && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void cancel(job)}>{text('cancel')}</Button>}
                    {(job.status === 'failed' || job.status === 'canceled') && <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void retry(job)}>{text('retry')}</Button>}
                </div>
                <details><summary className="cursor-pointer text-caption text-parchment-300">{text('log')}</summary>
                    <ol className="mt-1 space-y-0.5 text-caption text-parchment-300">{job.log.map((row, index) => <li key={index}>
                        <span className="font-mono text-parchment-400">{time(row.at)}</span> {text('logs.' + row.code, {
                            ...row.values, count: typeof row.values?.scenes === 'number' ? row.values.scenes : undefined,
                            size: typeof row.values?.bytes === 'number' ? size(row.values.bytes) : undefined,
                            reason: row.code === 'failed' ? text('reasons.' + (REASONS.includes(String(row.values?.code)) ? row.values?.code : 'failed')) : undefined })}
                    </li>)}</ol>
                </details>
            </li>)}</ul>)}
    </section>
}
