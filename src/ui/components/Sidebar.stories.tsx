import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import type { User } from '@/shared'
import { AuthContext } from '@/app/providers/AuthProvider'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { Sidebar } from './Sidebar'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>

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
  logout: () => {},
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

/** Wrap the rail in real Navigation context + a mocked Auth context. */
const withProviders = (auth: AuthValue): Decorator =>
  function Provided(Story) {
    return (
      <NavigationProvider>
        <AuthContext.Provider value={auth}>
          <div style={{ display: 'flex', minHeight: 480, background: 'var(--color-ink-800)' }}>
            <Story />
            <div className="flex-1 p-8 font-narrative text-parchment-400">
              <p className="max-w-prose">
                The icon rail anchors the app — brand at the top, primary nav in the middle, source &amp; account
                at the bottom. Hover an item for its tooltip; gated items prompt sign-in when signed out.
              </p>
            </div>
          </div>
        </AuthContext.Provider>
      </NavigationProvider>
    )
  }

const meta = {
  title: 'Components/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Full-height icon rail. Consumes Navigation + Auth context (mocked in these stories). Gated nav items open the login modal when signed out.' } },
  },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = { decorators: [withProviders(baseAuth)] }

export const SignedIn: Story = {
  decorators: [withProviders({ ...baseAuth, isAuthenticated: true, user: mockUser })],
}
