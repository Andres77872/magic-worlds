import { AlignLeft, BookOpen, Eye, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Markdown } from '@/ui/components'
import { Chip, Icon, Textarea, cx } from '@/ui/primitives'

export type ContentView = 'plain' | 'markdown'

interface ResourceContentViewProps {
    mode: 'read' | 'edit'
    /** Read mode shows the saved content; edit mode shows the live draft. */
    content: string
    view: ContentView
    onViewChange: (view: ContentView) => void
    /** Edit-mode handlers (ignored in read mode). */
    onChange?: (value: string) => void
    overLimit?: boolean
    helper?: string
    error?: string
}

/**
 * The resource content section: a heading, a Plain | Markdown toggle (Write |
 * Preview while editing), and the content itself. In read mode `plain` shows the
 * raw text and `markdown` renders it; in edit mode `plain` is the raw textarea
 * (write) and `markdown` is a read-only rendered preview.
 */
export function ResourceContentView({
    mode,
    content,
    view,
    onViewChange,
    onChange,
    overLimit = false,
    helper,
    error,
}: ResourceContentViewProps) {
    const { t } = useTranslation()
    const isEdit = mode === 'edit'
    const isEmpty = content.trim().length === 0
    const surface = 'min-h-[320px] rounded-lg border border-parchment-50/[.08] bg-ink-900/40 p-4'

    return (
        <section className="grid gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span id="resource-content-label" className="font-ui text-label font-semibold text-parchment-200">
                    {t('lorebookResourcesGallery.content.heading')}
                </span>
                <div className="flex items-center gap-1.5" role="group" aria-labelledby="resource-content-label">
                    <Chip
                        active={view === 'plain'}
                        aria-pressed={view === 'plain'}
                        icon={<Icon icon={isEdit ? Pencil : AlignLeft} size={13} />}
                        onClick={() => onViewChange('plain')}
                    >
                        {isEdit ? t('lorebookResourcesGallery.content.write') : t('lorebookResourcesGallery.content.plain')}
                    </Chip>
                    <Chip
                        active={view === 'markdown'}
                        aria-pressed={view === 'markdown'}
                        icon={<Icon icon={isEdit ? Eye : BookOpen} size={13} />}
                        onClick={() => onViewChange('markdown')}
                    >
                        {isEdit ? t('lorebookResourcesGallery.content.preview') : t('lorebookResourcesGallery.content.markdown')}
                    </Chip>
                </div>
            </div>

            {isEdit && view === 'plain' ? (
                <Textarea
                    value={content}
                    onChange={(event) => onChange?.(event.target.value)}
                    aria-labelledby="resource-content-label"
                    className={cx('min-h-[320px] font-mono text-xs', overLimit && 'border-blood-500/60')}
                />
            ) : view === 'markdown' ? (
                <div className={surface}>
                    {isEmpty ? (
                        <p className="m-0 font-ui text-sm text-parchment-400">{t('lorebookResourcesGallery.content.emptyPreview')}</p>
                    ) : (
                        <Markdown content={content} />
                    )}
                </div>
            ) : (
                <div className={surface}>
                    {isEmpty ? (
                        <p className="m-0 font-ui text-sm text-parchment-400">{t('lorebookResourcesGallery.content.emptyPreview')}</p>
                    ) : (
                        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-parchment-200">{content}</pre>
                    )}
                </div>
            )}

            {(error || helper) && (
                <p className={cx('m-0 font-ui text-caption', error ? 'text-blood-300' : 'text-parchment-400')}>
                    {error || helper}
                </p>
            )}
        </section>
    )
}
