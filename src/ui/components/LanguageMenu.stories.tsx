import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { LanguageMenu } from './LanguageMenu'

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

// The menu anchors bottom-left of the rail button and rises upward, so give the
// canvas room and pin the trigger to the bottom of the frame.
const withAuth = (value: AuthValue): Decorator =>
    (Story) => (
        <AuthContext.Provider value={value}>
            <div className="relative flex min-h-[18rem] w-[14rem] items-end">
                <Story />
            </div>
        </AuthContext.Provider>
    )

const meta = {
    title: 'Components/LanguageMenu',
    component: LanguageMenu,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Lightweight language switcher anchored to the sidebar language button — a popover menu (not a modal) that rises in with the app overlay motion. Lists each locale by its native name, marks the active one with an ember check, and notes whether the choice is saved to the account or only this device.',
            },
        },
    },
    decorators: [withAuth(baseAuth)],
    argTypes: {
        collapsed: { control: 'boolean' },
        defaultOpen: { control: 'boolean' },
    },
    args: { collapsed: false, defaultOpen: true },
} satisfies Meta<typeof LanguageMenu>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {}

export const SignedIn: Story = {
    decorators: [withAuth({ ...baseAuth, isAuthenticated: true, token: 'demo' })],
}

export const Collapsed: Story = {
    args: { collapsed: true },
}
