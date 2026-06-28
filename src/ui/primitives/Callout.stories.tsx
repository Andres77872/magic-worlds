import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { Callout } from './Callout'
import { Button } from './Button'
import { Icon } from './Icon'

const meta = {
  title: 'Primitives/Callout',
  component: Callout,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Inline notice box for page-level feedback. `danger` = errors, `success` = confirmations, `warning` = usage/cost notices, `info` = AI/arcane hints. Pass `icon` for a tinted leading glyph and `action` for a right-aligned control (e.g. Retry).',
      },
    },
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['danger', 'success', 'warning', 'info'] },
    icon: { control: false },
    action: { control: false },
    children: { control: 'text' },
  },
  args: { tone: 'info', children: 'Metadata extraction uses AI credits.' },
} satisfies Meta<typeof Callout>

export default meta
type Story = StoryObj<typeof meta>

export const Info: Story = {}
export const Success: Story = { args: { tone: 'success', children: 'Resource saved.' } }
export const Warning: Story = {
  args: {
    tone: 'warning',
    icon: <Icon icon={AlertTriangle} size={14} />,
    children: 'Saved metadata is out of date — re-sync to refresh it.',
  },
}
export const Danger: Story = {
  args: {
    tone: 'danger',
    role: 'alert',
    children: 'Could not load resources.',
    action: (
      <Button variant="secondary" size="sm">
        Retry
      </Button>
    ),
  },
}

export const AllTones: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="grid max-w-[560px] gap-3">
      <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm">Retry</Button>}>
        Could not load resources.
      </Callout>
      <Callout tone="success">Resource saved.</Callout>
      <Callout tone="warning" icon={<Icon icon={AlertTriangle} size={14} />} role="status">
        Saved metadata is out of date — re-sync to refresh it.
      </Callout>
      <Callout tone="info" icon={<Icon icon={Sparkles} size={14} />}>
        Metadata extraction uses AI credits.
      </Callout>
    </div>
  ),
}
