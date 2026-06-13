import type { Meta, StoryObj } from '@storybook/react-vite'
import { GlowBackdrop } from './GlowBackdrop'

const meta = {
  title: 'Primitives/GlowBackdrop',
  component: GlowBackdrop,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Soft, decorative candlelight glows behind a section. Absolutely positioned and pointer-events-none — drop it as the first child of a `relative overflow-hidden` container.' } },
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['hero', 'center', 'header', 'page'] },
  },
  args: { variant: 'hero' },
  render: (args) => (
    <div className="relative flex h-[360px] w-full items-center justify-center overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-900">
      <GlowBackdrop {...args} />
      <span className="relative font-display text-h3 font-semibold text-parchment-50">
        {args.variant} glow
      </span>
    </div>
  ),
} satisfies Meta<typeof GlowBackdrop>

export default meta
type Story = StoryObj<typeof meta>

export const Hero: Story = { args: { variant: 'hero' } }
export const Center: Story = { args: { variant: 'center' } }
export const Header: Story = { args: { variant: 'header' } }

/** App-shell ambience: in the real app this sits inside a `fixed inset-0`
 *  wrapper in AppRouter; the viewport-height box stands in for that here. */
export const Page: Story = {
  args: { variant: 'page' },
  render: (args) => (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-ink-800">
      <GlowBackdrop {...args} />
      <span className="relative font-display text-h3 font-semibold text-parchment-50">
        {args.variant} glow
      </span>
    </div>
  ),
}
