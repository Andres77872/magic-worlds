import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Switch, SwitchRow } from './Switch'

const meta = {
  title: 'Primitives/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Boolean toggle (`role="switch"`) — ember track when on, ink when off. `SwitchRow` supports a standalone surface or a plain row for integrated settings lists. Label clicks toggle.',
      },
    },
  },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

function ControlledSwitch(props: Omit<Parameters<typeof Switch>[0], 'checked' | 'onChange'> & { initial?: boolean }) {
  const { initial = false, ...rest } = props
  const [checked, setChecked] = useState(initial)
  return <Switch {...rest} checked={checked} onChange={setChecked} />
}

export const Basic: Story = {
  args: { checked: true, onChange: () => {}, 'aria-label': 'Enabled' },
  render: () => <ControlledSwitch initial aria-label="Enabled" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = await canvas.findByRole('switch', { name: 'Enabled' })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  },
}

export const Sizes: Story = {
  args: { checked: true, onChange: () => {}, 'aria-label': 'Enabled' },
  render: () => (
    <div className="flex items-center gap-4">
      <ControlledSwitch initial size="md" aria-label="Medium switch" />
      <ControlledSwitch initial size="sm" aria-label="Small switch" />
    </div>
  ),
}

export const Disabled: Story = {
  args: { checked: true, onChange: () => {}, disabled: true, 'aria-label': 'Enabled' },
  render: () => (
    <div className="flex items-center gap-4">
      <Switch checked disabled onChange={() => {}} aria-label="Disabled on" />
      <Switch checked={false} disabled onChange={() => {}} aria-label="Disabled off" />
    </div>
  ),
}

export const Rows: Story = {
  args: { checked: true, onChange: () => {}, 'aria-label': 'Enabled' },
  render: function Render() {
    const [state, setState] = useState({ enabled: true, constant: false, secret: false })
    return (
      <div className="grid w-full max-w-md gap-3">
        <SwitchRow
          label="Enabled"
          description="Disabled entries stay visible but do not activate."
          checked={state.enabled}
          onChange={(enabled) => setState((s) => ({ ...s, enabled }))}
        />
        <SwitchRow
          label="Constant"
          description="Always include this entry when the book is active."
          checked={state.constant}
          onChange={(constant) => setState((s) => ({ ...s, constant }))}
        />
        <SwitchRow
          label="Secret"
          description="Mark sensitive lore for editor-only review."
          checked={state.secret}
          onChange={(secret) => setState((s) => ({ ...s, secret }))}
        />
      </div>
    )
  },
}

export const IntegratedSettings: Story = {
  args: { checked: true, onChange: () => {}, 'aria-label': 'Enabled' },
  render: function Render() {
    const [enabled, setEnabled] = useState(true)
    const [constant, setConstant] = useState(false)
    return (
      <section aria-label="Entry settings" className="w-full max-w-md divide-y divide-line-faint">
        <SwitchRow variant="plain" label="Enabled" description="Include this entry when its keywords match." checked={enabled} onChange={setEnabled} />
        <SwitchRow variant="plain" label="Always include" description="Keep this lore present throughout the story." checked={constant} onChange={setConstant} />
      </section>
    )
  },
}
