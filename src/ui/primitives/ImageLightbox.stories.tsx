import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from './Button'
import { ImageLightbox } from './ImageLightbox'

const meta = {
  title: 'Primitives/ImageLightbox',
  component: ImageLightbox,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Full-bleed portal overlay showing a single image at natural size (viewport-capped) over a dim+blur scrim, with an optional details panel for image metadata.',
      },
    },
  },
  argTypes: {
    open: { control: false },
    onClose: { control: false },
    src: { control: false },
    alt: { control: 'text' },
    details: { control: false },
  },
  args: {
    open: false,
    onClose: () => {},
    src: 'https://picsum.photos/seed/reverie-lightbox/900/1200',
    alt: 'Generated card portrait',
  },
} satisfies Meta<typeof ImageLightbox>

export default meta
type Story = StoryObj<typeof meta>

/** Stories render a trigger; the lightbox opens into its own scrim. */
function LightboxDemo(props: { src?: string; alt?: string; details?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>View image</Button>
      <ImageLightbox {...props} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export const Default: Story = {
  render: (args) => <LightboxDemo src={args.src} alt={args.alt} />,
}

export const WithDetails: Story = {
  render: (args) => (
    <LightboxDemo
      src={args.src}
      alt={args.alt}
      details={
        <section className="flex flex-col gap-2">
          <h2 className="font-ui text-sm font-semibold text-parchment-100">Prompt</h2>
          <p className="font-narrative text-sm leading-relaxed text-parchment-300">
            Image-only illustration of a candlelit archivist standing before a moon gate, low-key painterly lighting, no readable text.
          </p>
        </section>
      }
    />
  ),
}
