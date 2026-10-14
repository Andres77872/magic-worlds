export { LegalPage } from './components/LegalPage'
export { CONTACT_EMAIL, getLegalPageLinks, getLegalPages, type LegalPageId, type LegalPageOptions } from './components/legalContent'
export { ReportMinorForm, ReportMinorFormView, type ReportMinorFormViewProps } from './components/ReportMinorForm'
export { useMinorReportStatus, type MinorReportStatusState } from './hooks/useMinorReportStatus'
export {
    CONSENT_COPY,
    CURRENT_CONSENT_VERSION,
    LEGAL_PENDING,
    PRIVACY_VOICE_VARIANT,
    TERMS_DOCUMENTS,
    consentCopyFor,
    containsLegalPending,
    shippable,
    termsDocumentFor,
    type ConsentVersion,
    type LegalDraft,
} from './documents'
