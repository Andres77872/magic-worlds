import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown, Loader2, Sparkles, X } from 'lucide-react'
import type { LlmFeature, LlmSelection } from '@/shared/types/llm.types'
import type { EffectiveLlmProfile, LlmProfileSummary, LlmRole } from '@/shared/types/llmProfile.types'
import { Badge, Button, Field, Icon, IconButton, Select } from '@/ui/primitives'
import { cx } from '@/ui/primitives/cx'
import { useAnchoredPopup } from '@/ui/primitives/useAnchoredPopup'

export interface LlmFeatureChoice {
    profile: LlmProfileSummary
    compatible: boolean
}

export interface LlmFeatureControlViewProps {
    feature: LlmFeature
    selection: LlmSelection
    effective: EffectiveLlmProfile | null
    editable: boolean
    loading?: boolean
    disabled?: boolean
    error?: string
    choicesOpen?: boolean
    choices?: LlmFeatureChoice[]
    more?: boolean
    keyAvailable?: boolean
    /** Nothing resolves for this feature yet (no app default, or the default cannot serve it). */
    unassigned?: boolean
    /** Root can assign the app default in place; everyone else waits for it. */
    canAssign?: boolean
    onAssign?: (profileId: string) => void
    /** Starts in the open state (stories and visual review). */
    defaultOpen?: boolean
    onOpen: () => void
    onSelect: (selection: LlmSelection) => void
    onMore: () => void
    onRefresh: () => void
    onForget: () => void
}

/** `vendor/model-name` → `model-name`: the chip names the response model, the popover has the rest. */
function shortModel(id: string) {
    return id.slice(id.lastIndexOf('/') + 1) || id
}

/**
 * A compact model chip (it fits a composer toolbar); details, profile choice and
 * problems open in an anchored popover. Public profile facts only: ember selects
 * the player's choice, arcane marks model roles.
 */
