import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError, AttestationRequiredError } from '@/infrastructure/api'
import type { AttestationStatus } from '@/shared/types'
import { AttestationProvider } from './AttestationProvider'
import { useAttestation, type AttestationContextValue } from './attestationContext'

const auth = vi.hoisted(() => ({
    isAuthenticated: true,
    accountKey: 'user:1',
    logout: vi.fn(async () => {}),
}))

const api = vi.hoisted(() => ({
    getAttestationStatus: vi.fn(),
    submitAttestations: vi.fn(),
}))

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }))

vi.mock('@/infrastructure/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/infrastructure/api')>()
    return { ...actual, apiService: api }
})

// A second shipped version, so a bump between two known documents can be exercised.
vi.mock('../documents/termsDocuments', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../documents/termsDocuments')>()
    const v2 = { ...actual.TERMS_DOCUMENTS['tos-v1'], id: 'tos-v2' }
    const registry = { ...actual.TERMS_DOCUMENTS, 'tos-v2': v2 }
    return {
        ...actual,
        TERMS_DOCUMENTS: registry,
        termsDocumentFor: (version: string | null | undefined) => actual.termsDocumentFor(version, registry),
    }
})

// The Terms version must be one the SPA ships (R2-FE-01): `tos-v1` is the BFF default.
const REQUIRED = [
    { kind: 'age_18_plus', version: '2026-10-01' },
    { kind: 'terms_of_service', version: 'tos-v1' },
] as const

const NOTHING_ACCEPTED: AttestationStatus = { required: [...REQUIRED], accepted: [] }
const ALL_ACCEPTED: AttestationStatus = {
    required: [...REQUIRED],
    accepted: REQUIRED.map((entry) => ({ ...entry, accepted_at: '2026-10-02T00:00:00Z' })),
}

const probe: { current: AttestationContextValue | null } = { current: null }

function Probe() {
    const value = useAttestation()
    useEffect(() => {
        probe.current = value
    })
    return <span data-testid="gate">{value?.gate}</span>
}

function renderProvider() {
    const localI18n = i18n.cloneInstance({ lng: 'en' })
    return render(
        <I18nextProvider i18n={localI18n}>
            <AttestationProvider>
                <Probe />
            </AttestationProvider>
        </I18nextProvider>,
    )
}

function tickAll() {
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ }))
}

