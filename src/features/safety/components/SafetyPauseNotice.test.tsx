import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ensureSafetyLocales } from '../test/ensureSafetyLocales'
import { SafetyPauseNotice } from './SafetyPauseNotice'

function renderNotice(open: boolean, retryAfterSeconds: number | null = null) {
    const onClose = vi.fn()
    render(
        <I18nextProvider i18n={i18n.cloneInstance({ lng: 'en' })}>
            <SafetyPauseNotice open={open} retryAfterSeconds={retryAfterSeconds} onClose={onClose} />
        </I18nextProvider>,
    )
    return onClose
}

beforeAll(ensureSafetyLocales)
afterEach(cleanup)

describe('SafetyPauseNotice', () => {
    it('explains the pause with the crisis panel and one close control', () => {
        const onClose = renderNotice(true, 120)

        const dialog = screen.getByRole('dialog', { name: 'Voice is paused' })
        expect(dialog).toHaveTextContent('Text chat keeps working.')
        expect(dialog).toHaveTextContent('Voice comes back in about 2 minutes.')
        expect(dialog).toHaveTextContent('contact your local emergency services now')
        const close = screen.getAllByRole('button', { name: 'Close' })
        expect(close).toHaveLength(1)
        fireEvent.click(close[0])
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('renders nothing while closed', () => {
        renderNotice(false)
        expect(screen.queryByRole('dialog')).toBeNull()
    })
})
