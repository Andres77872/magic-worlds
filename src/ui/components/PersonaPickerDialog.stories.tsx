import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { Button } from '../primitives'
import { characters } from './lists/fixtures'
import { PersonaPickerDialog } from './PersonaPickerDialog'

const meta = {
  title: 'Components/PersonaPickerDialog',
  component: PersonaPickerDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Choose which character you play *as* before entering a scene. Lists persona-eligible characters with ember (player) / arcane (AI) avatar rings; the default persona is preselected. Built on the Modal primitive — confirm or cancel from the footer.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    actionLabel: { control: 'text' },
    description: { control: 'text' },
    error: { control: 'text' },
    isConfirming: { control: 'boolean' },
    open: { control: false },
    characters: { control: false },
    onConfirm: { control: false },
    onClose: { control: false },
    onCreateCharacter: { control: false },
  },
  args: {
    title: 'Choose your persona',
    actionLabel: 'Enter the scene',
    description: 'Pick the character you’ll play as. You can switch later.',
    isConfirming: false,
    open: false,
    characters,
    onConfirm: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof PersonaPickerDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Stories render a trigger; the picker opens into its own scrim. */
function PickerDemo(props: Partial<ComponentProps<typeof PersonaPickerDialog>>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Choose persona</Button>
      <PersonaPickerDialog
        title="Choose your persona"
        actionLabel="Enter the scene"
        characters={characters}
        {...props}
        open={open}
        onConfirm={() => setOpen(false)}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

export const Default: Story = { render: (args) => <PickerDemo {...args} /> }

export const WithError: Story = {
  args: { error: 'That character can’t join this scene.' },
  render: (args) => <PickerDemo {...args} />,
}

export const Empty: Story = {
  args: { characters: [], onCreateCharacter: () => {} },
  render: (args) => <PickerDemo {...args} />,
}
