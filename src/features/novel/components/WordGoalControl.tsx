/**
 * WordGoalControl — the header word counter, upgraded into an optional goal
 * tracker. With no goal it reads as a plain word count; set a goal and it shows
 * `count / goal` with a thin ember progress bar. Clicking opens a small popover
 * to set or clear the target.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Target } from 'lucide-react'
import { Button, Icon } from '@/ui/primitives'

interface WordGoalControlProps {
    words: number
    goal: number | null
    onSetGoal: (goal: number | null) => void
}

export function WordGoalControl({ words, goal, onSetGoal }: WordGoalControlProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState('')
    const wrapRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open) return
        const onPointer = (event: MouseEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const pct = goal ? Math.min(100, Math.round((words / goal) * 100)) : 0

    const openEditor = () => {
        setDraft(goal ? String(goal) : '')
        setOpen(true)
    }
    const commit = () => {
        const value = Number.parseInt(draft, 10)
        onSetGoal(Number.isFinite(value) && value > 0 ? value : null)
        setOpen(false)
    }
    const clear = () => {
        onSetGoal(null)
        setOpen(false)
    }

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={openEditor}
                className="flex items-center gap-1.5 font-ui text-xs text-parchment-400 transition-colors hover:text-parchment-200"
                data-testid="novel-word-goal"
                aria-label={t('novelEditor.header.goalAria')}
            >
                <Icon icon={Target} size={13} />
                {goal ? (
                    <span className="flex items-center gap-1.5">
                        <span>{t('novelEditor.header.goalProgress', { count: words.toLocaleString(), goal: goal.toLocaleString() })}</span>
                        <span className="block h-1 w-14 overflow-hidden rounded-full bg-parchment-50/10">
                            <span className="block h-full rounded-full bg-ember-500 transition-[width]" style={{ width: `${pct}%` }} />
                        </span>
                    </span>
                ) : (
                    <span>{t('novelEditor.header.words', { count: words, formatted: words.toLocaleString() })}</span>
                )}
            </button>
            {open && (
                <div
                    className="absolute right-0 top-[calc(100%+6px)] z-40 w-[220px] rounded-lg border border-parchment-50/10 bg-ink-700 p-3 shadow-xl"
                    data-testid="novel-word-goal-popover"
                >
                    <label htmlFor="novel-word-goal-input" className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.14em] text-parchment-400">
                        {t('novelEditor.header.goalLabel')}
                    </label>
                    <input
                        id="novel-word-goal-input"
                        type="number"
                        min={1}
                        value={draft}
                        autoFocus
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') commit()
                        }}
                        placeholder={t('novelEditor.header.goalPlaceholder')}
                        className="w-full rounded-md border border-parchment-50/10 bg-ink-800 px-2.5 py-1.5 font-ui text-sm text-parchment-50 outline-none focus:border-ember-500"
                        data-testid="novel-word-goal-input"
                    />
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                        <Button variant="ghost" size="sm" onClick={clear} disabled={!goal}>
                            {t('novelEditor.header.goalClear')}
                        </Button>
                        <Button variant="primary" size="sm" onClick={commit}>
                            {t('novelEditor.header.goalSet')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
