import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import type { User } from '@/shared'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ApiStatusContext } from '@/app/providers/apiStatusContext'
import { BackgroundTasksContext } from '@/app/providers/backgroundTasksContext'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { MobileTopBar } from './MobileTopBar'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type BackgroundTasksValue = NonNullable<ComponentProps<typeof BackgroundTasksContext.Provider>['value']>

const baseAuth: AuthValue = {
  isAuthenticated: false,
  user: null,
  token: null,
  projects: [],
  isLoading: false,
  error: null,
  isLoginModalOpen: false,
  login: async () => false,
  register: async () => false,
  loginWithGoogle: async () => {},
  completeGoogleLogin: async () => false,
  logout: () => {},
  updateUser: () => {},
  clearError: () => {},
  openLoginModal: () => {},
  closeLoginModal: () => {},
}

const mockUser: User = {
  user_hash: 'u_lyra',
  username: 'Lyra the Bard',
  email: null,
  user_type: 'player',
  created_at: null,
  updated_at: null,
}

const noTasks: BackgroundTasksValue = {
  tasks: [],
  taskBuckets: { active: [], completed: [], failed: [] },
  activeTasks: [],
  activeCount: 0,
  drawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  refreshTasks: async () => {},
  registerTask: () => {},
  registerThemeSongJob: () => {},
  cancelTask: async () => {},
}

/** Wrap the bar in real Navigation context + mocked Auth / background-tasks context. */
const withProviders = (auth: AuthValue, tasks: BackgroundTasksValue): Decorator =>
  function Provided(Story) {
    return (
      <NavigationProvider>
        <AuthContext.Provider value={auth}>
          <ApiStatusContext.Provider value={{ status: 'online' }}>
            <BackgroundTasksContext.Provider value={tasks}>
              <div style={{ minHeight: 320, background: 'var(--color-ink-800)' }}>
                <Story />
                <div className="p-6 font-narrative text-parchment-400">
                  <p className="max-w-prose">
                    Below the <code>lg</code> breakpoint the docked rail is hidden and this sticky bar takes over:
                    hamburger (opens the nav drawer) · brand (home) · account menu. The hamburger badge counts active
                    background tasks.
                  </p>
                </div>
              </div>
            </BackgroundTasksContext.Provider>
          </ApiStatusContext.Provider>
        </AuthContext.Provider>
      </NavigationProvider>
    )
  }

const meta = {
  title: 'Components/MobileTopBar',
  component: MobileTopBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Sticky mobile chrome shown below the `lg` breakpoint where the docked rail is hidden. Resize the preview narrow (or use a mobile viewport) to see it — it is `lg:hidden`. Consumes Navigation + Auth + background-tasks context (mocked here).',
      },
    },
  },
  argTypes: {
    onOpenNav: { action: 'open-nav', description: 'Called by the hamburger to open the SidebarNavDrawer.' },
  },
  args: {
    onOpenNav: () => {},
  },
} satisfies Meta<typeof MobileTopBar>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = { decorators: [withProviders(baseAuth, noTasks)] }

export const SignedIn: Story = {
  decorators: [withProviders({ ...baseAuth, isAuthenticated: true, user: mockUser }, noTasks)],
}

/** The hamburger shows a count badge while background tasks are running. */
export const WithActiveTasks: Story = {
  decorators: [
    withProviders(
      { ...baseAuth, isAuthenticated: true, user: mockUser },
      { ...noTasks, activeCount: 3 },
    ),
  ],
}
