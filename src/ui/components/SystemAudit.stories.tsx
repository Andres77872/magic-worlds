/** Real account/system surfaces with isolated, offline data for visual review. */
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps, ReactNode } from 'react'
import { useState } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { BackgroundTasksContext, type BackgroundTasksContextValue } from '@/app/providers/backgroundTasksContext'
import { apiService } from '@/infrastructure/api'
import { BillingPage } from '@/features/billing/components/BillingPage'
import { NotificationsPage } from '@/features/notifications/components/NotificationsPage'
import { ProfilePage } from '@/features/profile/components/ProfilePage'
import { ProfileView, type ProfileTab } from '@/features/profile/components/ProfileView'
import { DeleteDataDialog } from '@/features/profile/components/DeleteDataDialog'
import { baseProfile } from '@/features/profile/components/ProfileView.stories'
import { TasksDrawer } from '@/features/tasks/components/TasksDrawer'
import type { BackgroundTaskPublic, SharedCardResource, UserNotification } from '@/shared'
import { DataLoadErrorBanner } from './DataLoadErrorBanner'
import { ErrorBoundary } from '@/app/ErrorBoundary'

type State = 'ready' | 'loading' | 'error' | 'empty' | 'guest' | 'unavailable'
type Surface = 'profile' | 'billing' | 'notifications' | 'tasks' | 'data-error' | 'delete-data' | 'page-error'
type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>
const sharedCards: SharedCardResource[] = [{ card_type: 'character', original_card_id: 'preview-shared', share_token: 'preview-local-only', card: { id: 'preview-shared', name: 'The archivist at the library beyond the edge of the known world', description: 'A keeper of stories.', category: [] } }]
const noop = () => {}
const blocked = async () => { throw new Error('Offline preview: no changes were sent to the server.') }
const notifications: UserNotification[] = ['success', 'warning', 'error', 'info'].map((severity, index) => ({
    notification_id: index + 1, type: 'generation', category: 'media', severity: severity as UserNotification['severity'],
    title: ['Your illustration is ready', 'Daily credits are running low', 'A song could not be completed', 'Welcome to Reverie'][index],
    body: ['The sunken library is waiting in your media collection.', 'You have five included credits remaining today.', 'Your credits were returned. You can try again from the creation studio.', 'Create your first character and begin a conversation.'][index],
    action_label: index === 0 ? 'View illustration' : null, action_url: index === 0 ? '#/gallery-media' : null,
    metadata: null, read_at: index > 1 ? '2026-09-18T18:00:00Z' : null, created_at: '2026-09-18T12:00:00Z', expires_at: null,
}))
const tasks: BackgroundTaskPublic[] = ['synthesizing', 'completed', 'failed'].map((status, index) => ({
    task_id: `preview-${index}`, operation: 'theme_song', status: status as BackgroundTaskPublic['status'],
    target: { type: 'character', id: 'preview', display_name: 'The archive keeper' }, title: 'A lantern in the rain',
    status_url: '', result_url: '', cancel_url: null,
    result: status === 'completed' ? { assets: [] } : null,
    error: status === 'failed' ? { category: 'timeout', detail: 'The generation service timed out. Try again.' } : null,
    created_at: '2026-09-18T12:00:00Z', updated_at: '2026-09-18T12:02:00Z',
}))

function installOfflineApi(state: State) {
    const target = apiService as unknown as Record<string, unknown>
    const originals = new Map<string, PropertyDescriptor | undefined>()
    for (const key of new Set([...Object.getOwnPropertyNames(Object.getPrototypeOf(apiService)), ...Object.keys(target)])) {
        if (key === 'constructor' || typeof target[key] !== 'function') continue
        originals.set(key, Object.getOwnPropertyDescriptor(apiService, key))
        target[key] = blocked
    }
    const load = async <T,>(value: T): Promise<T> => {
        if (state === 'loading') return new Promise<T>(() => {})
        if (state === 'error') throw new Error('The service is temporarily unavailable. Please try again.')
        return value
    }
    Object.assign(target, {
        getUserProfile: () => load(baseProfile),
        getBillingPlans: () => load({ enabled: state !== 'unavailable', plans: [
            { plan_code: 'free', display_name: 'Free', monthly_price_cents: 0, daily_credit_limit: 50, kind: 'subscription' },
            { plan_code: 'plus', display_name: 'Plus', monthly_price_cents: 999, daily_credit_limit: 100, kind: 'subscription' },
            { plan_code: 'pro', display_name: 'Pro', monthly_price_cents: 2499, daily_credit_limit: 500, kind: 'subscription' },
        ], credit_packs: [{ credit_product_code: 'preview', display_name: '100 credits', credits: 100, price_cents: 500, kind: 'credit_pack' }] }),
        listEmails: () => load({ emails: state === 'empty' ? [] : [{ id: '1', email: 'reader@example.com', is_primary: true, status: 'activated' }] }),
        listEmailCreditGrantOffers: () => load({ offers: [], total_credits: 0 }),
        listMyPublicCards: () => load({ items: [] }),
        listMyShareLinks: () => load({ items: [] }),
        listNotifications: () => load({ items: state === 'empty' ? [] : notifications, limit: 20, offset: 0 }),
        getNotificationUnreadCount: () => load({ unread_count: state === 'empty' ? 0 : 2 }),
    })
    return () => {
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(apiService, key, descriptor)
            else delete target[key]
        }
    }
}

