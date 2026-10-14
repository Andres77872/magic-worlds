export {
    LEGAL_PENDING,
    containsLegalPending,
    isShippable,
    legalLanguage,
    shippable,
    type LegalDocStatus,
    type LegalDraft,
    type LegalLanguage,
} from './legalPending'
export {
    CONSENT_COPY,
    CURRENT_CONSENT_VERSION,
    IN_APP_COPY_DRAFTS,
    IN_APP_COPY_SWITCHES,
    consentCopyFor,
    inAppCopyOverlay,
    installInAppCopyRelease,
    isInAppCopyReleased,
    releasedInAppCopy,
    type ConsentCopy,
    type ConsentVersion,
    type InAppCopyDraft,
    type InAppCopyDraftId,
    type InAppCopySwitches,
} from './consentCopy'
export {
    LATEST_TERMS_VERSION,
    TERMS_DOCUMENTS,
    TERMS_VERSION_PATTERN,
    displayedTermsDocument,
    latestTermsDocument,
    termsDocumentFor,
    type TermsDocument,
    type TermsSection,
} from './termsDocuments'
export {
    PRIVACY_VOICE_LOCALE_KEYS,
    PRIVACY_VOICE_VARIANT,
    PRIVACY_VOICE_VARIANTS,
    privacyVoiceCopy,
    type PrivacyVoiceCopy,
    type PrivacyVoiceVariantId,
} from './privacyVoiceCopy'
