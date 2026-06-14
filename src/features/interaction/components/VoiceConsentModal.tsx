import { useTranslation } from 'react-i18next'
import { Bot, Mic, ShieldCheck, Waves } from 'lucide-react'
import { Badge, Button, Icon, Modal } from '@/ui/primitives'

export interface VoiceConsentModalProps {
    open: boolean
    staleConsent?: boolean
    isAccepting?: boolean
    onAccept: () => void | Promise<void>
    onDecline: () => void
}

const DISCLOSURE_KEYS = [
    'interaction.voiceConsent.disclosures.aiInteraction',
    'interaction.voiceConsent.disclosures.micAccess',
    'interaction.voiceConsent.disclosures.processing',
    'interaction.voiceConsent.disclosures.transcripts',
    'interaction.voiceConsent.disclosures.noRecordings',
    'interaction.voiceConsent.disclosures.endAnytime',
] as const

export function VoiceConsentModal({ open, staleConsent = false, isAccepting = false, onAccept, onDecline }: VoiceConsentModalProps) {
    const { t } = useTranslation()
    return (
        <Modal
            open={open}
            onClose={onDecline}
            title={staleConsent ? t('interaction.voiceConsent.titleReview') : t('interaction.voiceConsent.titleStart')}
            icon={<Icon icon={Mic} size={22} className="text-ember-400" />}
            size="lg"
            footer={
                <>
                    <Button kind="ghost" onClick={onDecline} disabled={isAccepting}>
                        {t('interaction.voiceConsent.notNow')}
                    </Button>
                    <Button
                        kind="primary"
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
                    <Badge tone="neutral">{t('interaction.voiceConsent.badgeTranscriptOnly')}</Badge>
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

                <ul className="space-y-3">
                    {DISCLOSURE_KEYS.map((key) => (
                        <li key={key} className="flex gap-3">
                            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember-500" />
                            <span>{t(key)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    )
}
