/**
 * WordGoalControl — the word count, with an optional target behind it. It sits
 * at the left of the status strip under the manuscript, so at rest it is one
 * mono readout and nothing else: no icon, no progress bar, no border. The bar
 * and the label bought nothing a writer glancing at "1,204 / 2,000" does not
 * already read.
 *
 * Clicking opens a small popover — Enter commits, Escape or an outside click
 * closes, Clear removes the target. It opens UPWARD and left-aligned because
 * the strip is the bottom edge of the layout; anchoring it below would put it
 * off-screen.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/ui/primitives'

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
    const triggerRef = useRef<HTMLButtonElement | null>(null)

    useEffect(() => {
        if (!open) return
        const onPointer = (event: MouseEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            setOpen(false)
            // The popover holds focus (autoFocus on the input); closing it must
            // not drop focus on <body>.
            triggerRef.current?.focus()
        }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

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
                ref={triggerRef}
                type="button"
                onClick={openEditor}
                aria-label={t('novelEditor.header.goalAria')}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="flex h-7 cursor-pointer items-center whitespace-nowrap rounded-xs px-1.5 font-mono text-[11px] text-parchment-400 transition-colors hover:bg-parchment-50/[.06] hover:text-parchment-200"
                data-testid="novel-word-goal"
            >
                {goal
                    ? t('novelEditor.header.goalProgress', { count: words.toLocaleString(), goal: goal.toLocaleString() })
                    : t('novelEditor.header.words', { count: words, formatted: words.toLocaleString() })}
            </button>
            {open && (
                <div
                    role="dialog"
                    aria-label={t('novelEditor.header.goalLabel')}
                    className="absolute bottom-[calc(100%+6px)] left-0 z-40 w-[220px] rounded-md border border-parchment-50/10 bg-ink-700 p-3 shadow-lg"
                    data-testid="novel-word-goal-popover"
                >
                    <label htmlFor="novel-word-goal-input" className="mb-1.5 block font-ui text-meta uppercase tracking-[0.14em] text-parchment-400">
                        {t('novelEditor.header.goalLabel')}
                    </label>
                    <input
                        id="novel-word-goal-input"
                        type="number"
                        min={1}
                        max={2147483647}
                        value={draft}
                        autoFocus
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') commit()
                        }}
                        placeholder={t('novelEditor.header.goalPlaceholder')}
                        className="w-full rounded-md border border-parchment-50/10 bg-ink-800 px-2.5 py-1.5 font-ui text-sm text-parchment-50 focus:border-ember-500"
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
