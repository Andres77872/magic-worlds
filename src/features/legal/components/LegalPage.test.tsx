import type { ContextType, ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { i18n } from '@/app/i18n'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ensureSafetyLocales } from '@/features/safety/test/ensureSafetyLocales'
import { AttestationContext, type AttestationContextValue } from '../attestation/attestationContext'
import { LegalPage } from './LegalPage'
import type { LegalPageId } from './legalContent'

const setPage = vi.fn()

const api = vi.hoisted(() => ({
    getMinorReportStatus: vi.fn(),
    submitMinorReport: vi.fn(),
}))

/** When set, the wired privacy variant is refused at runtime (as a mis-wired draft would be). */
const privacyWiring = vi.hoisted(() => ({ refused: false }))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage }),
}))

vi.mock('@/infrastructure/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/infrastructure/api')>()
    return { ...actual, apiService: api }
})

// A signed, final version next to the shipped draft, so effective dates and
// version switching can be exercised (R2-FE-01).
vi.mock('../documents/termsDocuments', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../documents/termsDocuments')>()
    const draft = actual.TERMS_DOCUMENTS['tos-v1']
    const section = (title: string, body: string) => ({ id: 'eligibility', title, body: [body] })
    const v2 = {
        id: 'tos-v2',
        status: 'final' as const,
        en: { effectiveDate: '2027-01-15', sections: [section('Who can use Magic Worlds', 'Adults only.')] },
        es: { effectiveDate: '2027-01-15', sections: [section('Quién puede usar Magic Worlds', 'Solo personas adultas.')] },
    }
    const registry = { ...actual.TERMS_DOCUMENTS, 'tos-v2': v2 }
    return {
        ...actual,
        TERMS_DOCUMENTS: registry,
        termsDocumentFor: (version: string | null | undefined) => actual.termsDocumentFor(version, registry),
        displayedTermsDocument: (version: string | null | undefined) => actual.termsDocumentFor(version, registry) ?? draft,
    }
})

vi.mock('../documents/privacyVoiceCopy', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../documents/privacyVoiceCopy')>()
    return {
        ...actual,
        privacyVoiceCopy: (...args: Parameters<typeof actual.privacyVoiceCopy>) =>
            privacyWiring.refused ? null : actual.privacyVoiceCopy(...args),
    }
})

beforeAll(ensureSafetyLocales)

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}>{ui}</I18nextProvider>)
}

beforeEach(async () => {
    await i18n.changeLanguage('en')
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    privacyWiring.refused = false
})

// The Privacy page was last updated when the ElevenLabs voice section was published (I-71).
const PAGE_CASES: Array<[LegalPageId, string, string, string]> = [
    ['about', 'A free preview for living stories', 'Do not use Magic Worlds for illegal content or activity.', 'June 12, 2026'],
    ['contact', 'Reach Magic Worlds', 'Do not send passwords or secrets.', 'June 12, 2026'],
    ['privacy', 'How Magic Worlds handles data', 'Local-only storage and zero-retention mode are not supported right now.', 'October 14, 2026'],
    ['disclaimer', 'Preview service limits', 'NSFW content is not allowed while the service is free.', 'June 12, 2026'],
]

