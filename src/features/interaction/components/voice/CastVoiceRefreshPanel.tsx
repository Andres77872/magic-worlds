/**
 * Adventure cast voices menu (R1-FE-04; 05 §7.8, AC-C6): "N characters sound
 * different from their cards" with "Use the cards' current voices", which
 * opens the affected cast as checkboxes, pre-selected where a substitution is
 * active, and refreshes the checked ones (`useCastVoiceRefresh`). The narrator
 * is changed through the narrator panel, never here.
 *
 * Renders nothing while no cast member is affected and no refresh is settling,
 * so sessions without drift look exactly as before.
 *
 * `variant`: `panel` is the boxed block in the side panel's cast section; `bar`
 * is the slim strip under the adventure top bar (below xl, where the side panel
 * is a drawer). Applying moves focus to the status line (`statusRef`), which
 * stays while it holds focus.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Button, Icon, cx } from '@/ui/primitives'
import type { CastVoiceRefresh } from './useCastVoiceRefresh'
import type { CastVoiceDrift } from './sessionVoiceDrift'
import { useDoneReset } from './useDoneReset'

export interface CastVoiceRefreshPanelProps {
    cast: CastVoiceRefresh
    variant?: 'panel' | 'bar'
    className?: string
    /** Accessible name of the strip (`bar`). */
    label?: string
}

export function CastVoiceRefreshPanel({ cast, variant = 'panel', className, label }: CastVoiceRefreshPanelProps) {
    const { t } = useTranslation()
    const panelId = useId()
    const summaryId = useId()
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
    const { affected, refresh, statusRef } = cast
    useDoneReset(refresh, statusRef)

    if (affected.length === 0 && refresh.status === 'idle') return null

    const busy = refresh.status === 'busy'
    const chosen = affected.filter((drift) => selected.has(drift.cardId)).map((drift) => drift.cardId)
    const toggleOpen = () => {
        if (!open) setSelected(new Set(affected.filter((drift) => drift.replaced).map((drift) => drift.cardId)))
        setOpen(!open)
    }
    const toggleMember = (cardId: string, checked: boolean) => {
        setSelected((current) => {
            const next = new Set(current)
            if (checked) next.add(cardId)
            else next.delete(cardId)
            return next
        })
    }
    const apply = () => {
        if (chosen.length === 0) return
        setOpen(false)
        // The list (and this button) closes: the status line reports the outcome.
        statusRef.current?.focus()
        cast.run(chosen)
    }

    return (
        <div
            className={cx(
                'flex flex-col',
                variant === 'bar'
                    ? 'shrink-0 gap-1.5 border-b border-parchment-50/[.08] bg-ink-900/80 px-3 py-1.5'
                    : 'gap-2 rounded-md border border-parchment-50/10 bg-ink-700/60 px-3 py-2.5',
                className,
            )}
            data-testid="cast-voice-refresh"
            {...(variant === 'bar' ? { role: 'group', 'aria-label': label } : {})}
        >
            {affected.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p id={summaryId} className="min-w-0 font-ui text-caption text-parchment-200">
                        {t('voices.refresh.castSummary', { count: affected.length })}
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={<Icon icon={RefreshCw} size={14} />}
                        onClick={toggleOpen}
                        disabled={busy}
                        aria-expanded={open}
                        aria-controls={open ? panelId : undefined}
                        aria-describedby={summaryId}
                    >
                        {t('voices.refresh.castOpen')}
                    </Button>
                </div>
            )}
            {open && affected.length > 0 && (
                <fieldset id={panelId} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" disabled={busy}>
                    <legend className="mb-1 font-ui text-caption font-semibold text-parchment-100">
                        {t('voices.refresh.castLegend')}
                    </legend>
                    {affected.map((drift) => (
                        <CastMemberOption
                            key={drift.cardId}
                            drift={drift}
                            checked={selected.has(drift.cardId)}
                            onChange={(checked) => toggleMember(drift.cardId, checked)}
                        />
                    ))}
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="primary" size="sm" onClick={apply} disabled={chosen.length === 0}>
                            {t('voices.refresh.castApply', { count: chosen.length })}
                        </Button>
                    </div>
                </fieldset>
            )}
            <span
                ref={statusRef}
                role="status"
                tabIndex={-1}
                className={cx('font-ui text-caption', refresh.status === 'error' ? 'text-blood-300' : 'text-parchment-300')}
            >
                {refresh.message}
            </span>
        </div>
    )
}

function CastMemberOption({ drift, checked, onChange }: { drift: CastVoiceDrift; checked: boolean; onChange: (checked: boolean) => void }) {
    const { t } = useTranslation()
    const id = useId()
    const fallback = t('voices.display.fallbackName')
    return (
        <div className="flex items-start gap-2.5">
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                aria-describedby={`${id}-detail`}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-ember-500 disabled:cursor-not-allowed"
            />
            <div className="min-w-0">
                <label htmlFor={id} className="block cursor-pointer break-words font-ui text-sm text-parchment-100">
                    {drift.name || t('interaction.leftPanel.untitled')}
                </label>
                <span id={`${id}-detail`} className="block break-words font-ui text-caption text-parchment-300">
                    {t('voices.refresh.castMember', { current: drift.sessionName ?? fallback, card: drift.cardName ?? fallback })}
                </span>
            </div>
        </div>
    )
}
