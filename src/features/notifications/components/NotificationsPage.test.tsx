import { fireEvent, render as baseRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackgroundTaskPublic, UserNotification } from '@/shared'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { NotificationsPage } from './NotificationsPage'

const setPage = vi.fn()
const openTasks = vi.fn()
const trackTask = vi.fn()
const navigateToOrigin = vi.fn()
let trackedTasks: BackgroundTaskPublic[] = []

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true }),
    useNavigation: () => ({ setPage }),
    useBackgroundTasks: () => ({ openDrawer: openTasks, tasks: trackedTasks, trackTask }),
}))

vi.mock('@/features/workspaces/originNavigation', () => ({
    useOriginNavigation: () => ({ navigateToOrigin, registerOriginNavigator: () => () => {} }),
}))

const render = (ui: ReactElement) => baseRender(<WorkspaceTestProvider state={createWorkspaceTestState()}>{ui}</WorkspaceTestProvider>)

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
        trackedTasks = []
        navigateToOrigin.mockResolvedValue('navigated')
        trackTask.mockResolvedValue(undefined)
        listedItems = [notification()]
        serverUnreadCount = 1
        vi.mocked(apiService.listNotifications).mockImplementation(async () => ({
            items: listedItems,
            limit: 20,
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

    it('loads the stored list and unread-count endpoints', async () => {
        serverUnreadCount = 7

        render(<NotificationsPage />)

        expect(await screen.findByText('Portrait ready')).toBeInTheDocument()
        expect(apiService.listNotifications).toHaveBeenCalledWith({ unreadOnly: false, limit: 20, offset: 0 })
        expect(apiService.getNotificationUnreadCount).toHaveBeenCalledTimes(1)
        expect(screen.getByText('7 unread')).toBeInTheDocument()
    })

    it('loads the next notification page on demand', async () => {
        const firstPage = Array.from({ length: 20 }, (_, index) =>
            notification({ notification_id: index + 1, title: `Notice ${index + 1}` }),
        )
        vi.mocked(apiService.listNotifications)
            .mockResolvedValueOnce({ items: firstPage, limit: 20, offset: 0 })
            .mockResolvedValueOnce({
                items: [notification({ notification_id: 21, title: 'Notice 21' })],
                limit: 20,
                offset: 20,
            })

        render(<NotificationsPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))

        expect(await screen.findByText('Notice 21')).toBeInTheDocument()
        expect(apiService.listNotifications).toHaveBeenLastCalledWith({
            unreadOnly: false,
            limit: 20,
            offset: 20,
        })
    })

    it('marks one notification read and removes it from the unread-only view', async () => {
        render(<NotificationsPage />)
        expect(await screen.findByText('Portrait ready')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Unread only' }))
        await waitFor(() => expect(apiService.listNotifications).toHaveBeenLastCalledWith({ unreadOnly: true, limit: 20, offset: 0 }))
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

    it('marks content notices read and opens them in their origin workspace', async () => {
        listedItems = [
            notification({
                notification_id: 1,
                title: 'Character updated',
                action_label: 'View character',
                action_url: 'https://magic-worlds.test/#/gallery/characters?card=c1',
                metadata: { workspace_id: TEST_WORKSPACE_ID },
            }),
            notification({
                notification_id: 2,
                title: 'Theme song ready',
                action_label: 'View tasks',
                metadata: { job_kind: 'theme_song', job_id: 'job-2', workspace_id: OTHER_WORKSPACE_ID },
            }),
            notification({
                notification_id: 3,
                title: 'Image ready',
                action_label: 'View image',
                metadata: { job_kind: 'image', job_id: 'job-3', workspace_id: OTHER_WORKSPACE_ID },
            }),
        ]
        serverUnreadCount = 3

        render(<NotificationsPage />)
        expect(await screen.findByText('Image ready')).toBeInTheDocument()
        // Only notices of another workspace are labeled.
        expect(screen.getAllByText('From Novel A')).toHaveLength(2)

        fireEvent.click(screen.getByRole('button', { name: 'View character' }))
        await waitFor(() => expect(navigateToOrigin).toHaveBeenCalledWith({
            workspaceId: TEST_WORKSPACE_ID,
            page: 'gallery-characters',
            hash: '#/gallery/characters?card=c1',
        }))

        // A theme song of another workspace is read there and shown in the account-wide drawer.
        fireEvent.click(screen.getByRole('button', { name: 'View tasks' }))
        await waitFor(() => expect(openTasks).toHaveBeenCalledTimes(1))
        expect(trackTask).toHaveBeenCalledWith('theme_song', 'job-2', OTHER_WORKSPACE_ID)

        fireEvent.click(screen.getByRole('button', { name: 'View image' }))
        await waitFor(() => expect(navigateToOrigin).toHaveBeenCalledWith({ workspaceId: OTHER_WORKSPACE_ID, page: 'gallery-media' }))
        expect(setPage).not.toHaveBeenCalled()
        expect(apiService.markNotificationRead).toHaveBeenCalledWith(1)
        expect(apiService.markNotificationRead).toHaveBeenCalledWith(2)
        expect(apiService.markNotificationRead).toHaveBeenCalledWith(3)
    })

    it('never opens a legacy content notice in the selected workspace', async () => {
        listedItems = [notification({ notification_id: 4, title: 'Old image', action_label: 'View image', metadata: { job_kind: 'image', job_id: 'job-4' } })]

        render(<NotificationsPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'View image' }))

        expect(await screen.findByText('This item is no longer available. Its workspace may have been removed.')).toBeInTheDocument()
        expect(navigateToOrigin).not.toHaveBeenCalled()
        expect(setPage).not.toHaveBeenCalled()
    })

    it('resolves a legacy notice through a job this client tracks', async () => {
        trackedTasks = [{ task_id: 'job-5', operation: 'theme_song', organization: { workspace_id: OTHER_WORKSPACE_ID } } as BackgroundTaskPublic]
        listedItems = [notification({ notification_id: 5, title: 'Old image', action_label: 'View image', metadata: { job_kind: 'image', job_id: 'job-5' } })]

        render(<NotificationsPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'View image' }))

        await waitFor(() => expect(navigateToOrigin).toHaveBeenCalledWith({ workspaceId: OTHER_WORKSPACE_ID, page: 'gallery-media' }))
    })

    it('explains when the origin workspace is unavailable', async () => {
        navigateToOrigin.mockResolvedValue('unavailable')
        listedItems = [notification({ notification_id: 6, action_label: 'View image', metadata: { job_kind: 'image', workspace_id: OTHER_WORKSPACE_ID } })]

        render(<NotificationsPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'View image' }))

        expect(await screen.findByText('This item is no longer available. Its workspace may have been removed.')).toBeInTheDocument()
    })

    it('keeps account notices on plain navigation', async () => {
        listedItems = [notification({ notification_id: 7, title: 'Plan renewed', category: 'membership', action_label: 'View plan', action_url: '/#/profile' })]

        render(<NotificationsPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'View plan' }))

        await waitFor(() => expect(setPage).toHaveBeenCalledWith('profile', { hash: '#/profile' }))
        expect(navigateToOrigin).not.toHaveBeenCalled()
    })
})
