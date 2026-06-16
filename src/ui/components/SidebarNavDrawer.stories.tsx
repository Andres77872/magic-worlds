import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import type { User } from '@/shared'
import { AuthContext } from '@/app/providers/AuthProvider'
import { ApiStatusContext } from '@/app/providers/apiStatusContext'
import { BackgroundTasksContext } from '@/app/providers/backgroundTasksContext'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { Button } from '../primitives'
import { SidebarNavDrawer } from './SidebarNavDrawer'

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

const backgroundTasks: BackgroundTasksValue = {
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

const withProviders = (auth: AuthValue): Decorator =>
  function Provided(Story) {
    return (
      <NavigationProvider>
        <AuthContext.Provider value={auth}>
          <ApiStatusContext.Provider value={{ status: 'online' }}>
            <BackgroundTasksContext.Provider value={backgroundTasks}>
              <Story />
            </BackgroundTasksContext.Provider>
          </ApiStatusContext.Provider>
        </AuthContext.Provider>
      </NavigationProvider>
    )
  }

const meta = {
  title: 'Components/SidebarNavDrawer',
  component: SidebarNavDrawer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Off-canvas mobile form of the sidebar, shown below the `lg` breakpoint where the permanent rail is hidden. Opened from the MobileTopBar hamburger; slides in from the left over a dim+blur scrim and renders the always-labelled `SidebarShell` panel. It is `lg:hidden` and force-closes when the viewport crosses back to the docked breakpoint (≥1024px), so view these stories in a narrow / mobile viewport — at desktop width the drawer will not stay open.',
      },
    },
  },
  argTypes: {
    open: { control: false },
    onClose: { action: 'close', description: 'Called by the scrim, Escape, navigation, or breakpoint cross-over.' },
  },
  // Required props are satisfied here; each story drives open/close via its own render state.
  args: {
    open: false,
    onClose: () => {},
  },
} satisfies Meta<typeof SidebarNavDrawer>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Trigger-driven demo: click "Open navigation" to slide the drawer in. Use a
 * narrow / mobile viewport — at the `lg` breakpoint (≥1024px) the drawer
 * force-closes itself, mirroring the real docked-layout cutover.
 */
export const Default: Story = {
  decorators: [withProviders({ ...baseAuth, isAuthenticated: true, user: mockUser })],
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <div className="min-h-[480px] p-6" style={{ background: 'var(--color-ink-800)' }}>
        <Button onClick={() => setOpen(true)}>Open navigation</Button>
        <p className="mt-4 max-w-prose font-narrative text-sm text-parchment-400">
          Resize the preview to a mobile width before opening — the drawer is <code>lg:hidden</code> and closes
          itself above 1024px.
        </p>
        <SidebarNavDrawer open={open} onClose={() => setOpen(false)} />
      </div>
    )
  },
}

/** Signed-out variant — gated nav items prompt sign-in instead of navigating. */
export const SignedOut: Story = {
  decorators: [withProviders(baseAuth)],
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <div className="min-h-[480px] p-6" style={{ background: 'var(--color-ink-800)' }}>
        <Button onClick={() => setOpen(true)}>Open navigation</Button>
        <SidebarNavDrawer open={open} onClose={() => setOpen(false)} />
      </div>
    )
  },
}
