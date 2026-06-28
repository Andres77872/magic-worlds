/**
 * Cookie-consent banner + preferences dialog.
 *
 * Magic Worlds uses only first-party storage and one strictly-necessary auth
 * cookie — no third-party or tracking cookies. The banner shows until the user
 * makes a choice (persisted in localStorage via the CookieConsentProvider).
 * "Essential" storage is always on; the optional "Analytics" category is
 * reserved for the future and controls nothing today, so declining never
 * breaks a current feature.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Cookie } from 'lucide-react'
import { useNavigation } from '@/app/hooks/useNavigation'
import { useCookieConsent } from '@/app/hooks/useCookieConsent'
import { Button, Icon, Modal, SwitchRow } from '../primitives'

export function CookieConsentBanner() {
    const {
        consent,
        isBannerVisible,
        isPreferencesOpen,
        acceptAll,
        acceptEssential,
        savePreferences,
        openPreferences,
        closePreferences,
    } = useCookieConsent()

    if (!isBannerVisible && !isPreferencesOpen) return null

    return (
        <>
            {isBannerVisible && (
                <CookieBanner onAcceptAll={acceptAll} onAcceptEssential={acceptEssential} onCustomize={openPreferences} />
            )}
            <CookiePreferencesModal
                open={isPreferencesOpen}
                initialAnalytics={consent?.categories.analytics ?? false}
                onClose={closePreferences}
                onSave={savePreferences}
            />
        </>
    )
}

interface CookieBannerProps {
    onAcceptAll: () => void
    onAcceptEssential: () => void
    onCustomize: () => void
}

function CookieBanner({ onAcceptAll, onAcceptEssential, onCustomize }: CookieBannerProps) {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    return (
        // z-[40]: above page content + the playlist dock (z-[45] is bottom-right
        // only), below modals (z-50) so a preferences dialog covers it cleanly.
        <div role="region" aria-label={t('cookieConsent.title')} className="fixed inset-x-0 bottom-0 z-[40] px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="mx-auto flex max-w-[940px] flex-col gap-4 rounded-2xl border border-parchment-50/10 bg-ink-700/95 p-5 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:gap-5">
                <span
                    aria-hidden
                    className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ember-500/15 text-ember-400 sm:inline-flex"
                >
                    <Icon icon={Cookie} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="font-display text-[18px] font-semibold text-parchment-50">{t('cookieConsent.title')}</h2>
                    <p className="mt-1 font-ui text-label leading-relaxed text-parchment-300">
                        {t('cookieConsent.body')}{' '}
                        <button
                            type="button"
                            onClick={() => setPage('privacy')}
                            className="rounded-sm font-semibold text-ember-400 underline-offset-2 transition-colors hover:text-ember-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                        >
                            {t('cookieConsent.viewPolicy')}
                        </button>
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onCustomize}>
                        {t('cookieConsent.customize')}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={onAcceptEssential}>
                        {t('cookieConsent.essentialOnly')}
                    </Button>
                    <Button variant="primary" size="sm" onClick={onAcceptAll} iconLeft={<Check size={15} strokeWidth={2} />}>
                        {t('cookieConsent.acceptAll')}
                    </Button>
                </div>
            </div>
        </div>
    )
}

interface CookiePreferencesModalProps {
    open: boolean
    initialAnalytics: boolean
    onClose: () => void
    onSave: (categories: { essential: true; analytics: boolean }) => void
}

function CookiePreferencesModal({ open, initialAnalytics, onClose, onSave }: CookiePreferencesModalProps) {
    const { t } = useTranslation()
    const [analytics, setAnalytics] = useState(initialAnalytics)

    // Discard any unsaved toggle when the dialog is dismissed so reopening it
    // reflects the stored choice again (no setState-in-effect needed).
    const handleClose = () => {
        setAnalytics(initialAnalytics)
        onClose()
    }

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title={t('cookieConsent.preferences.title')}
            icon={<Icon icon={Cookie} size={20} className="text-ember-400" />}
            size="md"
            footer={
                <>
                    <Button variant="ghost" onClick={handleClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={() => onSave({ essential: true, analytics })}>
                        {t('cookieConsent.save')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="font-ui text-sm leading-relaxed text-parchment-300">{t('cookieConsent.preferences.intro')}</p>
                <SwitchRow
                    label={t('cookieConsent.essential.title')}
                    description={t('cookieConsent.essential.desc')}
                    checked
                    disabled
                    onChange={() => {}}
                />
                <div>
                    <SwitchRow
                        label={t('cookieConsent.analytics.title')}
                        description={t('cookieConsent.analytics.desc')}
                        checked={analytics}
                        onChange={setAnalytics}
                    />
                    <p className="mt-2 px-1 font-ui text-xs leading-snug text-parchment-400">
                        {t('cookieConsent.analytics.none')}
                    </p>
                </div>
            </div>
        </Modal>
    )
}
