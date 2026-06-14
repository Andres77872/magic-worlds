import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { LanguageContext, type LanguageContextValue } from '@/app/providers/languageContext'
import { SUPPORTED_LANGUAGE_OPTIONS } from '@/app/i18n'
import { Button } from '../primitives'
import { LanguageSelectorDialog } from './LanguageSelectorDialog'

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

const meta = {
  title: 'Components/LanguageSelectorDialog',
  component: LanguageSelectorDialog,
  tags: ['autodocs'],
  decorators: [withAuth],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Pick the interface language (English / Español). Wraps the Select primitive in a Modal; the choice persists to the account when signed in, otherwise to this device. Auth and i18n are mocked here, so switching only updates the in-iframe locale.',
      },
    },
  },
  argTypes: {
    open: { control: false },
    onClose: { control: false },
  },
  args: { open: false, onClose: () => {} },
} satisfies Meta<typeof LanguageSelectorDialog>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Change language</Button>
      <LanguageSelectorDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export const Default: Story = { render: () => <Demo /> }

const syncingLanguage: LanguageContextValue = {
  language: 'es',
  option: SUPPORTED_LANGUAGE_OPTIONS[1],
  intlLocale: 'es-MX',
  isSyncing: true,
  syncError: null,
  setLanguage: async () => {},
}

/** While the choice is saving to the account, the select disables and a "saving…" line shows. */
export const Syncing: Story = {
  render: () => (
    <LanguageContext.Provider value={syncingLanguage}>
      <Demo />
    </LanguageContext.Provider>
  ),
}
