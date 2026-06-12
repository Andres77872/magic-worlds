/**
 * NovelChapterRail — left rail listing the novel's chapters in order, with
 * add and per-chapter delete (confirmed). Selection is delegated upward so
 * the studio can flush the draft before switching.
 */

import { useState } from 'react'
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
    const [pendingDelete, setPendingDelete] = useState<StoryChapter | null>(null)

    return (
        <aside className="flex min-h-0 flex-col border-b border-parchment-50/10 bg-ink-900/35 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <h2 className="m-0 font-ui text-sm font-semibold text-parchment-100">Chapters</h2>
                <IconButton label="Add chapter" size="sm" onClick={onAdd}>
                    <Icon icon={Plus} size={16} />
                </IconButton>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
                {chapters.map((chapter, index) => {
                    const active = chapter.id === activeChapterId
                    return (
                        <div key={chapter.id} className="group relative">
                            <button
                                type="button"
                                onClick={() => onSelect(chapter.id)}
                                className={cx(
                                    'w-full cursor-pointer rounded-md border px-3 py-2 text-left transition',
                                    active
                                        ? 'border-ember-500/70 bg-ember-500/10'
                                        : 'border-parchment-50/10 hover:border-parchment-50/25 hover:bg-parchment-50/[.04]',
                                )}
                                data-testid="novel-chapter-row"
                            >
                                <span className="block truncate pr-7 font-ui text-sm font-semibold text-parchment-100">
                                    {chapter.title || `Chapter ${index + 1}`}
                                </span>
                                <span className="mt-1 block font-ui text-xs text-parchment-400">
                                    {wordCount(chapter.body)} words
                                </span>
                            </button>
                            {chapters.length > 1 && (
                                <IconButton
                                    label={`Delete ${chapter.title || `Chapter ${index + 1}`}`}
                                    size="sm"
                                    tone="danger"
                                    onClick={() => setPendingDelete(chapter)}
                                    className="absolute right-1.5 top-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                                >
                                    <Icon icon={Trash2} size={14} />
                                </IconButton>
                            )}
                        </div>
                    )
                })}
            </div>

            <ConfirmDialog
                visible={pendingDelete !== null}
                title="Delete chapter"
                message={pendingDelete ? `Delete "${pendingDelete.title}"? Its text cannot be recovered.` : ''}
                confirmLabel="Delete"
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
