import { useId } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { AttestationKind } from '@/shared/types/attestation.types'
import { cx } from '@/ui/primitives'
import type { AttestationChecked } from './attestationStatus'

interface AttestationChecksProps {
    /** The boxes to show, in order. */
    kinds: readonly AttestationKind[]
    checked: AttestationChecked
    onChange: (kind: AttestationKind, checked: boolean) => void
    disabled?: boolean
    /** Marks the unticked boxes invalid (after a submit attempt). */
    invalid?: boolean
    /** Id of an error or hint the group should announce. */
    describedBy?: string
    /** The Terms of Service version being accepted, shown under its box (R2-FE-01). */
    termsVersion?: string | null
    className?: string
}

/**
 * The 18+ and Terms of Service checkboxes (13 §3.2): separate, unticked native
 * checkboxes, used by the sign-up form and the attestation prompt. The terms
 * label links to the Terms page in a new tab, so the form keeps its state; the
 * page shows the same version this box names (`termsVersion`).
 */
export function AttestationChecks({ kinds, checked, onChange, disabled = false, invalid = false, describedBy, termsVersion, className }: AttestationChecksProps) {
    const { t } = useTranslation()
    const id = useId()
    return (
        <fieldset className={cx('m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0', className)} aria-describedby={describedBy}>
            <legend className="sr-only">{t('attestation.groupLabel')}</legend>
            {kinds.map((kind) => {
                const inputId = `${id}-${kind}`
                const value = checked[kind] === true
                const versionId = kind === 'terms_of_service' && termsVersion ? `${inputId}-version` : undefined
                return (
                    <div key={kind} className="flex items-start gap-2.5">
                        <input
                            id={inputId}
                            type="checkbox"
                            checked={value}
                            disabled={disabled}
                            aria-required="true"
                            aria-invalid={invalid && !value ? true : undefined}
                            aria-describedby={versionId}
                            onChange={(event) => onChange(kind, event.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-ember-500 disabled:cursor-not-allowed"
                        />
                        <div className="flex min-w-0 flex-col">
                            <label
                                htmlFor={inputId}
                                className={cx('font-ui text-sm text-parchment-100', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
                            >
                                {kind === 'age_18_plus' ? (
                                    t('attestation.age')
                                ) : (
                                    <Trans
                                        t={t}
                                        i18nKey="attestation.terms"
                                        components={[
                                            <a
                                                key="terms"
                                                href="#/terms"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-semibold text-ember-400 underline-offset-2 transition-colors hover:text-ember-300 hover:underline"
                                            />,
                                        ]}
                                    />
                                )}
                            </label>
                            {versionId && (
                                <span id={versionId} className="mt-0.5 block font-ui text-caption text-fg-subtle" data-testid="attestation-terms-version">
                                    {t('attestation.termsVersion', { version: termsVersion })}
                                </span>
                            )}
                        </div>
                    </div>
                )
            })}
        </fieldset>
    )
}
