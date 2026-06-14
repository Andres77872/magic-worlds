import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardOptions, type CardOption } from './CardOptions'

const sampleOptions: CardOption[] = [
  { type: 'open', label: 'Open', onClick: () => {} },
  { type: 'edit', label: 'Edit', onClick: () => {} },
  { type: 'start', label: 'Start adventure', onClick: () => {} },
  { type: 'delete', label: 'Delete', onClick: () => {}, separatorBefore: true },
]

const meta = {
  title: 'Components/Lists/CardOptions',
  component: CardOptions,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Per-card action menu. The trigger is the Reverie kebab IconButton; a single option collapses to one labelled icon button. The panel portals to body at the popover z-rung (z-[100]) with click-outside, arrow-key, Home/End and Escape handling. Highlight actions (open / edit / start) read ember; delete reads blood.',
      },
    },
  },
  argTypes: {
    align: { control: 'inline-radio', options: ['left', 'right'], description: 'Which edge the menu aligns to.' },
    disabled: { control: 'boolean' },
    forceMenu: { control: 'boolean', description: 'Force the dropdown even when there is only one option.' },
    options: { control: false },
    onOpenChange: { action: 'open-change' },
  },
  args: { options: sampleOptions, align: 'right', disabled: false, forceMenu: false },
} satisfies Meta<typeof CardOptions>

export default meta
type Story = StoryObj<typeof meta>

/** Click the kebab to open the menu — open/edit/start read ember, delete reads blood. */
export const Default: Story = {}

/** A single option collapses to one labelled icon button (no dropdown). */
export const SingleOption: Story = {
  args: { options: [{ type: 'edit', label: 'Edit character', onClick: () => {} }] },
}

/** The same single option, forced into the dropdown panel. */
export const ForcedMenu: Story = {
  args: { options: [{ type: 'edit', label: 'Edit character', onClick: () => {} }], forceMenu: true },
}

/** Disabled trigger. */
export const Disabled: Story = { args: { disabled: true } }
