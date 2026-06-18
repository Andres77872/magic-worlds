/**
 * Language switcher — a lightweight popover menu anchored to the sidebar's
 * language button (replaces the old full Modal, which was excessive for a short
 * list of locales). Mirrors ApiStatusMonitor: anchored (not portaled, so it
 * keeps simple outside-click + Escape dismissal) and rises in with the app's
 * overlay motion. Selecting a locale switches immediately and closes.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Globe, Loader2 } from 'lucide-react'
import { useAuth, useLanguage } from '../../app/hooks'
import { SUPPORTED_LANGUAGE_OPTIONS } from '../../app/i18n'
import { Eyebrow, Icon, Tooltip, cx } from '../primitives'

// Matches the Drawer/ApiStatusMonitor transition so the menu shares the app idiom.
const MENU_TRANSITION_MS = 200

interface LanguageMenuProps {
    collapsed?: boolean
    /** Start with the menu open (stories / tests). */
    defaultOpen?: boolean
}

export function LanguageMenu({ collapsed = false, defaultOpen = false }: LanguageMenuProps) {
    const { t } = useTranslation()
    const { isAuthenticated } = useAuth()
    const { language, option, isSyncing, syncError, setLanguage } = useLanguage()
    const triggerLabel = t('language.button', { language: option.nativeLabel })
    const [open, setOpen] = useState(defaultOpen)
    // Drawer-style mount/enter: keep mounted through the exit transition, then drop.
    const [mounted, setMounted] = useState(defaultOpen)
    const [entered, setEntered] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Dismiss on outside pointer-down or Escape (anchored popover, not a modal).
    useEffect(() => {
        if (!open) return
        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('pointerdown', handlePointerDown)
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [open])

    // Rise/scale entrance + exit, mirroring the Drawer mounted/entered rAF idiom.
    useEffect(() => {
        if (open) {
            setMounted(true)
            const id = requestAnimationFrame(() => setEntered(true))
            return () => cancelAnimationFrame(id)
        }
        setEntered(false)
        const timer = window.setTimeout(() => setMounted(false), MENU_TRANSITION_MS)
        return () => window.clearTimeout(timer)
    }, [open])

    // Move focus to the active locale when the menu opens (keyboard affordance).
    useEffect(() => {
        if (!open) return
        const menu = menuRef.current
        const target =
            menu?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]') ??
            menu?.querySelector<HTMLElement>('[role="menuitemradio"]')
        target?.focus()
    }, [open])

    const handleSelect = (code: (typeof SUPPORTED_LANGUAGE_OPTIONS)[number]['code']) => {
        if (code !== language) void setLanguage(code)
        setOpen(false)
    }

    return (
        <div ref={containerRef} className="relative w-full">
            <Tooltip label={triggerLabel} disabled={!collapsed} wrapperClassName="w-full">
                <button
                    type="button"
                    aria-label={triggerLabel}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    title={triggerLabel}
                    onClick={() => setOpen((current) => !current)}
                    className={cx(
                        'inline-flex h-10 w-10 shrink-0 items-center justify-center gap-3 rounded-md px-0 font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 lg:w-full lg:justify-start lg:px-3',
                        collapsed && 'lg:w-10 lg:justify-center lg:px-0',
                        open
                            ? 'bg-ember-500/15 text-ember-400'
                            : 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                    )}
                >
                    <Icon icon={Globe} size={18} />
                    <span className={cx('hidden min-w-0 truncate', !collapsed && 'lg:inline')}>{triggerLabel}</span>
                </button>
            </Tooltip>
            {mounted && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={t('language.title')}
                    className={cx(
                        'absolute bottom-0 left-full z-50 ml-3 w-[min(15rem,calc(100vw-5rem))] origin-bottom-left overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 text-left shadow-lg transition-[opacity,transform] duration-200 ease-out',
                        entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-[.98] opacity-0',
                    )}
                >
                    <div className="border-b border-parchment-50/10 px-3 pb-2 pt-2.5">
                        <Eyebrow tone="muted">{t('language.title')}</Eyebrow>
                    </div>
                    <div className="p-1.5">
                        {SUPPORTED_LANGUAGE_OPTIONS.map((opt) => {
                            const active = opt.code === language
                            return (
                                <button
                                    key={opt.code}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={active}
                                    onClick={() => handleSelect(opt.code)}
                                    className={cx(
                                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                                        active ? 'bg-ember-500/10' : 'hover:bg-parchment-50/[.05]',
                                    )}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className={cx(
                                                'block truncate font-ui text-sm font-semibold',
                                                active ? 'text-ember-300' : 'text-parchment-50',
                                            )}
                                        >
                                            {opt.nativeLabel}
                                        </span>
                                        <span className="block truncate font-ui text-meta text-parchment-400">
                                            {t(`language.options.${opt.code}.description`)}
                                        </span>
                                    </span>
                                    {active && <Icon icon={Check} size={16} className="shrink-0 text-ember-400" />}
                                </button>
                            )
                        })}
                    </div>
                    <div className="flex items-center gap-2 border-t border-parchment-50/10 px-3 py-2 font-ui text-meta text-parchment-400">
                        {isSyncing ? (
                            <>
                                <Loader2 size={13} className="animate-spin text-parchment-300" />
                                <span>{t('common.saving')}</span>
                            </>
                        ) : syncError ? (
                            <span className="text-blood-300">{t(syncError)}</span>
                        ) : (
                            <span>{isAuthenticated ? t('language.fieldHelperSignedIn') : t('language.fieldHelperLocal')}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
