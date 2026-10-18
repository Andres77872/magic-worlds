import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppUpdateBanner } from './AppUpdateBanner'
const prepare = vi.hoisted(() => vi.fn())
vi.mock('@/app/offline/offlineApp', async (original) => ({ ...await original<typeof import('@/app/offline/offlineApp')>(), prepareOfflineApp: prepare }))

describe('AppUpdateBanner', () => {
    it('does not render when no update is available', () => {
        render(<AppUpdateBanner updateAvailable={false} />)

        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows a reload action when an update is available', () => {
        const onReload = vi.fn()

        render(<AppUpdateBanner updateAvailable onReload={onReload} />)

        expect(screen.getByRole('status')).toHaveTextContent('A new version is available. Reload to update.')

        fireEvent.click(screen.getByRole('button', { name: /reload/i }))

        expect(onReload).toHaveBeenCalledTimes(1)
    })
    it('downloads a waiting offline update without reloading open writing', async () => {
        prepare.mockResolvedValue({ state: 'waiting', buildId: 'next-build' })
        const onReload = vi.fn()
        render(<AppUpdateBanner updateAvailable offlineControlled onReload={onReload} />)
        const action = screen.getByRole('button', { name: 'Download offline update' }); action.focus()
        await act(async () => { fireEvent.click(action) })
        expect(onReload).not.toHaveBeenCalled()
        expect(screen.getByRole('status')).toHaveTextContent('Retain your writing, close all app tabs')
        expect(action).toHaveFocus()
    })
    it('does not call an unchanged active copy a downloaded update', async () => {
        prepare.mockResolvedValue({ state: 'ready', buildId: 'current-build' })
        render(<AppUpdateBanner updateAvailable offlineControlled />)
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Download offline update' })) })
        expect(screen.getByRole('status')).toHaveTextContent('App files verified on this browser')
        expect(screen.getByRole('status')).not.toHaveTextContent('downloaded app update is ready')
    })
})
