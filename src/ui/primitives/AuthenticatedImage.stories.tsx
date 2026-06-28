import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthenticatedImage } from './AuthenticatedImage'

const meta = {
  title: 'Primitives/AuthenticatedImage',
  component: AuthenticatedImage,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Thin protected-media `<img>` wrapper. It routes `src` through `useAuthenticatedMediaUrl`, fetching protected blobs with the auth token and swapping in an object URL once ready; while loading (or with no `src`) it shows a transparent pixel and stays decorative. Use it for user/protected media (portraits, generated art behind auth) — NOT for static bundled assets, which should use `Illustration`/`<img>` directly.\n\nReal usage needs an authed media URL plus the API service in context, so these stories only document the contract; they cannot fetch a live protected blob in Storybook.',
      },
    },
  },
  argTypes: {
    src: { control: 'text', description: 'Protected media URL. Resolved + fetched with auth; `null`/empty renders nothing.' },
    alt: { control: 'text' },
    className: { control: false },
  },
  args: {
    src: '/media/portraits/lyra.webp',
    alt: 'Character portrait',
    className: 'h-48 w-48 rounded-xl object-cover',
  },
} satisfies Meta<typeof AuthenticatedImage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Documents the loading/placeholder state. With no live API service in
 * Storybook the protected `src` resolves to the transparent pixel, so the frame
 * shows the empty placeholder rather than a real blob.
 */
export const ProtectedMedia: Story = {
  render: (args) => (
    <div className="max-w-prose">
      <AuthenticatedImage {...args} />
      <p className="mt-4 font-narrative text-sm text-parchment-300">
        In the app this fetches the protected blob with the auth token and swaps in an object URL once it loads.
        Here it falls back to the transparent placeholder.
      </p>
    </div>
  ),
}

/** A nullish `src` renders nothing at all (returns `null`). */
export const NoSource: Story = {
  args: { src: null },
  render: (args) => (
    <div className="max-w-prose">
      <AuthenticatedImage {...args} />
      <p className="font-narrative text-sm text-parchment-300">
        With <code>src={'{null}'}</code> the component renders nothing — there is no frame above this line.
      </p>
    </div>
  ),
}
