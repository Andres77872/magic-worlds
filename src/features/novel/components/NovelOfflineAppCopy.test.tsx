import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NovelOfflineAppCopy } from './NovelOfflineAppCopy'
import { i18n } from '@/app/i18n'
import type { OfflineAppState } from '@/app/offline/offlineApp'

const storage = vi.hoisted(() => ({ inspect: vi.fn(), prepare: vi.fn() }))
vi.mock('@/app/offline/offlineApp', () => ({ inspectOfflineApp: storage.inspect, prepareOfflineApp: storage.prepare }))
afterEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('en') })

it('downloads only after an explicit action and retains focus through the verified status', async () => {
    storage.inspect.mockResolvedValue({ state: 'empty' })
    let finish!: (value: OfflineAppState) => void
    storage.prepare.mockImplementation(() => new Promise<OfflineAppState>((resolve) => { finish = resolve }))
    render(<NovelOfflineAppCopy />)
    await screen.findByText('The app has not been retained for offline opening yet.')
    expect(storage.prepare).not.toHaveBeenCalled()
    const action = screen.getByRole('button', { name: 'Download app for offline writing' }); action.focus(); fireEvent.click(action)
    expect(action).toHaveAttribute('aria-disabled', 'true'); expect(action).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(action)
    expect(storage.prepare).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ state: 'ready' }) })
    expect(screen.getByRole('status')).toHaveTextContent('App files verified')
    expect(action).toHaveFocus(); expect(action).toBeEnabled()
    expect(storage.prepare).toHaveBeenCalledTimes(1)
})
it('explains a refused allowance without claiming the earlier app or writing was discarded', async () => {
    storage.inspect.mockResolvedValue({ state: 'ready' }); storage.prepare.mockResolvedValue({ state: 'failed', reason: 'limit' })
    render(<NovelOfflineAppCopy />); await screen.findByText(/App files verified/)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check offline app copy' })) })
    expect(screen.getByRole('status')).toHaveTextContent('Earlier app copies and device writing were kept')
})
it('keeps unsupported LAN controls disabled with Spanish recovery copy', async () => {
    await i18n.changeLanguage('es'); storage.inspect.mockResolvedValue({ state: 'unsupported', reason: 'secure' })
    render(<NovelOfflineAppCopy />)
    await screen.findByText(/requiere HTTPS o localhost/)
    fireEvent.click(screen.getByRole('button', { name: /Descargar aplicación/ }))
    expect(storage.prepare).not.toHaveBeenCalled()
})
