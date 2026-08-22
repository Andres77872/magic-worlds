/**
 * StudioStatusStrip — the 34px footer under the manuscript, and the ONE place
 * the counters and the save state live. They used to sit in the masthead, far
 * from the words they describe; a word count belongs where a writer's eyes
 * already are.
 *
 * No AI review affordance here. Those controls belong on the generated passage
 * itself, in the document — see aiActionRow.
 */

import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { Button, Icon, cx } from '@/ui/primitives'
import { formatSaveState, type NovelSaveState } from '../utils/novelUtils'
import { WordGoalControl } from './WordGoalControl'

const DOT: Record<NovelSaveState, string> = {
    idle: 'bg-verdant-500',
    saved: 'bg-verdant-500',
    dirty: 'bg-ember-500',
    saving: 'bg-ember-500',
    error: 'bg-blood-500',
}

// The beat binding is Mod-Enter (the editor's shell handler accepts ctrlKey or
// metaKey), so the hint must not claim ⌘ on Windows.
const IS_APPLE =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')
const BEAT_KEY = IS_APPLE ? '⌘↵' : 'Ctrl+↵'

export interface StudioStatusStripProps {
    words: number
    goal: number | null
    onSetGoal: (goal: number | null) => void
    saveState: NovelSaveState
    lastSavedAt: Date | null
    onRetrySave: () => void
}

export function StudioStatusStrip({
    words,
    goal,
    onSetGoal,
    saveState,
    lastSavedAt,
    onRetrySave,
}: StudioStatusStripProps) {
    const { t } = useTranslation()

    return (
        <div
            className="mx-auto flex h-[34px] w-full max-w-[var(--width-manuscript)] shrink-0 items-center justify-between gap-3 border-t border-parchment-50/10 px-7"
            data-testid="novel-status-strip"
        >
            <div className="flex min-w-0 items-center gap-2.5">
                {/* The counter IS the goal control — one readout, and clicking it
                    is how a goal gets set. */}
                <WordGoalControl words={words} goal={goal} onSetGoal={onSetGoal} />
                <Divider />
                <span className="flex min-w-0 items-center gap-1.5" data-testid="novel-save-state">
                    <span className={cx('h-[5px] w-[5px] shrink-0 rounded-full', DOT[saveState])} aria-hidden="true" />
                    <span className="truncate font-ui text-[11px] text-parchment-400">
                        {formatSaveState(saveState, lastSavedAt, t)}
                    </span>
                </span>
                {saveState === 'error' && (
                    <Button
                        variant="primary"
                        size="sm"
                        iconLeft={<Icon icon={RotateCcw} size={14} />}
                        onClick={onRetrySave}
                    >
                        {t('novelEditor.save.retry')}
                    </Button>
                )}
            </div>

            <div className="hidden shrink-0 items-center gap-2.5 font-ui text-[11px] text-parchment-500 sm:flex">
                <span className="flex items-center gap-1.5">
                    <kbd className="font-mono text-parchment-300">/</kbd>
                    {t('novelEditor.slash.label')}
                </span>
                <Divider />
                <span className="flex items-center gap-1.5">
                    <kbd className="font-mono text-parchment-300">{BEAT_KEY}</kbd>
                    {t('novelEditor.beat.title')}
                </span>
            </div>
        </div>
    )
}

function Divider() {
    return <span className="h-3 w-px shrink-0 bg-parchment-50/10" aria-hidden="true" />
}
