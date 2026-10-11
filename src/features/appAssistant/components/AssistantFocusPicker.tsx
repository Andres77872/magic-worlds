/**
 * Focus picker — choose library records the assistant should read in full
 * (descriptions, lore entries, resource text) rather than as one-line digests.
 * Works on the already-loaded library, so it opens instantly and never fetches.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Crosshair, Search } from 'lucide-react'
import { Button, Chip, Drawer, Icon, Input, SelectionCheck, cx } from '@/ui/primitives'
import type { FocusKind, FocusRef } from '../appKnowledge'
import { FOCUS_ICONS, type FocusChip } from './knowledgeIcons'

export interface FocusCandidate extends FocusChip {
    /** Short secondary line (race, type, file name…). */
    detail?: string
}

export interface AssistantFocusPickerProps {
    open: boolean
    onClose: () => void
    candidates: readonly FocusCandidate[]
    selected: readonly FocusRef[]
    limit: number
    onApply: (refs: FocusRef[]) => void
}

const refKey = (ref: FocusRef) => `${ref.kind}:${ref.id}`
const VISIBLE_LIMIT = 60

export function AssistantFocusPicker({ open, onClose, candidates, selected, limit, onApply }: AssistantFocusPickerProps) {
    const { t } = useTranslation()
    const [query, setQuery] = useState('')
    const [kind, setKind] = useState<FocusKind | 'all'>('all')
    const [staged, setStaged] = useState<FocusRef[]>([...selected])
    const selectedRef = useRef(selected)
    useEffect(() => {
        selectedRef.current = selected
    }, [selected])

    // Each opening starts from the current shelf; later parent renders don't reset it.
    useEffect(() => {
        if (!open) return
        setStaged([...selectedRef.current])
        setQuery('')
        setKind('all')
    }, [open])

    const kinds = useMemo(() => {
        const present = new Set(candidates.map((candidate) => candidate.kind))
        return (Object.keys(FOCUS_ICONS) as FocusKind[]).filter((value) => present.has(value))
    }, [candidates])

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return candidates.filter((candidate) => (kind === 'all' || candidate.kind === kind)
            && (!needle || `${candidate.name} ${candidate.detail ?? ''}`.toLowerCase().includes(needle)))
    }, [candidates, kind, query])

    const stagedKeys = new Set(staged.map(refKey))
    const full = staged.length >= limit

    const toggle = (candidate: FocusCandidate) => {
        const key = refKey(candidate)
        setStaged((current) => current.some((ref) => refKey(ref) === key)
            ? current.filter((ref) => refKey(ref) !== key)
            : current.length >= limit ? current : [...current, { kind: candidate.kind, id: candidate.id }])
    }

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="md"
            eyebrow={t('appAssistant.focus.pickerEyebrow')}
            title={t('appAssistant.focus.pickerTitle')}
            icon={<Icon icon={Crosshair} size={18} />}
            footer={(
                <>
                    <span className="mr-auto font-mono text-caption text-parchment-400">{t('appAssistant.focus.selected', { count: staged.length, limit })}</span>
                    <Button variant="ghost" onClick={onClose}>{t('appAssistant.focus.cancel')}</Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            onApply(staged)
                            onClose()
                        }}
                    >
                        {t('appAssistant.focus.apply')}
                    </Button>
                </>
            )}
        >
            <div className="flex flex-col gap-4">
                <p className="font-ui text-label leading-relaxed text-parchment-300">{t('appAssistant.focus.pickerHint', { limit })}</p>
                <div className="relative">
                    <Icon icon={Search} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('appAssistant.focus.search')}
                        aria-label={t('appAssistant.focus.search')}
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('appAssistant.focus.filter')}>
                    <Chip active={kind === 'all'} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{t('appAssistant.focus.all')}</Chip>
                    {kinds.map((value) => (
                        <Chip
                            key={value}
                            active={kind === value}
                            aria-pressed={kind === value}
                            icon={<Icon icon={FOCUS_ICONS[value]} size={13} />}
                            onClick={() => setKind(value)}
                        >
                            {t(`appAssistant.focusKinds.${value}`)}
                        </Chip>
                    ))}
                </div>

                {!filtered.length ? (
                    <p className="py-6 text-center font-ui text-label text-parchment-400">{t('appAssistant.focus.noMatches')}</p>
                ) : (
                    <ul className="flex flex-col gap-1.5">
                        {filtered.slice(0, VISIBLE_LIMIT).map((candidate) => {
                            const isSelected = stagedKeys.has(refKey(candidate))
                            const blocked = !isSelected && full
                            return (
                                <li key={refKey(candidate)}>
                                    <button
                                        type="button"
                                        aria-pressed={isSelected}
                                        disabled={blocked}
                                        onClick={() => toggle(candidate)}
                                        className={cx(
                                            'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                            isSelected ? 'border-ember-500/60 bg-ember-500/10' : 'border-parchment-50/[.08] bg-ink-700 hover:border-parchment-50/20',
                                        )}
                                    >
                                        <Icon icon={FOCUS_ICONS[candidate.kind]} size={16} className="shrink-0 text-parchment-300" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-ui text-label font-semibold text-parchment-50">{candidate.name}</span>
                                            <span className="block truncate font-ui text-caption text-parchment-400">
                                                {[t(`appAssistant.focusKinds.${candidate.kind}`), candidate.detail].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                        <SelectionCheck selected={isSelected} />
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
                {filtered.length > VISIBLE_LIMIT && (
                    <p className="text-center font-ui text-caption text-parchment-400">{t('appAssistant.focus.refine', { count: filtered.length - VISIBLE_LIMIT })}</p>
                )}
            </div>
        </Drawer>
    )
}
