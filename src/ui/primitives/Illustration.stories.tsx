import type { Meta, StoryObj } from '@storybook/react-vite'
import { heroArt } from '@/assets/marketing'
import { Eyebrow } from './Eyebrow'
import { Illustration } from './Illustration'

const meta = {
  title: 'Primitives/Illustration',
  component: Illustration,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Static-image frame for candlelit marketing art imported through Vite (e.g. `@/assets/marketing/...`). Renders a plain `<img>` in a rounded, optionally tone-ringed frame with a legibility vignette. NOT `Portrait`/`AuthenticatedImage` — those route protected blobs through the authed media hook; static assets must not.',
      },
    },
  },
  argTypes: {
    ring: {
      control: 'inline-radio',
      options: ['ember', 'arcane', 'none'],
      description: 'Candlelight ring/glow around the frame. `ember` = gold · `arcane` = AI violet · `none` = hairline.',
    },
    vignette: { control: 'boolean', description: 'Dark inner gradient so overlaid text/eyebrows stay legible.' },
    aspect: { control: 'text', description: "Tailwind aspect class, e.g. 'aspect-[16/9]'. Omit to size via className/height." },
    eager: { control: 'boolean', description: 'Load eagerly (above-the-fold hero). Defaults to lazy.' },
    alt: { control: 'text', description: "Real description for meaningful art; pass '' for purely decorative images." },
    src: { control: false },
    className: { control: false },
    imgClassName: { control: false },
    children: { control: false },
  },
  args: {
    src: heroArt,
    alt: 'A candlelit tavern at the edge of a forgotten realm',
    aspect: 'aspect-[16/9]',
    ring: 'none',
    vignette: false,
  },
} satisfies Meta<typeof Illustration>

export default meta
type Story = StoryObj<typeof meta>

/** Controls-driven playground. */
export const Default: Story = {}

/** The ember (candlelight gold) ring + glow — the hero default. */
export const EmberRing: Story = { args: { ring: 'ember' } }

/** The arcane violet ring signals AI / magic surfaces. */
export const ArcaneRing: Story = { args: { ring: 'arcane' } }

/** No tone ring — just a faint hairline frame. */
export const NoRing: Story = { args: { ring: 'none' } }

/** A square crop, e.g. for a showcase portrait tile. */
export const SquareAspect: Story = {
  args: { aspect: 'aspect-square', ring: 'ember', className: 'w-72' },
}

/** Vignette darkens the lower edge so overlaid captions stay legible. */
export const WithVignetteOverlay: Story = {
  args: { ring: 'ember', vignette: true },
  render: (args) => (
    <Illustration {...args}>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <Eyebrow>Featured world</Eyebrow>
        <p className="mt-1 font-display text-lg text-parchment-50">The Ember Reaches</p>
      </div>
    </Illustration>
  ),
}

/** Each ring tone side by side. */
export const Tones: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Illustration src={heroArt} alt="" aspect="aspect-[4/3]" ring="ember" />
      <Illustration src={heroArt} alt="" aspect="aspect-[4/3]" ring="arcane" />
      <Illustration src={heroArt} alt="" aspect="aspect-[4/3]" ring="none" />
    </div>
  ),
}
