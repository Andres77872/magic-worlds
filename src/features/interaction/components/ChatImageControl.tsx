/**
 * The composer's scene image control: a toggle (images on or off for the next
 * turns of this chat) and, while on, a compact model chip whose popover picks
 * the image profile. App profiles cost credits; personal (BYOK) profiles run on
 * the player's own provider key, asked for when one is picked without a key.
 * The chip folds to its icon on narrow composers.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown, Images, Loader2, X } from 'lucide-react'
import type { ImageProfile } from '@/shared'
import { ImageKeyDialog } from '@/features/imageProfiles/ImageKeyDialog'
import { imageCredentialSession } from '@/features/imageProfiles/imageCredentialSession'
import { useHeldImageKeys } from '@/features/imageProfiles/useHeldImageKeys'
import { Button, Field, Icon, IconButton, Select, cx } from '@/ui/primitives'
import { useAnchoredPopup } from '@/ui/primitives/useAnchoredPopup'

export interface ChatImageControlProps {
    enabled: boolean
    /** The chosen profile; null runs on the default. A chosen id that is no longer offered reads as the default. */
    profileId: string | null
    /** The profiles chat images can run on (`chatPickableProfiles`). */
    profiles: readonly ImageProfile[]
    /** The profile a turn runs on when none is chosen. */
    defaultId: string | null
    loading?: boolean
    failed?: boolean
    disabled?: boolean
    onToggle: () => void
    onSelectProfile: (profileId: string | null) => void
    onRetry?: () => void
    /** Starts with the popover open (stories and visual review). */
    defaultOpen?: boolean
}

interface PendingKey {
    profile: ImageProfile
}

