/**
 * Progress toward the novel's goals from its saved writing log: the novel goal, the deadline pace, today against a
 * daily target, an optional streak and the last days of writing. Read-only; goals are set in the novel's details.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import type { StoryWritingProgress } from '@/shared/types/storyProgress.types'
import { Button, Callout, Modal, SwitchRow } from '@/ui/primitives'
import { deadlinePlan, netWords, periodSummary, writingCalendar, writingStreak } from '../utils/writingProgress'

interface Props {
    open: boolean
    onClose: () => void
    /** Reads the saved progress with days grouped in `timeZone`. */
    load: (timeZone: string, signal: AbortSignal) => Promise<StoryWritingProgress>
    /** Device-local key for the optional streak; null keeps it off and unsaved. */
    streakKey: string | null
}
type Result = { key: string; state: 'ready'; value: StoryWritingProgress } | { key: string; state: 'failed' }

function localZone(): string {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}
function readStreak(key: string | null): boolean {
    if (!key) return false
    try { return localStorage.getItem(key) === 'true' } catch { return false }
}

function Bar({ value, max, label, tone }: { value: number; max: number; label: string; tone: 'ember' | 'arcane' }) {
    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
    return <div className="h-1.5 w-full overflow-hidden rounded-full bg-parchment-50/10" role="progressbar" aria-label={label}
        aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(Math.max(value, 0), max)}>
        <div className={(tone === 'ember' ? 'bg-ember-500' : 'bg-arcane-500') + ' h-full transition-[width]'} style={{ width: `${percent}%` }} />
    </div>
}

