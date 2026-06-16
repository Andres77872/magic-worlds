/**
 * NovelStudioHeader — the studio masthead. Novel title and description edit
 * inline (commit on blur/Enter); the right cluster carries the save-state
 * pill, word count, history, codex and focus toggles, and explicit Save.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked, History, Minimize2, PanelRightOpen, Save } from 'lucide-react'
import type { Story } from '@/shared'
import { Button, Eyebrow, Icon, cx } from '@/ui/primitives'
import { formatSaveState, storySourceLabel, type NovelSaveState } from '../utils/novelUtils'

interface NovelStudioHeaderProps {
    story: Story
    saveState: NovelSaveState
    lastSavedAt: Date | null
    words: number
    focusMode: boolean
    codexOpen: boolean
    saveDisabled?: boolean
    onSave: () => void
    onToggleFocusMode: () => void
    onToggleCodex: () => void
    onOpenHistory: () => void
    onSaveMeta: (patch: { title?: string; description?: string }) => void
}

export function NovelStudioHeader({
    story,
    saveState,
    lastSavedAt,
    words,
    focusMode,
    codexOpen,
    saveDisabled,
    onSave,
    onToggleFocusMode,
    onToggleCodex,
    onOpenHistory,
    onSaveMeta,
}: NovelStudioHeaderProps) {
    const { t } = useTranslation()
    const [title, setTitle] = useState(story.title)
    const [description, setDescription] = useState(story.description ?? '')

    const storyId = story.id
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(story.title)
        setDescription(story.description ?? '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storyId])

    const commitTitle = () => {
        const next = title.trim() || t('novelEditor.header.untitled')
        setTitle(next)
        if (next !== story.title) onSaveMeta({ title: next })
    }

    const commitDescription = () => {
        const next = description.trim()
        if (next !== (story.description ?? '')) onSaveMeta({ description: next })
    }

    const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur()
    }

    return (
        <header className="border-b border-parchment-50/10 bg-ink-900/70 px-5 py-4 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Eyebrow tone="ember">{t('novelEditor.header.eyebrow', { source: storySourceLabel(story, t) })}</Eyebrow>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={blurOnEnter}
                        aria-label={t('novelEditor.header.titleLabel')}
                        className="m-0 w-full max-w-[34ch] border-none bg-transparent p-0 font-display text-[28px] font-semibold tracking-tight text-parchment-50 outline-none placeholder:text-parchment-500"
                        placeholder={t('novelEditor.header.untitled')}
                        data-testid="novel-title-input"
                    />
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={commitDescription}
                        onKeyDown={blurOnEnter}
                        aria-label={t('novelEditor.header.descriptionLabel')}
                        className="m-0 w-full max-w-[60ch] border-none bg-transparent p-0 font-narrative text-[15px] text-parchment-300 outline-none placeholder:text-parchment-500"
                        placeholder={t('novelEditor.header.descriptionPlaceholder')}
                    />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                        className={cx(
                            'font-ui text-xs',
                            saveState === 'error' ? 'text-blood-500' : 'text-parchment-400',
                        )}
                        data-testid="novel-save-state"
                    >
                        {formatSaveState(saveState, lastSavedAt, t)}
                    </span>
                    <span className="font-ui text-xs text-parchment-400">{t('novelEditor.header.words', { count: words, formatted: words.toLocaleString() })}</span>
                    <Button variant="ghost" size="sm" iconLeft={<Icon icon={History} size={15} />} onClick={onOpenHistory}>
                        {t('novelEditor.header.history')}
                    </Button>
                    {!focusMode && (
                        <Button
                            variant={codexOpen ? 'secondary' : 'ghost'}
                            size="sm"
                            iconLeft={<Icon icon={BookMarked} size={15} />}
                            onClick={onToggleCodex}
                            aria-pressed={codexOpen}
                        >
                            {t('novelEditor.header.codex')}
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<Icon icon={focusMode ? PanelRightOpen : Minimize2} size={15} />}
                        onClick={onToggleFocusMode}
                    >
                        {focusMode ? t('novelEditor.header.panels') : t('novelEditor.header.focus')}
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        iconLeft={<Icon icon={Save} size={15} />}
                        onClick={onSave}
                        disabled={saveState === 'saving' || saveDisabled}
                    >
                        {saveState === 'saving' ? t('novelEditor.save.saving') : t('common.save')}
                    </Button>
                </div>
            </div>
        </header>
    )
}
