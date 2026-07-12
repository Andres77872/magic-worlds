import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserNotification } from '@/shared'
import { NotificationsPage } from './NotificationsPage'

const setPage = vi.fn()
const openTasks = vi.fn()

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage }),
    useBackgroundTasks: () => ({ openDrawer: openTasks }),
}))

vi.mock('@/infrastructure/api', () => ({
    ApiError: class ApiError extends Error {},
    apiService: {
        listNotifications: vi.fn(),
        getNotificationUnreadCount: vi.fn(),
        markNotificationRead: vi.fn(),
        markAllNotificationsRead: vi.fn(),
        dismissNotification: vi.fn(),
    },
}))

import { apiService } from '@/infrastructure/api'

const notification = (overrides: Partial<UserNotification> = {}): UserNotification => ({
    notification_id: 1,
    type: 'generation.completed',
    category: 'generation',
    severity: 'success',
    title: 'Portrait ready',
    body: 'Your portrait finished generating.',
    action_label: null,
    action_url: null,
    metadata: null,
    read_at: null,
    created_at: '2026-07-12T12:00:00Z',
    expires_at: null,
    ...overrides,
})

let listedItems: UserNotification[]
let serverUnreadCount: number

describe('NotificationsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        listedItems = [notification()]
        serverUnreadCount = 1
        vi.mocked(apiService.listNotifications).mockImplementation(async () => ({
            items: listedItems,
            limit: 100,
            offset: 0,
        }))
        vi.mocked(apiService.getNotificationUnreadCount).mockImplementation(async () => ({
            unread_count: serverUnreadCount,
        }))
        vi.mocked(apiService.markNotificationRead).mockImplementation(async (id) => ({
            ...(listedItems.find((item) => item.notification_id === id) ?? notification({ notification_id: id })),
            read_at: '2026-07-12T12:05:00Z',
        }))
        vi.mocked(apiService.markAllNotificationsRead).mockResolvedValue({ updated: 1 })
        vi.mocked(apiService.dismissNotification).mockResolvedValue(undefined)
    })

    it('loads the canonical list and unread-count endpoints', async () => {
        serverUnreadCount = 7

        render(<NotificationsPage />)

        expect(await screen.findByText('Portrait ready')).toBeInTheDocument()
        expect(apiService.listNotifications).toHaveBeenCalledWith({ unreadOnly: false, limit: 100 })
        expect(apiService.getNotificationUnreadCount).toHaveBeenCalledTimes(1)
        expect(screen.getByText('7 unread')).toBeInTheDocument()
    })

    it('marks one notification read and removes it from the unread-only view', async () => {
        render(<NotificationsPage />)
        expect(await screen.findByText('Portrait ready')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Unread only' }))
        await waitFor(() => expect(apiService.listNotifications).toHaveBeenLastCalledWith({ unreadOnly: true, limit: 100 }))
        fireEvent.click(screen.getByRole('button', { name: 'Mark read' }))

        await waitFor(() => expect(apiService.markNotificationRead).toHaveBeenCalledWith(1))
        expect(await screen.findByText('You are all caught up')).toBeInTheDocument()
        expect(screen.getByText('0 unread')).toBeInTheDocument()
    })

    it('marks every notification read and updates the visible state', async () => {
        listedItems = [
            notification(),
            notification({ notification_id: 2, title: 'Credits added', category: 'credits' }),
        ]
        serverUnreadCount = 2
        vi.mocked(apiService.markAllNotificationsRead).mockResolvedValue({ updated: 2 })

        render(<NotificationsPage />)
        expect(await screen.findByText('Credits added')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))

        await waitFor(() => expect(apiService.markAllNotificationsRead).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(screen.queryByText('New')).not.toBeInTheDocument())
        expect(screen.getByText('0 unread')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled()
    })

    it('dismisses a notification and decrements the unread count', async () => {
        render(<NotificationsPage />)
        expect(await screen.findByText('Portrait ready')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))

        await waitFor(() => expect(apiService.dismissNotification).toHaveBeenCalledWith(1))
        expect(await screen.findByText('No notifications yet')).toBeInTheDocument()
        expect(screen.getByText('0 unread')).toBeInTheDocument()
    })

    it('marks actionable notifications read before routing their destinations', async () => {
        listedItems = [
            notification({
                notification_id: 1,
                title: 'Character updated',
                action_label: 'View character',
                action_url: 'https://magic-worlds.test/#/gallery/characters?card=c1',
            }),
            notification({
                notification_id: 2,
                title: 'Theme song ready',
                action_label: 'View tasks',
                metadata: { job_kind: 'theme_song' },
            }),
            notification({
                notification_id: 3,
                title: 'Image ready',
                action_label: 'View image',
                metadata: { job_kind: 'image' },
            }),
        ]
        serverUnreadCount = 3

        render(<NotificationsPage />)
        expect(await screen.findByText('Image ready')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'View character' }))
        await waitFor(() => expect(setPage).toHaveBeenCalledWith(
            'gallery-characters',
            { hash: '#/gallery/characters?card=c1' },
        ))

        fireEvent.click(screen.getByRole('button', { name: 'View tasks' }))
        await waitFor(() => expect(openTasks).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByRole('button', { name: 'View image' }))
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('gallery-media'))
        expect(apiService.markNotificationRead).toHaveBeenCalledWith(1)
        expect(apiService.markNotificationRead).toHaveBeenCalledWith(2)
        expect(apiService.markNotificationRead).toHaveBeenCalledWith(3)
    })
})
