import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryImportRecord } from '@/shared/types/storyImport.types'
import { Button } from '@/ui/primitives'
import { downloadBlob } from '@/utils/download'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'

/** Where an imported novel came from: the file, when, what the conversion changed, and the original file to download again. */
export function NovelImportOrigin({ record, workspace }: { record: StoryImportRecord; workspace: StoryWorkspace }) {
    const { t, i18n } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.import.' + key, values)
    const [status, setStatus] = useState<'idle' | 'downloading' | 'failed'>('idle')
    const download = async () => {
        const api = workspace.detachedApi()
        if (!api || status === 'downloading') return
        setStatus('downloading')
        try {
            const blob = await api.downloadStoryImportSource(record)
            if (!workspace.isCurrent()) return
            downloadBlob(blob, record.filename); setStatus('idle')
        } catch { if (workspace.isCurrent()) setStatus('failed') }
    }
    return <div className="space-y-2">
        <p className="font-ui text-label text-parchment-100">{text('origin.title')}</p>
        <p>{text('origin.description', { name: record.filename, format: text('format.' + record.format), date: new Date(record.importedAt).toLocaleString(i18n.language) })}</p>
        <p className="text-caption text-parchment-300">{text('origin.counts', { chapters: text('count.chapters', { count: record.chapters }), scenes: text('count.scenes', { count: record.scenes }) })}
            {record.wordCount !== null && ' · ' + text('words', { count: record.wordCount, formatted: record.wordCount.toLocaleString(i18n.language) })}</p>
        {record.losses.length > 0 && <ul className="list-disc space-y-1 pl-5 text-caption text-parchment-300">
            {record.losses.map((loss) => <li key={loss.code}>{text('loss.' + loss.code, { count: loss.count })}</li>)}</ul>}
        <Button size="sm" variant="secondary" disabled={status === 'downloading'} onClick={() => void download()}>{text(status === 'downloading' ? 'origin.downloading' : 'origin.download')}</Button>
        {status === 'failed' && <p role="alert" className="text-caption text-parchment-200">{text('origin.downloadFailed')}</p>}
    </div>
}
