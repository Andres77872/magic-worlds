import type { Meta, StoryObj } from '@storybook/react-vite'
import { LlmProfileCompatibilityPanel } from './LlmProfileCompatibilityPanel'
import { invalidConfiguration, mixedCompatibility } from './llmCompatibilityFixtures'

const meta = {
    title: 'Profile/Models/Compatibility by feature', component: LlmProfileCompatibilityPanel, tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'Server-computed compatibility of the profile being edited: "Works for" (verdant) and "Not available for" with the roles and the blocking reason (blood). Nothing is saved.' } } },
    args: { state: { status: 'ready', report: mixedCompatibility } },
} satisfies Meta<typeof LlmProfileCompatibilityPanel>
export default meta
type Story = StoryObj<typeof meta>
export const MixedContracts: Story = {}
export const InvalidConfiguration: Story = { args: { state: { status: 'ready', report: invalidConfiguration } } }
export const Checking: Story = { args: { state: { status: 'checking', report: null } } }
export const Unavailable: Story = { args: { state: { status: 'unavailable', report: null } } }
