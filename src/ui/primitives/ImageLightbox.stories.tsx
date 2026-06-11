import type { Meta, StoryObj } from '@storybook/react-vite'
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
          'Full-bleed portal overlay showing a single image at natural size (viewport-capped) over a dim+blur scrim. Click the scrim or press Escape to close. `src` is used as-is — resolve relative media URLs before passing.',
      },
    },
  },
  argTypes: {
    open: { control: false },
    onClose: { control: false },
    src: { control: false },
    alt: { control: 'text' },
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
function LightboxDemo(props: { src?: string; alt?: string }) {
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