function Providers({ children, state }: { children: ReactNode; state: State }) {
    const [drawerOpen, setDrawerOpen] = useState(true)
    const buckets = { active: state === 'empty' ? [] : tasks.slice(0, 1), completed: state === 'empty' ? [] : tasks.slice(1, 2), failed: state === 'empty' ? [] : tasks.slice(2) }
    const background: BackgroundTasksContextValue = {
        tasks: state === 'empty' ? [] : tasks, taskBuckets: buckets, activeTasks: buckets.active, activeCount: buckets.active.length,
        drawerOpen, openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false),
        refreshTasks: async () => {}, registerTask: noop, registerThemeSongJob: noop, cancelTask: blocked, clearTerminalTasks: blocked,
        terminalHasMore: { completed: false, failed: false }, loadMoreTerminalTasks: async () => {},
    }
    const auth = { isAuthenticated: state !== 'guest', user: { user_hash: 'preview', username: 'Lyra', user_type: 'consumer' },
        token: null, isLoading: false, error: null, projects: [], sessionPhase: state === 'guest' ? 'signed_out' : 'authenticated',
        authEpoch: 0, accountKey: 'preview', userHash: 'preview', isLoginModalOpen: false,
        openLoginModal: noop, closeLoginModal: noop, updateUser: noop, logout: async () => {},
    } as unknown as AuthValue
    const data = { characters: [], worlds: [], items: [], templateAdventures: [], loadingState: { isLoading: false, error: 'Preview connection lost' }, loadData: async () => {}, clearAllData: blocked } as unknown as DataValue
    return <NavigationProvider><AuthContext.Provider value={auth}><DataContext.Provider value={data}><BackgroundTasksContext.Provider value={background}>{children}</BackgroundTasksContext.Provider></DataContext.Provider></AuthContext.Provider></NavigationProvider>
}

function FailedPage(): ReactNode { throw new Error('Offline preview of the error boundary') }

function SystemAudit({ surface, state = 'ready', tab, populatedSharing = false }: { surface: Surface; state?: State; tab?: ProfileTab; populatedSharing?: boolean }) {
    return <div className="-m-6"><Providers state={state}>
        {surface === 'profile' && (tab
            ? <ProfileView profile={baseProfile} initialTab={tab} onLogout={noop} onDeleteAllData={blocked} sharing={{ publicCards: populatedSharing ? sharedCards : [], shareLinks: populatedSharing ? sharedCards : [], isLoading: false, error: null, refresh: noop }} />
            : <ProfilePage />)}
        {surface === 'billing' && <BillingPage />}
        {surface === 'notifications' && <NotificationsPage />}
        {surface === 'tasks' && <TasksDrawer />}
        {surface === 'data-error' && <DataLoadErrorBanner />}
        {surface === 'delete-data' && <DeleteDataDialog open username="Lyra" onClose={noop} onConfirm={blocked} />}
        {surface === 'page-error' && <ErrorBoundary inline={state !== 'unavailable'}><FailedPage /></ErrorBoundary>}
    </Providers></div>
}

const meta = {
    title: 'Audit/System', component: SystemAudit, parameters: { layout: 'fullscreen' },
    args: { surface: 'profile', state: 'ready' },
    beforeEach: ({ args }) => installOfflineApi(args.state ?? 'ready'),
} satisfies Meta<typeof SystemAudit>
export default meta
type Story = StoryObj<typeof meta>
export const ProfileMembership: Story = { args: { tab: 'membership' } }
export const ProfileUsage: Story = { args: { tab: 'usage' } }
export const ProfileSharing: Story = { args: { tab: 'sharing' } }
export const ProfileAccount: Story = { args: { tab: 'account' } }
export const ProfileSecurity: Story = { args: { tab: 'security' } }
export const ProfileLoading: Story = { args: { state: 'loading' } }
export const ProfileError: Story = { args: { state: 'error' } }
export const ProfileGuest: Story = { args: { state: 'guest' } }
export const Billing: Story = { args: { surface: 'billing' } }
export const BillingLoading: Story = { args: { surface: 'billing', state: 'loading' } }
export const BillingError: Story = { args: { surface: 'billing', state: 'error' } }
export const BillingUnavailable: Story = { args: { surface: 'billing', state: 'unavailable' } }
export const BillingGuest: Story = { args: { surface: 'billing', state: 'guest' } }
export const Notifications: Story = { args: { surface: 'notifications' } }
export const NotificationsLoading: Story = { args: { surface: 'notifications', state: 'loading' } }
export const NotificationsError: Story = { args: { surface: 'notifications', state: 'error' } }
export const NotificationsEmpty: Story = { args: { surface: 'notifications', state: 'empty' } }
export const Tasks: Story = { args: { surface: 'tasks' } }
export const TasksEmpty: Story = { args: { surface: 'tasks', state: 'empty' } }
export const DataError: Story = { args: { surface: 'data-error' } }
export const DeleteData: Story = { args: { surface: 'delete-data' } }
export const PageError: Story = { args: { surface: 'page-error' } }
export const AppError: Story = { args: { surface: 'page-error', state: 'unavailable' } }

export const ProfileSharingPopulated: Story = { args: { tab: 'sharing', populatedSharing: true } }
