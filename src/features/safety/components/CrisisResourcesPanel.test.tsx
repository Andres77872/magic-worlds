import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { LEGAL_PENDING } from '@/features/legal/documents'
import type { CrisisResource } from '../crisisResources'
import { ensureSafetyLocales } from '../test/ensureSafetyLocales'
import { CrisisResourcesPanel } from './CrisisResourcesPanel'

const crisis = vi.hoisted(() => ({ signed: null as CrisisResource[] | null }))

// The real list (a draft) unless a test signs one.
vi.mock('../crisisResources', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../crisisResources')>()
    return {
        ...actual,
        shippableCrisisResources: (language: 'en' | 'es') => crisis.signed ?? actual.shippableCrisisResources(language),
    }
})

function renderPanel(retryAfterSeconds?: number | null, lng = 'en') {
    return render(
        <I18nextProvider i18n={i18n.cloneInstance({ lng })}>
            <CrisisResourcesPanel retryAfterSeconds={retryAfterSeconds} />
        </I18nextProvider>,
    )
}

beforeAll(ensureSafetyLocales)

afterEach(() => {
    cleanup()
    crisis.signed = null
})

describe('CrisisResourcesPanel', () => {
    it('shows only the approved generic lines while the crisis list is a draft', () => {
        const { container } = renderPanel()

        expect(screen.getByText('Voice is paused for now. Text chat keeps working.')).toBeTruthy()
        expect(screen.getByText(/contact your local emergency services now/)).toBeTruthy()
        expect(screen.queryByRole('region', { name: 'Support' })).toBeNull()
        expect(screen.queryByRole('list')).toBeNull()
        expect(container.textContent).not.toContain(LEGAL_PENDING)
        expect(container.textContent).not.toContain('LEGAL_PENDING')
    })

    it('never renders a pending entry in Spanish either', () => {
        const { container } = renderPanel(null, 'es')
        expect(screen.getByText('La voz está en pausa por ahora. El chat de texto sigue funcionando.')).toBeTruthy()
        expect(container.textContent).not.toContain('LEGAL_PENDING')
    })

    it.each([
        [30, 'Voice comes back in about 1 minute.'],
        [60, 'Voice comes back in about 1 minute.'],
        [90, 'Voice comes back in about 2 minutes.'],
        [3600, 'Voice comes back in about 60 minutes.'],
    ])('says when voice resumes (%i s)', (seconds, copy) => {
        renderPanel(seconds)
        expect(screen.getByText(copy)).toBeTruthy()
    })

    it.each([null, 0, -5, Number.NaN])('has no resume line without a positive retry (%s)', (seconds) => {
        renderPanel(seconds)
        expect(screen.queryByText(/Voice comes back/)).toBeNull()
    })

    it('lists signed resources once counsel signs them', () => {
        crisis.signed = [{ id: 'intl', country: null, name: 'Signed line', contact: '000' }]
        renderPanel()
        const list = screen.getByRole('region', { name: 'Support' })
        expect(list).toHaveTextContent('Signed line · 000')
    })
})
