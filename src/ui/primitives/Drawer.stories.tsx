import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import { Button } from './Button'
import { Drawer } from './Drawer'
import { Icon } from './Icon'

const meta = {
  title: 'Primitives/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Right-anchored sliding panel over a dim+blur scrim — the Modal\'s candlelit surface, but edge-mounted and full-height. Used for card editing in-session (AdventureCardDrawer) and media history. Slides through a 220ms enter/exit, closes on scrim click or Escape. Controlled via `open` / `onClose`.',
      },
    },
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl', '2xl'] },
    showClose: { control: 'boolean' },
    title: { control: 'text' },
    eyebrow: { control: 'text' },
    open: { control: false },
    onClose: { control: false },
    icon: { control: false },
    footer: { control: false },
    children: { control: false },
  },
  // open/onClose/children are required but driven by DrawerDemo's local state.
  args: {
    size: 'md',
    showClose: true,
    eyebrow: 'Adventure copy',
    title: 'Lyra Dawnwhisper',
    open: false,
    onClose: () => {},
    children: undefined,
  },
} satisfies Meta<typeof Drawer>

export default meta
type Story = StoryObj<typeof meta>

/** Stories render a trigger button; the drawer slides in over its own scrim. */
function DrawerDemo(props: Partial<ComponentProps<typeof Drawer>>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open drawer</Button>
      <Drawer
        title="Lyra Dawnwhisper"
        icon={<Icon icon={ScrollText} size={18} />}
        {...props}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>Save changes</Button>
          </>
        }
      >
        {props.children ?? (
          <div className="space-y-3">
            <p className="font-narrative text-[15px] leading-relaxed text-parchment-200">
              Edits here touch the adventure&rsquo;s own copy of this card — the library
              original stays untouched, so the scene can drift from canon freely.
            </p>
            <p className="font-narrative text-[15px] leading-relaxed text-parchment-300">
              A half-elf ranger with a singed cloak and a debt to the Shardwrights. She
              speaks to glass the way sailors speak to weather.
            </p>
          </div>
        )}
      </Drawer>
    </>
  )
}

export const Default: Story = {
  render: (args) => <DrawerDemo {...args} />,
}

/** The widest band — used by MediaHistoryDrawer's two-tab gallery. */
export const ExtraWide: Story = {
  args: { size: '2xl', eyebrow: 'Media', title: 'Generation history' },
  render: (args) => <DrawerDemo {...args} />,
}

/** Headerless body for fully custom content. */
export const NoHeader: Story = {
  args: { title: undefined, eyebrow: undefined, showClose: false },
  render: (args) => <DrawerDemo {...args} />,
}
