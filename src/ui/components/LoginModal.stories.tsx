import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { Button } from '../primitives'
import { LoginModal } from './LoginModal'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>

const guestAuth: AuthValue = {
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
  clearError: () => {},
  openLoginModal: () => {},
  closeLoginModal: () => {},
}

const withAuth: Decorator = function Provided(Story) {
  return (
    <AuthContext.Provider value={guestAuth}>
      <Story />
    </AuthContext.Provider>
  )
}

function LoginModalDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open login</Button>
      <LoginModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}

const meta = {
  title: 'Components/LoginModal',
  component: LoginModal,
  tags: ['autodocs'],
  decorators: [withAuth],
  parameters: {
    layout: 'centered',
    docs: { description: { component: 'Login / register modal built on the Modal primitive — mode toggle, password reveal, and an alpha-version notice. Auth is mocked here, so submitting is a no-op.' } },
  },
  argTypes: {
    isOpen: { control: false },
    onClose: { control: false },
  },
  args: { isOpen: false, onClose: () => {} },
} satisfies Meta<typeof LoginModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <LoginModalDemo /> }
