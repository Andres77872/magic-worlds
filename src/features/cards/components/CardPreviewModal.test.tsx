import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { CardPreview } from '../cardPreview'
import { CardPreviewModal } from './CardPreviewModal'

vi.mock('@/infrastructure/api', () => ({
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

vi.mock('@/ui/components/lists/Card', () => ({
    Card: ({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) => (
        <article>
            <h3>{title}</h3>
            {subtitle}
            {children}
        </article>
    ),
}))

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}>{ui}</I18nextProvider>)
}

const CARD: CardPreview = {
    id: 'w1',
    type: 'world',
    mediaType: 'world',
    title: 'Rivendell',
    description: 'A hidden valley.',
    triggers: ['valley'],
    createdAt: '2026-06-01T09:00:00',
}

describe('CardPreviewModal', () => {
    it('renders Spanish loading and unavailable states', () => {
        const target = { type: 'world' as const, id: 'w1' }
        const { rerender } = renderSpanish(
            <CardPreviewModal target={target} card={null} loading error={null} onClose={vi.fn()} />,
        )

        expect(screen.getByText('Cargando carta...')).toBeInTheDocument()

        rerender(
            <I18nextProvider i18n={i18n.cloneInstance({ lng: 'es' })}>
                <CardPreviewModal target={target} card={null} loading={false} error={null} onClose={vi.fn()} />
            </I18nextProvider>,
        )

        expect(screen.getByText('Esta carta ya no está disponible en la biblioteca actual.')).toBeInTheDocument()
        expect(screen.getAllByText('Mundo').length).toBeGreaterThan(0)
    })

    it('renders Spanish metadata labels for a loaded card', () => {
        renderSpanish(<CardPreviewModal target={{ type: 'world', id: 'w1' }} card={CARD} loading={false} error={null} onClose={vi.fn()} />)

        expect(screen.getByText('Carta')).toBeInTheDocument()
        expect(screen.getByText('Rivendell')).toBeInTheDocument()
        expect(screen.getByText((text) => text.startsWith('Creada '))).toBeInTheDocument()
    })

    it('renders no import footer when onImport is omitted (read-only preview)', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <CardPreviewModal target={{ type: 'world', id: 'w1' }} card={CARD} loading={false} error={null} onClose={vi.fn()} />
            </I18nextProvider>,
        )
        expect(screen.queryByRole('button', { name: /import/i })).not.toBeInTheDocument()
    })

    it('fires onImport from the footer Import button', () => {
        const onImport = vi.fn()
        render(
            <I18nextProvider i18n={i18n}>
                <CardPreviewModal
                    target={{ type: 'world', id: 'w1' }}
                    card={CARD}
                    loading={false}
                    error={null}
                    onClose={vi.fn()}
                    originalCreatorName="loremaster"
                    onImport={onImport}
                />
            </I18nextProvider>,
        )
        expect(screen.getByText('Created by loremaster')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Import' }))
        expect(onImport).toHaveBeenCalledTimes(1)
    })

    it('shows the already-imported badge with Open existing + Import a copy', () => {
        const onOpenExisting = vi.fn()
        render(
            <I18nextProvider i18n={i18n}>
                <CardPreviewModal
                    target={{ type: 'world', id: 'w1' }}
                    card={CARD}
                    loading={false}
                    error={null}
                    onClose={vi.fn()}
                    alreadyImported
                    onImport={vi.fn()}
                    onOpenExisting={onOpenExisting}
                />
            </I18nextProvider>,
        )
        expect(screen.getByText('Already in your library')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Import a copy' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Open existing' }))
        expect(onOpenExisting).toHaveBeenCalledTimes(1)
    })

    it.each([
        { loading: true, error: null, card: null },
        { loading: false, error: 'Unavailable', card: null },
        { loading: false, error: null, card: null },
    ])('keeps import unavailable until card details can be reviewed: %j', (state) => {
        const onImport = vi.fn()
        render(<CardPreviewModal target={{ type: 'world', id: 'w1' }} {...state} onClose={vi.fn()} onImport={onImport} />)
        const button = screen.getByRole('button', { name: 'Import' })
        expect(button).toBeDisabled()
        fireEvent.click(button)
        expect(onImport).not.toHaveBeenCalled()
    })

    it('disables the import button while importing', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <CardPreviewModal
                    target={{ type: 'world', id: 'w1' }}
                    card={CARD}
                    loading={false}
                    error={null}
                    onClose={vi.fn()}
                    importing
                    onImport={vi.fn()}
                />
            </I18nextProvider>,
        )
        expect(screen.getByRole('button', { name: 'Importing…' })).toBeDisabled()
    })
})

describe('CardPreviewModal voice line (R1-FE-03)', () => {
    const voice = {
        schema_version: 2 as const,
        provider: 'elevenlabs' as const,
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        voice_name: 'Eldrin',
        settings: null,
        emotion: null,
        language_code: null,
    }
    const effective = {
        voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9',
        display_name: 'Maren',
        provider_route: 'elevenlabs' as const,
        substitution_reason: 'voice_removed' as const,
        badges: ['replaced' as const],
    }
    const CHARACTER: CardPreview = { id: 'c1', type: 'character', mediaType: 'character', title: 'Lyra', triggers: [], voice: { stored: voice, effective } }

    function renderCard(card: CardPreview) {
        return render(
            <I18nextProvider i18n={i18n}>
                <CardPreviewModal target={{ type: card.type, id: card.id }} card={card} loading={false} error={null} onClose={vi.fn()} />
            </I18nextProvider>,
        )
    }

    it('hides stored voice details when the parent flag is off', () => {
        setTestFeatureFlags({ voices: false })
        try {
            renderCard(CHARACTER)
            expect(screen.queryByTestId('card-preview-voice')).not.toBeInTheDocument()
            expect(screen.getByText('Lyra')).toBeInTheDocument()
        } finally { vi.unstubAllEnvs() }
    })

    it('shows the voice and what it plays as for a projection', () => {
        renderCard(CHARACTER)
        expect(screen.getByTestId('card-preview-voice')).toHaveTextContent('Eldrin')
        expect(screen.getByText('Plays as Maren')).toBeInTheDocument()
    })

    it('shows no voice line without a projection or for a persona', () => {
        const { unmount } = renderCard({ ...CHARACTER, voice: { stored: voice, effective: null } })
        expect(screen.queryByTestId('card-preview-voice')).not.toBeInTheDocument()
        unmount()
        renderCard({ ...CHARACTER, type: 'persona' })
        expect(screen.queryByTestId('card-preview-voice')).not.toBeInTheDocument()
    })
})
