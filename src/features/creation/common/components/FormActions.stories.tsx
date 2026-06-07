import type { Meta, StoryObj } from '@storybook/react-vite'
import { FormActions } from './FormActions'

const meta = {
  title: 'Creation/FormActions',
  component: FormActions,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The footer action bar for creator forms — a secondary Cancel and a primary submit. Stretches full-width on mobile and disables while submitting.' } },
  },
  decorators: [(Story) => <div className="w-[640px] max-w-full"><Story /></div>],
  argTypes: {
    submitLabel: { control: 'text' },
    cancelLabel: { control: 'text' },
    isSubmitting: { control: 'boolean' },
    onCancel: { control: false },
  },
  args: { submitLabel: 'Create Character', cancelLabel: 'Cancel', isSubmitting: false, onCancel: () => {} },
} satisfies Meta<typeof FormActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Submitting: Story = { args: { isSubmitting: true } }
