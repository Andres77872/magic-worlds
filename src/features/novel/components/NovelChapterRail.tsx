/**
 * NovelChapterRail — the chapter index. It is a list the writer scans, not a
 * gallery: 30px single-line rows, an ember left edge on the active one, and no
 * card chrome. Two-line bordered cards let ten chapters fill the viewport, which
 * is exactly when a manuscript needs the index most.
 *
 * Adding a chapter is a quiet row at the foot of the list rather than an icon in
 * the header — it is the one write action here, so it should read as the next
 * chapter rather than as a toolbar button. Selection stays delegated upward so
 * the studio can flush the draft before switching.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import type { StoryChapter } from '@/shared'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Icon, IconButton, cx } from '@/ui/primitives'
import { wordCount } from '../utils/novelUtils'

interface NovelChapterRailProps {
    chapters: StoryChapter[]
    activeChapterId: string | null
    onSelect: (chapterId: string) => void
    onAdd: () => void
    onDelete: (chapterId: string) => void
}

export function NovelChapterRail({ chapters, activeChapterId, onSelect, onAdd, onDelete }: NovelChapterRailProps) {
    const { t } = useTranslation()
    const [pendingDelete, setPendingDelete] = useState<StoryChapter | null>(null)

    const deletable = chapters.length > 1
    const totalWords = chapters.reduce((sum, chapter) => sum + wordCount(chapter.body), 0)

    // The rail has no width of its own: it is a grid item and the studio owns
    // the track, so a fixed `lg:w-*` here would only leave a dead strip whenever
    // the two disagree.
    return (
        <aside className="flex min-h-0 w-full flex-col border-b border-parchment-50/10 bg-ink-900/35 lg:border-b-0 lg:border-r">
            <div className="flex h-[34px] shrink-0 items-center justify-between gap-2 px-3">
                <h2 className="m-0 font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                    {t('novelEditor.chapters.title')}
                </h2>
                <span className="shrink-0 font-mono text-[10px] text-parchment-500">
                    {t('novelEditor.header.words', { count: totalWords, formatted: totalWords.toLocaleString() })}
                </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {chapters.map((chapter, index) => {
                    const active = chapter.id === activeChapterId
                    const label = chapter.title || t('novelEditor.chapters.fallbackTitle', { number: index + 1 })
                    return (
                        <div key={chapter.id} className="group relative">
                            <button
                                type="button"
                                onClick={() => onSelect(chapter.id)}
                                className={cx(
                                    'flex h-[30px] w-full cursor-pointer items-center gap-2 border-l-2 pl-2.5 text-left transition-colors',
                                    deletable ? 'pr-8' : 'pr-2.5',
                                    active
                                        ? 'border-ember-500 bg-ember-500/10'
                                        : 'border-transparent hover:bg-parchment-50/[.04]',
                                )}
                                data-testid="novel-chapter-row"
                            >
                                <span className="w-[13px] shrink-0 font-mono text-[11px] text-parchment-500">{index + 1}</span>
                                <span
                                    className={cx(
                                        'min-w-0 flex-1 truncate font-ui text-[13px]',
                                        active ? 'text-parchment-50' : 'text-parchment-100',
                                    )}
                                >
                                    {label}
                                </span>
                                <span
                                    className="shrink-0 font-mono text-[11px] text-parchment-500"
                                    aria-label={t('novelEditor.chapters.words', { count: wordCount(chapter.body) })}
                                >
                                    {wordCount(chapter.body).toLocaleString()}
                                </span>
                            </button>
                            {deletable && (
                                <IconButton
                                    label={t('novelEditor.chapters.deleteLabel', { title: label })}
                                    size="sm"
                                    tone="danger"
                                    onClick={() => setPendingDelete(chapter)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                                >
                                    <Icon icon={Trash2} size={14} />
                                </IconButton>
                            )}
                        </div>
                    )
                })}
            </div>

            <button
                type="button"
                onClick={onAdd}
                className="flex h-[30px] w-full shrink-0 cursor-pointer items-center gap-2 border-l-2 border-transparent pl-2.5 pr-2.5 text-left font-ui text-[13px] text-parchment-400 transition-colors hover:bg-parchment-50/[.04] hover:text-parchment-100"
                data-testid="novel-chapter-add"
            >
                <span className="flex w-[13px] shrink-0 items-center justify-center">
                    <Icon icon={Plus} size={14} />
                </span>
                <span className="truncate">{t('novelEditor.chapters.add')}</span>
            </button>

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={t('novelEditor.chapters.deleteTitle')}
                message={pendingDelete ? t('novelEditor.chapters.deleteMessage', { title: pendingDelete.title }) : ''}
                confirmLabel={t('novelEditor.chapters.deleteConfirm')}
                variant="danger"
                onConfirm={() => {
                    if (pendingDelete) onDelete(pendingDelete.id)
                    setPendingDelete(null)
                }}
                onCancel={() => setPendingDelete(null)}
            />
        </aside>
    )
}
