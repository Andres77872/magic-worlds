import type { Meta, StoryObj } from '@storybook/react-vite'
import { FeatureAccessGate } from './FeatureAccessGate'

const meta = {
    title: 'Features/Feature access',
    component: FeatureAccessGate,
    tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'Recoverable status for an active preview permission; global pages render directly.' } } },
} satisfies Meta<typeof FeatureAccessGate>
export default meta
type Story = StoryObj<typeof meta>
export const CheckingAccess: Story = {}