export function NovelProgressDialog({ open, onClose, load, streakKey }: Props) {
    const { t, i18n } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.writingProgress.' + key, values)
    const [zone, setZone] = useState(localZone), [attempt, setAttempt] = useState(0), [result, setResult] = useState<Result | null>(null)
    const [streakOn, setStreakOn] = useState(() => readStreak(streakKey))
    const requestKey = zone + '\n' + attempt
    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        load(zone, controller.signal).then((value) => { if (!controller.signal.aborted) setResult({ key: requestKey, state: 'ready', value }) }, (error) => {
            if (controller.signal.aborted) return
            // An unknown zone on the server reads in UTC instead, and says so.
            if (error instanceof ApiError && error.code === 'STORY_TIME_ZONE_INVALID' && zone !== 'UTC') setZone('UTC')
            else setResult({ key: requestKey, state: 'failed' })
        })
        return () => controller.abort()
    }, [open, zone, requestKey, load])
    const current = result?.key === requestKey ? result : null
    const number = (value: number) => new Intl.NumberFormat(i18n.language).format(value)
    const date = (value: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }) =>
        new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'))
    function toggleStreak(on: boolean) {
        setStreakOn(on)
        if (streakKey) try { localStorage.setItem(streakKey, String(on)) } catch { /* the choice still applies until the dialog closes */ }
    }
    return <Modal open={open} onClose={onClose} title={text('title')} size="lg" footer={<Button variant="secondary" onClick={onClose}>{text('close')}</Button>}>
        {!current && <p role="status" className="text-body text-parchment-300">{text('loading')}</p>}
        {current?.state === 'failed' && <Callout tone="warning" role="alert"><p>{text('failed')}</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => setAttempt((value) => value + 1)}>{text('retry')}</Button></Callout>}
        {current?.state === 'ready' && ready(current.value)}
    </Modal>

    function ready(value: StoryWritingProgress) {
        const calendar = writingCalendar(value), today = calendar[calendar.length - 1], plan = deadlinePlan(value)
        const todayNet = netWords(today.author), recent = calendar.slice(-14).reverse(), month = periodSummary(calendar, 30)
        const streak = writingStreak(value), largest = Math.max(1, ...recent.map((day) => Math.abs(netWords(day.author))))
        return <div className="space-y-6">
            {zone === 'UTC' && localZone() !== 'UTC' && <Callout tone="info">{text('utc')}</Callout>}
            <section aria-labelledby="progress-goal" className="space-y-2">
                <h3 id="progress-goal" className="font-ui text-label text-parchment-100">{text('goal.title')}</h3>
                {value.wordGoal === null ? <p className="text-body text-parchment-300">{text('goal.none')}</p>
                    : value.activeWords === null ? <p className="text-body text-parchment-300">{text('goal.unknown')}</p>
                        : <>
                            <p className="text-body text-parchment-100">{text('goal.of', { words: number(value.activeWords), goal: number(value.wordGoal) })}</p>
                            <Bar value={value.activeWords} max={value.wordGoal} label={text('goal.bar')} tone="ember" />
                            <p className="text-caption text-parchment-300">{plan.remaining === 0 ? text('goal.reached') : text('goal.percent', { percent: number(Math.floor(value.activeWords / value.wordGoal * 100)) })}</p>
                        </>}
                <p className="text-body text-parchment-200">{!value.deadline ? text('deadline.none')
                    : plan.overdueDays !== null ? text('deadline.overdue', { count: plan.overdueDays, date: date(value.deadline) })
                        : text('deadline.left', { count: plan.daysLeft, date: date(value.deadline) })}</p>
                {plan.perDay !== null && plan.remaining !== null && plan.remaining > 0 && <p className="text-caption text-parchment-300">{text('deadline.pace', { count: plan.perDay, words: number(plan.perDay) })}</p>}
                {(value.wordGoal === null || !value.deadline || value.dailyWordGoal === null) && <p className="text-caption text-parchment-400">{text('setGoals')}</p>}
            </section>
            <section aria-labelledby="progress-today" className="space-y-2">
                <h3 id="progress-today" className="font-ui text-label text-parchment-100">{text('today.title')}</h3>
                <p className="text-body text-parchment-100">{text('today.written', { count: todayNet, words: number(todayNet) })}</p>
                <p className="text-caption text-parchment-300">{text('today.detail', { added: number(today.author.added), removed: number(today.author.removed) })}</p>
                {value.dailyWordGoal === null ? <p className="text-caption text-parchment-400">{text('today.none')}</p> : <>
                    <Bar value={todayNet} max={value.dailyWordGoal} label={text('today.bar')} tone="ember" />
                    <p className="text-caption text-parchment-300">{todayNet >= value.dailyWordGoal ? text('today.met') : text('today.target', { words: number(Math.max(todayNet, 0)), target: number(value.dailyWordGoal) })}</p>
                </>}
                {netWords(today.ai) !== 0 && <p className="text-caption text-arcane-300">{text('today.ai', { count: netWords(today.ai), words: number(netWords(today.ai)) })}</p>}
                <SwitchRow variant="plain" label={text('streak.label')} description={text('streak.help')} checked={streakOn} onChange={toggleStreak} />
                {streakOn && <p role="status" className="text-body text-ember-300">{streak.days === 0 ? text('streak.none')
                    : streak.atLeast ? text('streak.atLeast', { count: streak.days }) : text('streak.days', { count: streak.days })}</p>}
            </section>
            <section aria-labelledby="progress-recent" className="space-y-2">
                <h3 id="progress-recent" className="font-ui text-label text-parchment-100">{text('recent.title')}</h3>
                <table className="w-full text-left text-caption">
                    <caption className="mb-2 text-left text-parchment-400">{text('recent.caption')}</caption>
                    <thead><tr className="text-parchment-300"><th scope="col" className="py-1 pr-3 font-normal">{text('recent.day')}</th>
                        <th scope="col" className="w-1/2 py-1 pr-3 font-normal">{text('recent.you')}</th><th scope="col" className="py-1 text-right font-normal">{text('recent.ai')}</th></tr></thead>
                    <tbody>{recent.map((day) => <tr key={day.date} className="border-t border-parchment-50/5">
                        <th scope="row" className="py-1 pr-3 font-normal text-parchment-200">{date(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</th>
                        <td className="py-1 pr-3"><div className="flex items-center gap-2"><span className="w-14 shrink-0 text-right font-mono text-parchment-100">{number(netWords(day.author))}</span>
                            <span aria-hidden className="h-1.5 rounded-full bg-ember-500/80" style={{ width: `${Math.abs(netWords(day.author)) / largest * 100}%` }} /></div></td>
                        <td className="py-1 text-right font-mono text-arcane-300">{netWords(day.ai) ? number(netWords(day.ai)) : '–'}</td>
                    </tr>)}</tbody>
                </table>
                <p className="text-body text-parchment-200">{month.writingDays ? text('month', { count: month.writingDays, words: number(month.net), days: number(month.writingDays), average: number(month.average) }) : text('monthEmpty')}</p>
            </section>
            <p className="text-caption text-parchment-400">{text('counted', { zone: value.timeZone })}</p>
        </div>
    }
}
