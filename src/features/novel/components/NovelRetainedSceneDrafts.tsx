import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Callout, Field, Textarea } from '@/ui/primitives'
import { documentMarkdown } from '@/shared/storyDocument'
import { downloadBlob, safeFilename } from '@/utils/download'
import type { RetainedSceneDraft } from '../persistence/retainedSceneDrafts'

export function NovelRetainedSceneDrafts({ items, unavailable = false }: { items: RetainedSceneDraft[]; unavailable?: boolean }) {
    const { t } = useTranslation(), text = (key: string, options?: Record<string, unknown>) => t('novelEditor.offline.' + key, options)
    const [details, setDetails] = useState<string | null>(null)
    const [notice, setNotice] = useState<{ key: string; failed: boolean } | null>(null)
    if (!items.length && !unavailable) return null
    async function copy(item: RetainedSceneDraft) {
        try { await navigator.clipboard.writeText(documentMarkdown(item.document)); setNotice({ key: item.storageKey, failed: false }) }
        catch { setNotice({ key: item.storageKey, failed: true }); setDetails(item.storageKey) }
    }
    return <Callout tone={unavailable ? 'warning' : 'success'} className="m-3">
        <div className="space-y-3">
            <h3 className="font-display text-h3">{text('copies')}</h3><p>{text('copiesHelp')}</p>
            {unavailable && <p role="alert">{text('unavailable')}</p>}
            {items.map((item) => <section key={item.storageKey} className="space-y-2">
                <h4 className="font-ui text-label">{item.title} · {text('revision', { revision: item.baseRevision })}</h4>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void copy(item)}>{text('copy')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => {
                        const payload = { schema: 'novel-device-draft-v1', title: item.title, document: item.document,
                            baseRevision: item.baseRevision, baseMetadataRevision: item.baseMetadataRevision, retainedAt: item.retainedAt }
                        downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), safeFilename(item.title, 'device-draft') + '.device-draft.json')
                    }}>{text('download')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDetails((old) => old === item.storageKey ? null : item.storageKey)}>{text(details === item.storageKey ? 'hide' : 'show')}</Button>
                </div>
                {notice?.key === item.storageKey && <p role="status">{text(notice.failed ? 'copyFailed' : 'copied')}</p>}
                {details === item.storageKey && <Field label={text('copyable')}><Textarea readOnly rows={6} value={documentMarkdown(item.document)} /></Field>}
            </section>)}
        </div>
    </Callout>
}