beforeEach(() => {
    auth.isAuthenticated = true
    auth.accountKey = 'user:1'
    probe.current = null
    window.location.hash = ''
    api.submitAttestations.mockImplementation(async (items: Array<{ kind: string; version: string }>) =>
        items.map((item) => ({ ...item, accepted_at: '2026-10-12T00:00:00Z' })))
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('AttestationProvider', () => {
    it('never blocks when the status route is not deployed (404)', async () => {
        api.getAttestationStatus.mockRejectedValue(new ApiError(404, 'Not Found'))
        renderProvider()

        await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('unavailable'))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(api.submitAttestations).not.toHaveBeenCalled()
        expect(probe.current?.status).toBeNull()
    })

    it('stays quiet when every current version is accepted', async () => {
        api.getAttestationStatus.mockResolvedValue(ALL_ACCEPTED)
        renderProvider()

        await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('satisfied'))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        // The server's status is shared for the Terms page version (R0-LEG-03).
        expect(probe.current?.status).toEqual(ALL_ACCEPTED)
        // R2-FE-01: and the version itself, for the Terms page.
        expect(probe.current?.termsVersion).toBe('tos-v1')
    })

    it('exposes the required Terms version over an older accepted one', async () => {
        api.getAttestationStatus.mockResolvedValue({
            required: [...REQUIRED.slice(0, 1), { kind: 'terms_of_service', version: 'tos-v2' }],
            accepted: [{ kind: 'terms_of_service', version: 'tos-v1', accepted_at: '2026-10-02T00:00:00Z' }],
        })
        renderProvider()

        await waitFor(() => expect(probe.current?.termsVersion).toBe('tos-v2'))
        expect(probe.current?.gate).toBe('required')
    })

    it('blocks an existing account until it attests, then records a reprompt', async () => {
        api.getAttestationStatus.mockResolvedValue(NOTHING_ACCEPTED)
        renderProvider()

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveTextContent('Magic Worlds is for adults')
        // The click-wrap names the exact version being accepted (R2-FE-01).
        expect(screen.getByTestId('attestation-terms-version')).toHaveTextContent('Terms of Service, version tos-v1')
        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
        const confirm = screen.getByRole('button', { name: 'Confirm' })
        expect(confirm).toBeDisabled()

        tickAll()
        fireEvent.click(confirm)

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(api.submitAttestations).toHaveBeenCalledWith([...REQUIRED], 'reprompt')
        expect(screen.getByTestId('gate')).toHaveTextContent('satisfied')
    })

    it('asks only for the missing kind after a version bump', async () => {
        api.getAttestationStatus.mockResolvedValue({
            required: [...REQUIRED],
            accepted: [{ ...REQUIRED[0], accepted_at: '2026-10-02T00:00:00Z' }, { kind: 'terms_of_service', version: '2026-01-01', accepted_at: '2026-01-02T00:00:00Z' }],
        })
        renderProvider()

        await screen.findByRole('dialog')
        expect(screen.queryByRole('checkbox', { name: 'I am 18 or older' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

        await waitFor(() => expect(api.submitAttestations).toHaveBeenCalledWith([REQUIRED[1]], 'reprompt'))
    })

    it('signs out when a blocked account declines', async () => {
        api.getAttestationStatus.mockResolvedValue(NOTHING_ACCEPTED)
        renderProvider()

        await screen.findByRole('dialog')
        fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

        expect(auth.logout).toHaveBeenCalledTimes(1)
        expect(api.submitAttestations).not.toHaveBeenCalled()
    })

    it('records the boxes ticked at sign-up as signup_password, without prompting', async () => {
        auth.isAuthenticated = false
        auth.accountKey = 'anonymous'
        api.getAttestationStatus.mockResolvedValue(NOTHING_ACCEPTED)
        const view = renderProvider()
        expect(screen.getByTestId('gate')).toHaveTextContent('idle')

        act(() => probe.current?.expectSignupAttestation())
        auth.isAuthenticated = true
        auth.accountKey = 'user:new'
        view.rerender(
            <I18nextProvider i18n={i18n.cloneInstance({ lng: 'en' })}>
                <AttestationProvider>
                    <Probe />
                </AttestationProvider>
            </I18nextProvider>,
        )

        await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('satisfied'))
        expect(api.submitAttestations).toHaveBeenCalledWith([...REQUIRED], 'signup_password')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('records a first Google sign-in as signup_oauth', async () => {
        window.location.hash = '#/google-callback?code=abc'
        api.getAttestationStatus.mockResolvedValue(NOTHING_ACCEPTED)
        renderProvider()

        await screen.findByRole('dialog')
        tickAll()
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

        await waitFor(() => expect(api.submitAttestations).toHaveBeenCalledWith([...REQUIRED], 'signup_oauth'))
    })

    it('opens on a 428 and retries the refused request once after attesting', async () => {
        // The status route is not deployed yet, but a voice route already enforces D26.
        api.getAttestationStatus
            .mockRejectedValueOnce(new ApiError(404, 'Not Found'))
            .mockResolvedValue(NOTHING_ACCEPTED)
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('unavailable'))

        const operation = vi.fn()
            .mockRejectedValueOnce(new AttestationRequiredError(428, 'Attestation required'))
            .mockResolvedValueOnce('saved')
        let result: Promise<unknown> = Promise.resolve()
        act(() => {
            result = probe.current!.withAttestation(operation)
        })

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveTextContent('to use voice features')
        tickAll()
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

        await expect(result).resolves.toBe('saved')
        expect(operation).toHaveBeenCalledTimes(2)
        expect(api.submitAttestations).toHaveBeenCalledWith([...REQUIRED], 'reprompt')
    })

    it('rethrows the 428 without retrying when the user chooses not now', async () => {
        api.getAttestationStatus.mockResolvedValue(ALL_ACCEPTED)
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('satisfied'))

        const refusal = new AttestationRequiredError(428, 'Attestation required')
        const operation = vi.fn().mockRejectedValue(refusal)
        let result: Promise<unknown> = Promise.resolve()
        act(() => {
            result = probe.current!.withAttestation(operation)
        })
        await screen.findByRole('dialog')
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

        await expect(result).rejects.toBe(refusal)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(auth.logout).not.toHaveBeenCalled()
    })

    describe('click-wrap versions (R2-FE-01)', () => {
        it('never blocks the app on a Terms version the SPA does not ship; voice says the terms are being published', async () => {
            // Ops bumped the BFF before the SPA release that ships the document.
            const unknown: AttestationStatus = {
                required: [REQUIRED[0], { kind: 'terms_of_service', version: 'tos-v9' }],
                accepted: [{ ...REQUIRED[0], accepted_at: '2026-10-02T00:00:00Z' }],
            }
            api.getAttestationStatus.mockResolvedValue(unknown)
            renderProvider()

            await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('required'))
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

            // A voice surface still answers 428: its prompt cannot record the version and says why.
            const refusal = new AttestationRequiredError(428, 'Attestation required')
            const operation = vi.fn().mockRejectedValue(refusal)
            let result: Promise<unknown> = Promise.resolve()
            act(() => {
                result = probe.current!.withAttestation(operation)
            })
            await screen.findByRole('dialog')
            expect(screen.getByTestId('attestation-terms-unavailable')).toHaveTextContent('Updated terms are being published')
            expect(screen.queryByTestId('attestation-terms-version')).not.toBeInTheDocument()
            fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ }))
            expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
            fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

            await expect(result).rejects.toBe(refusal)
            expect(api.submitAttestations).not.toHaveBeenCalled()
            expect(auth.logout).not.toHaveBeenCalled()
        })

        it('asks only for the age box at sign-in when the Terms version is not shipped', async () => {
            const unknown: AttestationStatus = { required: [REQUIRED[0], { kind: 'terms_of_service', version: 'tos-v9' }], accepted: [] }
            api.getAttestationStatus.mockResolvedValue(unknown)
            renderProvider()

            const dialog = await screen.findByRole('dialog')
            expect(screen.queryByRole('checkbox', { name: /I agree to the Terms of Service/ })).not.toBeInTheDocument()
            expect(screen.queryByTestId('attestation-terms-unavailable')).not.toBeInTheDocument()
            expect(dialog).toHaveTextContent('Sign out')
            fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older' }))
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
            // Only the age box is recorded; the unshipped Terms version never is.
            expect(api.submitAttestations).toHaveBeenCalledWith([REQUIRED[0]], 'reprompt')
            expect(screen.getByTestId('gate')).toHaveTextContent('required')
            expect(auth.logout).not.toHaveBeenCalled()
        })

        it('records only the age box at sign-up when the Terms version is not shipped', async () => {
            auth.isAuthenticated = false
            auth.accountKey = 'anonymous'
            api.getAttestationStatus.mockResolvedValue({ required: [REQUIRED[0], { kind: 'terms_of_service', version: 'tos-v9' }], accepted: [] })
            const view = renderProvider()

            act(() => probe.current?.expectSignupAttestation())
            auth.isAuthenticated = true
            auth.accountKey = 'user:new'
            view.rerender(
                <I18nextProvider i18n={i18n.cloneInstance({ lng: 'en' })}>
                    <AttestationProvider>
                        <Probe />
                    </AttestationProvider>
                </I18nextProvider>,
            )

            await waitFor(() => expect(api.submitAttestations).toHaveBeenCalledWith([REQUIRED[0]], 'signup_password'))
            await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('required'))
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        it('never records a version the prompt did not show; it shows the new one and asks again', async () => {
            const bumped: AttestationStatus = { required: [REQUIRED[0], { kind: 'terms_of_service', version: 'tos-v2' }], accepted: [] }
            api.getAttestationStatus
                .mockResolvedValueOnce(NOTHING_ACCEPTED)
                .mockResolvedValue(bumped)
            renderProvider()

            await screen.findByRole('dialog')
            expect(screen.getByTestId('attestation-terms-version')).toHaveTextContent('version tos-v1')
            tickAll()
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

            await waitFor(() => expect(screen.getByTestId('attestation-terms-version')).toHaveTextContent('version tos-v2'))
            expect(api.submitAttestations).not.toHaveBeenCalled()
            expect(screen.getByRole('dialog')).toHaveTextContent('The Terms of Service were updated')
            // The boxes start unticked for the new version.
            expect(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ })).not.toBeChecked()

            tickAll()
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
            // The posted version is the displayed one.
            expect(api.submitAttestations).toHaveBeenCalledWith([REQUIRED[0], { kind: 'terms_of_service', version: 'tos-v2' }], 'reprompt')
        })

        it('re-prompts on a 409 attestation_stale instead of failing', async () => {
            const bumped: AttestationStatus = { required: [REQUIRED[0], { kind: 'terms_of_service', version: 'tos-v2' }], accepted: [] }
            api.getAttestationStatus
                .mockResolvedValueOnce(NOTHING_ACCEPTED)
                .mockResolvedValueOnce(NOTHING_ACCEPTED)
                .mockResolvedValue(bumped)
            api.submitAttestations.mockRejectedValueOnce(new ApiError(409, 'stale', { code: 'attestation_stale' }))
            renderProvider()

            await screen.findByRole('dialog')
            tickAll()
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

            await waitFor(() => expect(screen.getByTestId('attestation-terms-version')).toHaveTextContent('version tos-v2'))
            expect(screen.getByRole('dialog')).toHaveTextContent('The Terms of Service were updated')
            expect(screen.queryByText('Your confirmation could not be saved. Try again in a moment.')).not.toBeInTheDocument()
            expect(api.submitAttestations).toHaveBeenCalledTimes(1)
        })

        it('does not claim the Terms changed when a 409 attestation_stale leaves them unchanged', async () => {
            const ageMoved: AttestationStatus = { required: [{ kind: 'age_18_plus', version: '2026-11-01' }, REQUIRED[1]], accepted: [] }
            api.getAttestationStatus
                .mockResolvedValueOnce(NOTHING_ACCEPTED)
                .mockResolvedValueOnce(NOTHING_ACCEPTED)
                .mockResolvedValue(ageMoved)
            api.submitAttestations.mockRejectedValueOnce(new ApiError(409, 'stale', { code: 'attestation_stale' }))
            renderProvider()

            await screen.findByRole('dialog')
            tickAll()
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

            await screen.findByText('Your confirmation could not be saved. Try again in a moment.')
            expect(screen.getByRole('dialog')).not.toHaveTextContent('The Terms of Service were updated')
            // Same Terms version: the boxes stay ticked, and confirming again posts the current versions.
            expect(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ })).toBeChecked()
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
            expect(api.submitAttestations).toHaveBeenLastCalledWith([...ageMoved.required], 'reprompt')
        })

        it('records sign-up boxes only for the newest shipped version, else asks', async () => {
            auth.isAuthenticated = false
            auth.accountKey = 'anonymous'
            api.getAttestationStatus.mockResolvedValue({ required: [REQUIRED[0], { kind: 'terms_of_service', version: 'tos-v2' }], accepted: [] })
            const view = renderProvider()

            act(() => probe.current?.expectSignupAttestation())
            auth.isAuthenticated = true
            auth.accountKey = 'user:new'
            view.rerender(
                <I18nextProvider i18n={i18n.cloneInstance({ lng: 'en' })}>
                    <AttestationProvider>
                        <Probe />
                    </AttestationProvider>
                </I18nextProvider>,
            )

            await screen.findByRole('dialog')
            expect(api.submitAttestations).not.toHaveBeenCalled()
            expect(screen.getByTestId('attestation-terms-version')).toHaveTextContent('version tos-v2')
            tickAll()
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
            await waitFor(() => expect(api.submitAttestations).toHaveBeenCalledWith(
                [REQUIRED[0], { kind: 'terms_of_service', version: 'tos-v2' }],
                'signup_password',
            ))
        })
    })

    it('holds the login prompt while a legal page is open', async () => {
        window.location.hash = '#/terms'
        api.getAttestationStatus.mockResolvedValue(NOTHING_ACCEPTED)
        renderProvider()

        await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('required'))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
