import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppWarningModal, APP_WARNING_ACCEPTANCE_KEY } from './AppWarningModal'

const meta = {
  title: 'Components/AppWarningModal',
  component: AppWarningModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'First-run acknowledgement shown until accepted (acceptance is stored in localStorage). It states the 18+ age requirement, lists what is saved, the alpha-version caveats, AI-content/NSFW/no-personal-data and credit notes, and links to the Disclaimer and Privacy pages. There is no close affordance — the single primary action records acceptance and dismisses it.',
      },
    },
  },
} satisfies Meta<typeof AppWarningModal>

export default meta
type Story = StoryObj<typeof meta>

/** Clears the stored acceptance on render so the warning always shows in isolation. */
export const Default: Story = {
  render: () => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(APP_WARNING_ACCEPTANCE_KEY)
    return <AppWarningModal />
  },
}
