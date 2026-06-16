import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import type { User } from '@/shared'
import { AuthContext } from '@/app/providers/AuthProvider'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { SidebarAccountMenu } from './SidebarAccountMenu'

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
    username: 'lyra_bard',
    display_name: 'The Loremaster',
    email: null,
    user_type: 'player',
    created_at: null,
    updated_at: null,
}

// The `rise` menu anchors bottom-left of the avatar and opens upward, so give the
// canvas room and pin the trigger to the bottom of the frame.
const withProviders = (value: AuthValue): Decorator =>
    (Story) => (
        <NavigationProvider>
            <AuthContext.Provider value={value}>
                <div className="relative flex min-h-[26rem] w-[14rem] items-end">
                    <Story />
                </div>
            </AuthContext.Provider>
        </NavigationProvider>
    )

const meta = {
    title: 'Components/SidebarAccountMenu',
    component: SidebarAccountMenu,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Account & settings popover behind the sidebar avatar. Consolidates the low-frequency identity / settings / meta actions (Profile, Language, Docs, View source, root admin links, Log out) that used to stack as separate rail rows. Rendered in both auth states so Docs / View source / Language stay reachable when signed out.',
            },
        },
    },
    decorators: [withProviders(baseAuth)],
    argTypes: {
        collapsed: { control: 'boolean' },
        placement: { control: 'inline-radio', options: ['rise', 'drop'] },
        defaultOpen: { control: 'boolean' },
    },
    args: { collapsed: false, placement: 'rise', defaultOpen: true },
} satisfies Meta<typeof SidebarAccountMenu>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {}

export const SignedIn: Story = {
    decorators: [withProviders({ ...baseAuth, isAuthenticated: true, token: 'demo', user: mockUser })],
}

export const SignedInRoot: Story = {
    decorators: [
        withProviders({ ...baseAuth, isAuthenticated: true, token: 'demo', user: { ...mockUser, user_type: 'root' } }),
    ],
}

export const Collapsed: Story = {
    args: { collapsed: true },
    decorators: [withProviders({ ...baseAuth, isAuthenticated: true, token: 'demo', user: mockUser })],
}