export function LlmFeatureControlView({ feature, selection, effective, editable, loading = false, disabled = false,
    error, choicesOpen, choices = [], more, keyAvailable, unassigned = false, canAssign = false, onAssign, defaultOpen = false,
    onOpen, onSelect, onMore, onRefresh, onForget }: LlmFeatureControlViewProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(defaultOpen)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popupRef = useRef<HTMLDivElement>(null)
    const { position, clearPosition } = useAnchoredPopup(open, triggerRef as React.RefObject<HTMLElement>,
        popupRef as React.RefObject<HTMLElement>, `${loading}|${error}|${unassigned}|${choicesOpen}|${choices.length}|${effective?.profile_id}`, 320)
    const close = useCallback(() => { setOpen(false); clearPosition() }, [clearPosition])

    useEffect(() => {
        if (!open) return
        const onPointer = (event: PointerEvent) => {
            const target = event.target as Element | null
            // The profile Select renders its list in its own portal; it belongs to this popover.
            if (!target || popupRef.current?.contains(target) || triggerRef.current?.contains(target) || target.closest?.('[role="listbox"]')) return
            close()
        }
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { close(); triggerRef.current?.focus() } }
        document.addEventListener('pointerdown', onPointer, true)
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('pointerdown', onPointer, true); document.removeEventListener('keydown', onKey) }
    }, [open, close])

    const toggle = () => { if (open) close(); else setOpen(true) }

    const featureName = t(`llmProfiles.features.${feature}`)
    const title = t('llmProfiles.feature.label', { feature: featureName })
    const selected = selection.mode === 'profile' ? selection.profile_id : ''
    const name = choices.find(choice => choice.profile.profile_id === effective?.profile_id)?.profile.name
    const options = [
        { value: '', label: t('llmProfiles.feature.inherit') },
        ...choices.map(({ profile, compatible }) => ({ value: profile.profile_id,
            label: `${profile.name} · ${t(`llmProfiles.scope.${profile.scope}`)}`,
            description: compatible ? undefined : t('llmProfiles.feature.incompatible'), disabled: !compatible })),
    ]
    // A selected profile may be on a later page. Keep its label until that page is loaded.
    if (selected && !options.some(option => option.value === selected)) {
        options.push({ value: selected, label: name ?? t('llmProfiles.feature.selected'), disabled: false, description: undefined })
    }
    const roles: LlmRole[] = ['primary', 'metadata', 'preflight']
    const busy = disabled || loading
    const problem = !!error || unassigned
    const chipLabel = effective ? (name ?? shortModel(effective.roles.primary.provider_model_id))
        : unassigned ? t('llmProfiles.feature.chipUnassigned')
            : error ? t('llmProfiles.feature.chipError') : t('llmProfiles.loading')

    return <>
        <button ref={triggerRef} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
            aria-label={`${title}: ${chipLabel}`} title={title}
            className={cx('inline-flex h-8 max-w-[14rem] min-w-0 items-center gap-1.5 rounded-full border px-2.5 font-ui text-caption transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400/60',
                problem ? 'border-blood-500/40 text-blood-300 hover:bg-blood-500/10'
                    : 'border-arcane-400/25 text-arcane-200 hover:bg-arcane-500/10')}>
            {loading && !effective ? <Loader2 size={13} className="shrink-0 animate-spin" />
                : <Icon icon={problem ? AlertTriangle : Sparkles} size={13} className="shrink-0" />}
            <span className="min-w-0 truncate">{chipLabel}</span>
            <Icon icon={ChevronDown} size={13} className={cx('shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
        </button>
        {open && typeof document !== 'undefined' && createPortal(
            <div ref={popupRef} role="dialog" aria-label={title} aria-busy={loading}
                style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999, width: position?.width }}
                className="z-[100] flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-md border border-line bg-ink-800 p-3 shadow-lg">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-label font-semibold text-fg">{title}</p>
                    {editable && !unassigned && <Button variant="ghost" size="sm" className="ml-auto" disabled={busy} onClick={onOpen}>
                        {t(choicesOpen ? 'llmProfiles.close' : 'llmProfiles.feature.change')}
                    </Button>}
                    <IconButton label={t('llmProfiles.close')} size="sm" onClick={() => { close(); triggerRef.current?.focus() }}>
                        <X size={15} />
                    </IconButton>
                </div>
                {loading && <p role="status" className="text-caption text-fg-muted">{t('llmProfiles.loading')}</p>}
                {error && <div role="alert" className="flex items-center justify-between gap-2">
                    <p className="text-caption text-blood-500">{error}</p>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={onRefresh}>{t('llmProfiles.refresh')}</Button>
                </div>}
                {unassigned && <div className="flex flex-col gap-2">
                    <p className="text-caption text-fg">{t('llmProfiles.feature.unassigned', { feature: featureName })}</p>
                    <p className="text-caption text-fg-muted">{t(canAssign ? 'llmProfiles.feature.assignApp' : 'llmProfiles.feature.waitingAdmin')}</p>
                    {canAssign && choicesOpen && !loading && choices.length === 0 && <p className="text-caption text-fg-muted">{t('llmProfiles.feature.noChoices')}</p>}
                    {canAssign && choicesOpen && choices.length > 0 && <ul className="flex flex-col gap-2">
                        {choices.map(({ profile, compatible }) => <li key={profile.profile_id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-2">
                            <span className="flex min-w-0 flex-col">
                                <span className="text-label text-fg">{profile.name}</span>
                                {!compatible && <span className="text-caption text-fg-muted">{t('llmProfiles.feature.incompatible')}</span>}
                            </span>
                            <Button variant="secondary" size="sm" disabled={busy || !compatible} onClick={() => onAssign?.(profile.profile_id)}>
                                {t('llmProfiles.feature.assign')}
                            </Button>
                        </li>)}
                    </ul>}
                    {canAssign && choicesOpen && more && <Button variant="ghost" size="sm" disabled={busy} onClick={onMore}>{t('llmProfiles.feature.more')}</Button>}
                </div>}
                {effective && <>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="arcane">{name ?? t(`llmProfiles.scope.${effective.profile_scope}`)}</Badge>
                        <span className="text-caption text-fg-muted">{t(`llmProfiles.feature.sources.${effective.resolution_source}`)}</span>
                    </div>
                    <dl className="grid gap-2 text-caption">
                        {roles.map(role => effective.roles[role] && <div key={role} className="flex flex-wrap justify-between gap-2">
                            <dt className="text-fg-muted">{t(`llmProfiles.roles.${role}`)}</dt>
                            <dd className="break-all text-fg">{effective.roles[role]!.provider_model_id}</dd>
                        </div>)}
                    </dl>
                    <p className="text-caption text-fg-muted">{t(effective.credential_mode === 'user_byok' ? 'llmProfiles.byokCost' : 'llmProfiles.platformCost')}</p>
                    {effective.credential_mode === 'user_byok' && <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-caption text-fg-muted">{t(keyAvailable ? 'llmProfiles.feature.keyAvailable' : 'llmProfiles.feature.keyRequired')}</p>
                        {keyAvailable && <Button variant="ghost" size="sm" disabled={busy} onClick={onForget}>{t('llmProfiles.feature.forget')}</Button>}
                    </div>}
                    {!editable && <p className="text-caption text-fg-muted">{t('llmProfiles.mediaScope')}</p>}
                </>}
                {editable && !unassigned && choicesOpen && <>
                    <Field label={t('llmProfiles.feature.choose')} helper={t('llmProfiles.feature.sessionOnly')}>
                        <Select size="sm" value={selected} options={options} disabled={busy}
                            onChange={id => onSelect(id ? { mode: 'profile', profile_id: id } : { mode: 'inherit' })} />
                    </Field>
                    {more && <Button variant="ghost" size="sm" disabled={busy} onClick={onMore}>{t('llmProfiles.feature.more')}</Button>}
                </>}
            </div>,
            document.body,
        )}
    </>
}