export function ChatImageControl({ enabled, profileId, profiles, defaultId, loading = false, failed = false, disabled = false,
    onToggle, onSelectProfile, onRetry, defaultOpen = false }: ChatImageControlProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(defaultOpen)
    const [pendingKey, setPendingKey] = useState<PendingKey | null>(null)
    const heldKeys = useHeldImageKeys()
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popupRef = useRef<HTMLDivElement>(null)
    const { position, clearPosition } = useAnchoredPopup(open, triggerRef as React.RefObject<HTMLElement>,
        popupRef as React.RefObject<HTMLElement>, `${loading}|${failed}|${profiles.length}|${profileId}|${heldKeys.join()}`, 300)
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

    const chosen = profileId ? profiles.find(profile => profile.profile_id === profileId) : undefined
    const defaultProfile = defaultId ? profiles.find(profile => profile.profile_id === defaultId) : undefined
    const active = chosen ?? defaultProfile
    const needsKey = chosen?.credential_mode === 'user_byok' && !heldKeys.includes(chosen.provider)
    const providerName = (profile: ImageProfile) => t(`imageProfiles.providers.${profile.provider}`)
    const price = (profile: ImageProfile) => profile.credential_mode === 'user_byok'
        ? t('chatImages.control.yourKey') : t('chatImages.control.credits', { count: profile.credit_cost })
    const title = t('chatImages.control.modelLabel')
    const chipLabel = chosen?.name ?? (defaultProfile ? t('chatImages.control.chipDefault', { name: defaultProfile.name }) : t('chatImages.control.chipDefaultPlain'))

    const choose = (value: string) => {
        if (!value) { onSelectProfile(null); return }
        const profile = profiles.find(item => item.profile_id === value)
        if (!profile) return
        // A personal profile runs on the player's key: ask for it first when none is held.
        if (profile.credential_mode === 'user_byok' && !imageCredentialSession.has(profile.provider)) {
            setPendingKey({ profile })
            return
        }
        onSelectProfile(profile.profile_id)
    }

    const submitKey = (key: string) => {
        if (!pendingKey) return
        imageCredentialSession.remember(pendingKey.profile.provider, key)
        onSelectProfile(pendingKey.profile.profile_id)
        setPendingKey(null)
    }

    const options = [
        { value: '', label: defaultProfile ? t('chatImages.control.useDefaultNamed', { name: defaultProfile.name }) : t('chatImages.control.useDefault') },
        ...profiles.map(profile => ({
            value: profile.profile_id,
            label: profile.name,
            textValue: profile.name,
            description: `${profile.model_display_name ?? profile.model_id} · ${price(profile)}`,
        })),
    ]

    return <>
        <IconButton
            label={t(enabled ? 'interaction.composer.generatedImagesOn' : 'interaction.composer.generatedImagesOff')}
            size="sm"
            tone={enabled ? 'active' : 'default'}
            aria-pressed={enabled}
            onClick={onToggle}
            disabled={disabled}
        >
            <Images size={17} strokeWidth={1.75} />
        </IconButton>
        {enabled && <button ref={triggerRef} type="button" onClick={() => (open ? close() : setOpen(true))} disabled={disabled}
            aria-expanded={open} aria-haspopup="dialog" aria-label={`${title}: ${chipLabel}`} title={title}
            className={cx('inline-flex h-8 min-w-0 max-w-[11rem] items-center gap-1.5 rounded-full border px-2 font-ui text-caption transition-colors sm:px-2.5',
                'disabled:opacity-50',
                needsKey || failed ? 'border-amber-500/40 text-amber-500 hover:bg-amber-500/10'
                    : 'border-parchment-50/[.13] text-parchment-300 hover:bg-parchment-50/[.04] hover:text-parchment-50')}>
            {loading && !active ? <Loader2 size={13} className="shrink-0 animate-spin" />
                : needsKey || failed ? <Icon icon={AlertTriangle} size={13} className="shrink-0" /> : null}
            <span className="hidden min-w-0 truncate sm:inline">{chipLabel}</span>
            <Icon icon={ChevronDown} size={13} className={cx('shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
        </button>}
        {enabled && open && typeof document !== 'undefined' && createPortal(
            <div ref={popupRef} role="dialog" aria-label={title} aria-busy={loading}
                style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999, width: position?.width }}
                className="z-[100] flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-md border border-parchment-50/10 bg-ink-800 p-3 shadow-lg">
                <div className="flex items-center justify-between gap-2">
                    <p className="font-ui text-label font-semibold text-parchment-50">{title}</p>
                    <IconButton label={t('chatImages.control.close')} size="sm" onClick={() => { close(); triggerRef.current?.focus() }}>
                        <X size={15} />
                    </IconButton>
                </div>
                {loading && <p role="status" className="text-caption text-parchment-400">{t('chatImages.control.loading')}</p>}
                {failed && <div role="alert" className="flex items-center justify-between gap-2">
                    <p className="text-caption text-parchment-300">{t('chatImages.control.loadFailed')}</p>
                    {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>{t('chatImages.control.retry')}</Button>}
                </div>}
                {!loading && !failed && profiles.length === 0 && <p className="text-caption text-parchment-400">{t('chatImages.control.none')}</p>}
                {profiles.length > 0 && <Field label={t('chatImages.control.chooseLabel')} helper={t('chatImages.control.sessionNote')}>
                    <Select size="sm" value={chosen?.profile_id ?? ''} options={options} disabled={disabled} onChange={choose} />
                </Field>}
                {active && <p className="text-caption text-parchment-400">
                    {`${active.model_display_name ?? active.model_id} · ${price(active)}`}
                </p>}
                {chosen?.credential_mode === 'user_byok' && <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-caption text-parchment-300">
                        {t(needsKey ? 'chatImages.control.keyNeeded' : 'chatImages.control.keyHeld', { provider: providerName(chosen) })}
                    </p>
                    {needsKey
                        ? <Button variant="secondary" size="sm" onClick={() => setPendingKey({ profile: chosen })}>{t('chatImages.control.addKey')}</Button>
                        : <Button variant="ghost" size="sm" onClick={() => imageCredentialSession.forget(chosen.provider)}>{t('chatImages.control.forgetKey')}</Button>}
                </div>}
            </div>,
            document.body,
        )}
        <ImageKeyDialog provider={pendingKey?.profile.provider ?? null} onSubmit={submitKey} onCancel={() => setPendingKey(null)} />
    </>
}