describe('LegalPage', () => {
    it.each(PAGE_CASES)('renders the %s page content', (page, heading, expectedCopy, updated) => {
        render(<LegalPage page={page} />)

        expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
        expect(screen.getByText((text) => text.includes(expectedCopy))).toBeTruthy()
        expect(screen.getByText(`Last updated ${updated}`)).toBeTruthy()
        expect(screen.getByRole('link', { name: 'andres@arz.ai' })).toHaveAttribute('href', 'mailto:andres@arz.ai')
    })

    it('marks the active legal page and navigates to related pages', () => {
        render(<LegalPage page="privacy" />)

        const nav = within(screen.getByRole('navigation', { name: 'Legal pages' }))
        expect(nav.getByRole('button', { name: 'Privacy Policy' })).toHaveAttribute('aria-current', 'page')

        fireEvent.click(nav.getByRole('button', { name: 'Contact' }))
        fireEvent.click(screen.getByRole('button', { name: 'Explore' }))

        expect(setPage).toHaveBeenNthCalledWith(1, 'contact')
        expect(setPage).toHaveBeenNthCalledWith(2, 'landing')
    })

    it('renders legal page chrome and body in Spanish', () => {
        renderSpanish(<LegalPage page="privacy" />)

        expect(screen.getByRole('heading', { name: 'Cómo Magic Worlds maneja los datos' })).toBeTruthy()
        expect(screen.getByText((text) => text.includes('El almacenamiento solo local y el modo de cero retención'))).toBeTruthy()
        expect(screen.getByText('Última actualización: 14 de octubre de 2026')).toBeTruthy()

        const nav = within(screen.getByRole('navigation', { name: 'Páginas legales' }))
        expect(nav.getByRole('button', { name: 'Política de privacidad' })).toHaveAttribute('aria-current', 'page')
    })

    it('renders the Terms of Service outline under a visible draft notice', () => {
        render(<LegalPage page="terms" />)

        expect(screen.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeTruthy()
        const notice = screen.getByRole('note')
        expect(notice).toHaveTextContent('Draft — pending legal review')
        expect(notice).toHaveTextContent('not in effect yet')
        for (const heading of ['Eligibility and age', 'Acceptable use', 'Third-party AI providers', 'Enforcement', 'AI-generated voices']) {
            expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
        }
        expect(screen.getAllByText((text) => text.startsWith('Pending legal review.')).length).toBeGreaterThanOrEqual(5)

        const nav = within(screen.getByRole('navigation', { name: 'Legal pages' }))
        expect(nav.getByRole('button', { name: 'Terms of Service' })).toHaveAttribute('aria-current', 'page')
    })

    it('marks the Spanish Terms of Service as a draft too', () => {
        renderSpanish(<LegalPage page="terms" />)

        expect(screen.getByRole('note')).toHaveTextContent('Borrador: pendiente de revisión legal')
    })

    describe('terms by version (R0-LEG-03, R2-FE-01)', () => {
        function attestation(status: AttestationContextValue['status'], termsVersion?: string | null): AttestationContextValue {
            return {
                gate: 'satisfied',
                status,
                ...(termsVersion !== undefined ? { termsVersion } : {}),
                requestAttestation: vi.fn(async () => true),
                withAttestation: vi.fn(async (operation) => operation()),
                expectSignupAttestation: vi.fn(),
                cancelSignupAttestation: vi.fn(),
            }
        }

        it('shows the document and version the server requires, keeping the draft banner', () => {
            render(
                <AttestationContext.Provider value={attestation({
                    required: [{ kind: 'age_18_plus', version: 'age-1' }, { kind: 'terms_of_service', version: 'tos-v1' }],
                    accepted: [{ kind: 'terms_of_service', version: 'tos-v0', accepted_at: '2026-09-02T00:00:00Z' }],
                })}>
                    <LegalPage page="terms" />
                </AttestationContext.Provider>,
            )

            expect(screen.getByTestId('terms-version')).toHaveTextContent('Terms version: tos-v1')
            expect(screen.getByRole('note')).toHaveTextContent('Draft — pending legal review')
            // A draft has no effective date.
            expect(screen.queryByTestId('terms-effective-date')).toBeNull()
        })

        it('renders a final version by its own text and effective date, without the draft banner', () => {
            render(
                <AttestationContext.Provider value={attestation({ required: [{ kind: 'terms_of_service', version: 'tos-v2' }], accepted: [] }, 'tos-v2')}>
                    <LegalPage page="terms" />
                </AttestationContext.Provider>,
            )

            expect(screen.getByTestId('terms-version')).toHaveTextContent('Terms version: tos-v2')
            expect(screen.getByTestId('terms-effective-date')).toHaveTextContent('In effect from January 15, 2027')
            expect(screen.getByRole('heading', { name: 'Who can use Magic Worlds' })).toBeTruthy()
            expect(screen.getByText('Adults only.')).toBeTruthy()
            expect(screen.queryByRole('heading', { name: 'Acceptable use' })).toBeNull()
            expect(screen.queryByRole('note')).toBeNull()
        })

        it('prefers the version the provider exposes over the raw status', () => {
            render(
                <AttestationContext.Provider value={attestation({ required: [{ kind: 'terms_of_service', version: 'tos-v1' }], accepted: [] }, 'tos-v2')}>
                    <LegalPage page="terms" />
                </AttestationContext.Provider>,
            )
            expect(screen.getByTestId('terms-version')).toHaveTextContent('tos-v2')
        })

        it('never names a version it cannot show: an unshipped one falls back to the newest shipped document', () => {
            render(
                <AttestationContext.Provider value={attestation({
                    required: [{ kind: 'terms_of_service', version: 'tos-2026-10-12' }],
                    accepted: [],
                })}>
                    <LegalPage page="terms" />
                </AttestationContext.Provider>,
            )

            expect(screen.getByTestId('terms-version')).toHaveTextContent('Terms version: tos-v1')
            expect(screen.queryByText((text) => text.includes('tos-2026-10-12'))).toBeNull()
            expect(screen.getByRole('heading', { name: 'Acceptable use' })).toBeTruthy()
        })

        it('falls back to the latest accepted version when none is listed as required', () => {
            render(
                <AttestationContext.Provider value={attestation({
                    required: [],
                    accepted: [
                        { kind: 'terms_of_service', version: 'tos-v2', accepted_at: '2026-10-02T00:00:00Z' },
                        { kind: 'terms_of_service', version: 'tos-v1', accepted_at: '2026-09-01T00:00:00Z' },
                    ],
                })}>
                    <LegalPage page="terms" />
                </AttestationContext.Provider>,
            )

            expect(screen.getByTestId('terms-version')).toHaveTextContent('tos-v2')
        })

        it('shows the newest shipped version without a server status (signed out, or route not deployed)', () => {
            const { unmount } = render(<LegalPage page="terms" />)
            expect(screen.getByTestId('terms-version')).toHaveTextContent('Terms version: tos-v1')
            unmount()

            render(<AttestationContext.Provider value={attestation(null)}><LegalPage page="terms" /></AttestationContext.Provider>)
            expect(screen.getByTestId('terms-version')).toHaveTextContent('Terms version: tos-v1')
        })

        it('localizes the version and date in Spanish and never shows them on other pages', () => {
            const value = attestation({ required: [{ kind: 'terms_of_service', version: 'tos-v2' }], accepted: [] })
            const { unmount } = renderSpanish(
                <AttestationContext.Provider value={value}><LegalPage page="terms" /></AttestationContext.Provider>,
            )
            expect(screen.getByTestId('terms-version')).toHaveTextContent('Versión de los términos: tos-v2')
            expect(screen.getByTestId('terms-effective-date')).toHaveTextContent('En vigor desde el 15 de enero de 2027')
            expect(screen.getByRole('heading', { name: 'Quién puede usar Magic Worlds' })).toBeTruthy()
            unmount()

            render(<AttestationContext.Provider value={value}><LegalPage page="privacy" /></AttestationContext.Provider>)
            expect(screen.queryByTestId('terms-version')).toBeNull()
            expect(screen.queryByTestId('terms-effective-date')).toBeNull()
        })
    })

    describe('privacy voice section (R2-FE-01: the wired ElevenLabs variant, I-71)', () => {
        const EN_TITLE = 'Voice narration, calls and transcripts'
        const EN_BODY = [
            'Voice narration and call replies are spoken by AI voices generated by ElevenLabs, a text-to-speech provider. In calls, your speech is transcribed by Groq. The text to be spoken is sent to ElevenLabs, which processes it, may store it in the United States, and may have its safety team review it to enforce its usage policy. We delete it from ElevenLabs’ history on a regular schedule, and we have opted out of ElevenLabs using it to train its models. Before any text is spoken, an automated safety check reviews it; that check is run by the AI providers that already process your stories for generation.',
            'Magic Worlds does not store raw microphone audio. The final transcript, call metadata and the AI’s spoken replies are saved with the chat so the conversation can continue. Our providers may keep request data under their own retention policies.',
            'Ending the call stops microphone capture and voice playback. Browser microphone permission can also be revoked through your browser settings.',
        ]
        const ES_TITLE = 'Narración por voz, llamadas y transcripciones'
        const ES_BODY = [
            'La narración por voz y las respuestas de las llamadas las pronuncian voces de IA generadas por ElevenLabs, un proveedor de texto a voz. En las llamadas, Groq transcribe tu voz. El texto que se va a pronunciar se envía a ElevenLabs, que lo procesa, puede guardarlo en Estados Unidos y puede hacer que su equipo de seguridad lo revise para hacer cumplir su política de uso. Lo eliminamos del historial de ElevenLabs de forma periódica y hemos desactivado la opción de que ElevenLabs lo use para entrenar sus modelos. Antes de pronunciar cualquier texto, un control de seguridad automático lo revisa; ese control lo ejecutan los proveedores de IA que ya procesan tus historias para generarlas.',
            'Magic Worlds no guarda el audio bruto del micrófono. La transcripción final, los metadatos de la llamada y las respuestas habladas de la IA se guardan con el chat para que la conversación pueda continuar. Nuestros proveedores pueden conservar los datos de las solicitudes según sus propias políticas de retención.',
            'Terminar la llamada detiene la captura del micrófono y la reproducción de voz. También puedes revocar el permiso de micrófono desde la configuración de tu navegador.',
        ]

        function voiceSection(heading: string): string[] {
            const title = screen.getByRole('heading', { name: heading })
            const section = title.closest('section')
            expect(section).not.toBeNull()
            return within(section as HTMLElement).getAllByText((_, element) => element?.tagName === 'P').map((p) => p.textContent ?? '')
        }

        it('renders the published English text word for word', () => {
            render(<LegalPage page="privacy" />)
            expect(voiceSection(EN_TITLE)).toEqual(EN_BODY)
            expect(screen.queryByRole('heading', { name: 'Voice calls and transcripts' })).toBeNull()
        })

        it('renders the published Spanish text word for word', () => {
            renderSpanish(<LegalPage page="privacy" />)
            expect(voiceSection(ES_TITLE)).toEqual(ES_BODY)
            expect(screen.queryByRole('heading', { name: 'Llamadas de voz y transcripciones' })).toBeNull()
        })

        it('falls back to the same published locale text when the wired variant is refused', () => {
            privacyWiring.refused = true
            const { unmount } = render(<LegalPage page="privacy" />)
            expect(voiceSection(EN_TITLE)).toEqual(EN_BODY)
            unmount()

            renderSpanish(<LegalPage page="privacy" />)
            expect(voiceSection(ES_TITLE)).toEqual(ES_BODY)
        })
    })

    describe('report a minor on the Contact page (R2-BE-02)', () => {
        type AuthValue = NonNullable<ContextType<typeof AuthContext>>

        function signedIn(accountKey = 'user:7'): AuthValue {
            return { isAuthenticated: true, accountKey } as AuthValue
        }

        it('asks nothing and shows nothing for a signed-out visitor', () => {
            render(<LegalPage page="contact" />)
            expect(screen.queryByRole('heading', { name: 'Report a possible minor' })).toBeNull()
            expect(api.getMinorReportStatus).not.toHaveBeenCalled()
        })

        it('stays hidden while reporting is closed for the account', async () => {
            api.getMinorReportStatus.mockResolvedValue({ enabled: false, can_report: false, reports_left_today: 0, reason: null })
            render(<AuthContext.Provider value={signedIn()}><LegalPage page="contact" /></AuthContext.Provider>)

            await waitFor(() => expect(api.getMinorReportStatus).toHaveBeenCalledTimes(1))
            expect(screen.queryByRole('heading', { name: 'Report a possible minor' })).toBeNull()
        })

        it('shows the form to a signed-in account while reporting is open, and only on Contact', async () => {
            api.getMinorReportStatus.mockResolvedValue({ enabled: true, can_report: true, reports_left_today: 3, reason: null })
            const { unmount } = render(<AuthContext.Provider value={signedIn()}><LegalPage page="contact" /></AuthContext.Provider>)

            expect(await screen.findByRole('heading', { name: 'Report a possible minor' })).toBeTruthy()
            unmount()
            api.getMinorReportStatus.mockClear()

            render(<AuthContext.Provider value={signedIn()}><LegalPage page="privacy" /></AuthContext.Provider>)
            expect(screen.queryByRole('heading', { name: 'Report a possible minor' })).toBeNull()
            expect(api.getMinorReportStatus).not.toHaveBeenCalled()
        })
    })
})
