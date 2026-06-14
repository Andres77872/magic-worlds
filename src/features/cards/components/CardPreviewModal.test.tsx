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
