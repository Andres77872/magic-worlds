import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { ApiStatusContext } from '@/app/providers/apiStatusContext'
import { ServicesDownBanner } from './ServicesDownBanner'

const withOfflineApi: Decorator = function Provided(Story) {
  return (
    <ApiStatusContext.Provider value={{ status: 'offline' }}>
      <Story />
    </ApiStatusContext.Provider>
  )
}

const meta = {
  title: 'Components/ServicesDownBanner',
  component: ServicesDownBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'App-wide alert strip shown above the content while the API health check reports offline. Reads `useApiStatus()` — it renders nothing for `online`/`checking`, so this story provides an offline `ApiStatusContext`.',
      },
    },
  },
  decorators: [withOfflineApi, (Story) => <div className="w-[640px] max-w-full"><Story /></div>],
} satisfies Meta<typeof ServicesDownBanner>

export default meta
type Story = StoryObj<typeof meta>

/** The API is unreachable — actions may fail until it returns. */
export const Offline: Story = {}
