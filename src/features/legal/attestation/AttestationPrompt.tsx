import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import type { AttestationKind } from '@/shared/types/attestation.types'
import { Button, Callout, Icon, Modal } from '@/ui/primitives'
import { termsDocumentFor } from '../documents/termsDocuments'
import { AttestationChecks } from './AttestationChecks'
import { allAttestationsChecked, type AttestationChecked } from './attestationStatus'

/** `login`: an account missing an attestation (blocking; the way out is signing out). `voice`: a voice action was refused for it. */
export type AttestationPromptMode = 'login' | 'voice'

export interface AttestationPromptProps {
    mode: AttestationPromptMode
    /** The boxes to ask for (the missing kinds, or both). */
    kinds: readonly AttestationKind[]
    /**
     * The Terms of Service version being accepted (R2-FE-01), shown under its
     * box. A version the SPA does not ship (`termsDocumentFor` is null) cannot
     * be confirmed: the prompt says the terms are being published instead.
     */
    termsVersion?: string | null
    /** Why the prompt is asking again (e.g. the Terms version changed). */
    notice?: string | null
    submitting?: boolean
    error?: string | null
    /** Every shown box is ticked. */
    onConfirm: (accepted: AttestationKind[]) => void
    /** `voice`: not now; `login`: sign out. */
    onDecline: () => void
}

/**
 * The blocking attestation prompt (D26, 09 §4.7): a non-dismissible modal with
 * the 18+ and Terms of Service boxes. Mount it only while it is open, so every
 * opening starts with unticked boxes.
 */
export function AttestationPrompt({ mode, kinds, termsVersion = null, notice = null, submitting = false, error = null, onConfirm, onDecline }: AttestationPromptProps) {
    const { t } = useTranslation()
    const errorId = useId()
    const [checked, setChecked] = useState<AttestationChecked>({})
    const asksTerms = kinds.includes('terms_of_service')
    // Never accept terms the SPA has not displayed (the server bumped first).
    const termsUnavailable = asksTerms && termsVersion !== null && termsDocumentFor(termsVersion) === null
    const complete = allAttestationsChecked(kinds, checked) && !termsUnavailable
    const blocking = mode === 'login'

    return (
        <Modal
            open
            // Login mode has no dismiss: the account must attest or sign out.
            onClose={blocking || submitting ? () => {} : onDecline}
            title={t('attestation.title')}
            icon={<Icon icon={ShieldCheck} size={20} className="text-ember-400" />}
            showClose={false}
            initialFocus="panel"
            footer={
                <>
                    <Button
                        variant="ghost"
                        onClick={onDecline}
                        disabled={submitting}
                        iconLeft={blocking ? <LogOut size={16} strokeWidth={1.75} /> : undefined}
                    >
                        {blocking ? t('attestation.signOut') : t('attestation.notNow')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => onConfirm(kinds.filter((kind) => checked[kind] === true))}
                        disabled={!complete || submitting}
                        iconLeft={submitting
                            ? <Loader2 size={16} className="animate-spin" />
                            : <CheckCircle2 size={16} strokeWidth={1.75} />}
                    >
                        {submitting ? t('attestation.submitting') : t('attestation.submit')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="m-0 text-body leading-relaxed text-parchment-200">
                    {blocking ? t('attestation.body') : t('attestation.required')}
                </p>
                {notice && !termsUnavailable && (
                    <Callout tone="info" role="status">{notice}</Callout>
                )}
                <AttestationChecks
                    kinds={kinds}
                    checked={checked}
                    onChange={(kind, value) => setChecked((current) => ({ ...current, [kind]: value }))}
                    disabled={submitting}
                    describedBy={error ? errorId : undefined}
                    termsVersion={termsUnavailable ? null : termsVersion}
                />
                {termsUnavailable && (
                    <Callout tone="warning" role="status" data-testid="attestation-terms-unavailable">
                        {t('attestation.termsUnavailable')}
                    </Callout>
                )}
                {error && (
                    <Callout tone="danger" role="alert" id={errorId}>{error}</Callout>
                )}
            </div>
        </Modal>
    )
}
