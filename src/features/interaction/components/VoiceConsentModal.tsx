import { useTranslation } from 'react-i18next'
import { Bot, Mic, ShieldCheck, Waves } from 'lucide-react'
import { IN_APP_COPY_DRAFTS, consentCopyFor, legalLanguage, releasedInAppCopy } from '@/features/legal/documents'
import { Badge, Button, Icon, Modal } from '@/ui/primitives'

export interface VoiceConsentModalProps {
    open: boolean
    staleConsent?: boolean
    isAccepting?: boolean
    onAccept: () => void | Promise<void>
    onDecline: () => void
}

/**
 * The disclosures, in order (`interaction.voiceConsent.disclosures.*`). `processing`
 * is not a locale key: it is the consent copy of the version the BFF requires and
 * records (`voice-v2` for everyone, I-68), from the legal registry.
 */
const DISCLOSURES = ['aiInteraction', 'micAccess', 'processing', 'transcripts', 'noRecordings', 'endAnytime'] as const

export function VoiceConsentModal({ open, staleConsent = false, isAccepting = false, onAccept, onDecline }: VoiceConsentModalProps) {
    const { t, i18n } = useTranslation()
    const copy = consentCopyFor()
    const language = legalLanguage(i18n.language)
    // R2-FE-01 (13 §5.8 "With voice-v2"): the scoped retention line, once its draft is final (voice-v2 is, I-71).
    const noRecordings = releasedInAppCopy('consentNoRecordings', language)
    const disclosure = (id: (typeof DISCLOSURES)[number]) => {
        if (id === 'processing') return copy[language].processing
        const key = `interaction.voiceConsent.disclosures.${id}`
        if (noRecordings && key === IN_APP_COPY_DRAFTS.consentNoRecordings.id) return noRecordings
        return t(key)
    }
    return (
        <Modal
            open={open}
            onClose={onDecline}
            title={staleConsent ? t('interaction.voiceConsent.titleReview') : t('interaction.voiceConsent.titleStart')}
            icon={<Icon icon={Mic} size={22} className="text-ember-400" />}
            size="lg"
            footer={
                <>
                    <Button variant="ghost" onClick={onDecline} disabled={isAccepting}>
                        {t('interaction.voiceConsent.notNow')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => void onAccept()}
                        disabled={isAccepting}
                        iconLeft={<Icon icon={ShieldCheck} size={16} />}
                    >
                        {isAccepting ? t('interaction.voiceConsent.starting') : t('interaction.voiceConsent.consentStart')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5 text-body text-parchment-200">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="ember" icon={<Icon icon={Waves} size={12} />}>{t('interaction.voiceConsent.badgeMicrophone')}</Badge>
                    <Badge tone="arcane" icon={<Icon icon={Bot} size={12} />}>{t('interaction.voiceConsent.badgeAiVoice')}</Badge>
                    {/* What is kept, as the voice-v2 copy and the Privacy page say: never a "transcript only" claim. */}
                    <Badge tone="neutral">{t('interaction.voiceConsent.badgeSavedWithChat')}</Badge>
                    {staleConsent && <Badge tone="danger">{t('interaction.voiceConsent.badgeUpdateRequired')}</Badge>}
                </div>

                {staleConsent && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
                        {t('interaction.voiceConsent.staleNotice')}
                    </p>
                )}

                <p className="font-narrative text-narrative text-parchment-100">
                    {t('interaction.voiceConsent.intro')}
                </p>

                {copy.status === 'draft' && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500" data-testid="voice-consent-draft">
                        {t('legal.pages.terms.draftNotice.title')}
                    </p>
                )}

                <ul className="space-y-3">
                    {DISCLOSURES.map((id) => (
                        <li key={id} className="flex gap-3">
                            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember-500" />
                            <span>{disclosure(id)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    )
}
