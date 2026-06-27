import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { CreditCard, Activity, Share2, Mail, ShieldCheck } from 'lucide-react'
import { Icon } from './Icon'
import { Badge } from './Badge'
import { Tabs, TabPanel, type TabOption } from './Tabs'

type Section = 'membership' | 'usage' | 'sharing' | 'account' | 'security'

const sections: TabOption<Section>[] = [
  { value: 'membership', label: 'Membership', icon: <Icon icon={CreditCard} size={16} /> },
  { value: 'usage', label: 'Usage', icon: <Icon icon={Activity} size={16} /> },
  { value: 'sharing', label: 'Shared cards', icon: <Icon icon={Share2} size={16} /> },
  { value: 'account', label: 'Account', icon: <Icon icon={Mail} size={16} /> },
  { value: 'security', label: 'Security', icon: <Icon icon={ShieldCheck} size={16} /> },
]

const meta = {
  title: 'Primitives/Tabs',
  component: Tabs<Section>,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Accessible text-label tab bar (WAI-ARIA tabs pattern). The active tab lights ember; roving arrow/Home/End keys move focus and select. Renders the `role="tablist"` only — pair with `TabPanel` so you control panel mounting. Supports `horizontal` (underline/pill) and `vertical` (sidebar nav) orientations.',
      },
    },
  },
  argTypes: {
    options: { control: false },
    value: { control: false },
    onChange: { action: 'changed' },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    variant: { control: 'inline-radio', options: ['underline', 'pill'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
  args: {
    'aria-label': 'Profile sections',
    idBase: 'demo',
    options: sections,
    value: 'membership',
    onChange: () => {},
  },
} satisfies Meta<typeof Tabs<Section>>

export default meta
type Story = StoryObj<typeof meta>

function TabsDemo({
  orientation = 'horizontal',
  variant = 'underline',
  options = sections,
}: {
  orientation?: 'horizontal' | 'vertical'
  variant?: 'underline' | 'pill'
  options?: TabOption<Section>[]
}) {
  const [value, setValue] = useState<Section>('membership')
  const labels: Record<Section, string> = {
    membership: 'Plan tiers, pay-as-you-go wallet and credit redemption.',
    usage: "Today's quota meters and the month-to-date breakdown.",
    sharing: 'Public cards and unlisted share links you control.',
    account: 'The email addresses linked to your account.',
    security: 'Password changes and destructive account actions.',
  }
  const tablist = (
    <Tabs
      aria-label="Profile sections"
      idBase="demo"
      options={options}
      value={value}
      onChange={setValue}
      orientation={orientation}
      variant={variant}
    />
  )
  const panels = options.map((option) => (
    <TabPanel key={option.value} value={option.value} idBase="demo" active={value} className="py-3 font-ui text-sm text-parchment-200">
      {labels[option.value]}
    </TabPanel>
  ))
  if (orientation === 'vertical') {
    return (
      <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-6">
        {tablist}
        <div>{panels}</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {tablist}
      <div>{panels}</div>
    </div>
  )
}

/** Horizontal underline bar — the default. */
export const Horizontal: Story = {
  render: () => <TabsDemo orientation="horizontal" variant="underline" />,
}

/** Vertical sidebar nav — the active row tints ember. Used by the Profile page. */
export const VerticalSidebar: Story = {
  parameters: { docs: { description: { story: 'Vertical orientation renders left-aligned full-width rows; Up/Down arrows rove. This is the Profile page sidebar nav.' } } },
  render: () => <TabsDemo orientation="vertical" variant="underline" />,
}

/** Pill variant — segmented look inside a bordered track. */
export const Pill: Story = {
  render: () => <TabsDemo orientation="horizontal" variant="pill" />,
}

/** Trailing slot — e.g. a count badge beside the label. */
export const WithTrailingCount: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const withCounts: TabOption<Section>[] = [
      { value: 'membership', label: 'Membership', icon: <Icon icon={CreditCard} size={16} /> },
      { value: 'sharing', label: 'Shared cards', icon: <Icon icon={Share2} size={16} />, trailing: <Badge tone="neutral">12</Badge> },
      { value: 'account', label: 'Account', icon: <Icon icon={Mail} size={16} />, trailing: <Badge tone="ember">2</Badge> },
    ]
    return <TabsDemo orientation="vertical" options={withCounts} />
  },
}

/** A disabled tab is skipped by keyboard roving and not selectable. */
export const WithDisabled: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const someDisabled: TabOption<Section>[] = sections.map((option) =>
      option.value === 'usage' ? { ...option, disabled: true } : option,
    )
    return <TabsDemo orientation="horizontal" options={someDisabled} />
  },
}
