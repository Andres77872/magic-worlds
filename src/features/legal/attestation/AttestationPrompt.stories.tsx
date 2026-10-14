import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '@/ui/primitives'
import { AttestationPrompt, type AttestationPromptProps } from './AttestationPrompt'

function PromptDemo(props: AttestationPromptProps) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open the prompt</Button>
      {open && (
        <AttestationPrompt
          {...props}
          onConfirm={(accepted) => { props.onConfirm(accepted); setOpen(false) }}
          onDecline={() => { props.onDecline(); setOpen(false) }}
        />
      )}
    </>
  )
}

const meta = {
  title: 'Features/Legal/AttestationPrompt',
  component: AttestationPrompt,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The blocking 18+ and Terms of Service prompt (D26). `login` mode is non-dismissible: the account attests or signs out. `voice` mode opens when a voice action is refused with `attestation_required` and offers "Not now". The boxes start unticked and Confirm stays disabled until every shown box is ticked. Ember marks the one action; nothing here is AI-generated, so there is no arcane.',
      },
    },
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['login', 'voice'] },
    kinds: { control: false },
    termsVersion: { control: 'text', description: 'The Terms version asked for. A version the SPA does not ship cannot be confirmed.' },
    notice: { control: 'text', description: 'Why the prompt asks again (e.g. the Terms version changed).' },
    submitting: { control: 'boolean' },
    error: { control: 'text' },
    onConfirm: { action: 'confirmed' },
    onDecline: { action: 'declined' },
  },
  args: {
    mode: 'login',
    kinds: ['age_18_plus', 'terms_of_service'],
    termsVersion: 'tos-v1',
    notice: null,
    submitting: false,
    error: null,
    onConfirm: () => {},
    onDecline: () => {},
  },
  render: (args) => <PromptDemo {...args} />,
} satisfies Meta<typeof AttestationPrompt>

export default meta
type Story = StoryObj<typeof meta>

/** An existing or Google account with nothing accepted: both boxes, sign out as the only way out. */
export const Login: Story = {}

/** A narration clip or call start was refused for the attestation. */
export const Voice: Story = { args: { mode: 'voice' } }

/** The Terms version changed: only the Terms box is asked again. */
export const TermsUpdated: Story = { args: { kinds: ['terms_of_service'] } }

/** The version changed while the prompt was open: the new version is shown, with why it asks again. */
export const TermsChangedWhileOpen: Story = {
  args: { kinds: ['terms_of_service'], notice: 'The Terms of Service were updated. Review this version and confirm again.' },
}

/**
 * The server requires a Terms version this build does not ship: a voice action
 * cannot be confirmed until it does. Sign-in never asks for it, so the app stays usable.
 */
export const TermsUnavailable: Story = { args: { mode: 'voice', termsVersion: 'tos-v99' } }

/** The confirmation could not be saved. */
export const SaveFailed: Story = { args: { error: 'Your confirmation could not be saved. Try again in a moment.' } }
