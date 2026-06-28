import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowRight, Sparkles, Trash2 } from 'lucide-react'
import { expect, userEvent, within } from 'storybook/test'
import { Button } from './Button'

const meta = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The primary action control. `primary` is the ember (candlelight gold) hero action, `arcane` signals AI / magic, `danger` is destructive. Sizes sm/md/lg; pass `iconLeft`/`iconRight` for lucide glyphs.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost', 'arcane', 'danger'],
      description: 'Action emphasis. `primary` = ember hero · `arcane` = AI/magic · `danger` = destructive.',
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    full: { control: 'boolean', description: 'Stretch to fill the container width.' },
    disabled: { control: 'boolean' },
    children: { control: 'text', description: 'Label (sentence case, 1–3 words).' },
    iconLeft: { control: false },
    iconRight: { control: false },
    onClick: { action: 'clicked' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    full: false,
    disabled: false,
    children: 'Step into the story',
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** Controls-driven playground. */
export const Primary: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const button = await canvas.findByRole('button', { name: args.children as string })
    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalled()
  },
}

export const Secondary: Story = { args: { variant: 'secondary', children: 'Maybe later' } }

export const Ghost: Story = { args: { variant: 'ghost', children: 'Dismiss' } }

/** AI / magic actions use the arcane violet. */
export const Arcane: Story = { args: { variant: 'arcane', children: 'Conjure a character' } }

/** Destructive actions use the blood red. */
export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete scene', iconLeft: <Trash2 size={16} strokeWidth={1.75} /> },
}

export const WithIcons: Story = {
  args: {
    children: 'Begin',
    iconLeft: <Sparkles size={16} strokeWidth={1.75} />,
    iconRight: <ArrowRight size={16} strokeWidth={1.75} />,
  },
}

export const Disabled: Story = { args: { disabled: true } }

export const FullWidth: Story = {
  args: { full: true, children: 'Continue your scene' },
  parameters: { layout: 'padded' },
}

/** Every kind side by side. */
export const AllKinds: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="arcane">Arcane</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
}

/** The size scale. */
export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}
