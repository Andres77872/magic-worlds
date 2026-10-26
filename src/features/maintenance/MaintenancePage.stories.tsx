import type { Meta, StoryObj } from '@storybook/react-vite'
import MaintenancePage from './MaintenancePage'

const meta = {
    title: 'Landing/MaintenancePage',
    component: MaintenancePage,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: { description: { component: 'The standalone maintenance front door. Ember marks the maintenance state and retry action; both languages and the candlelit artwork work without application providers or backend requests.' } },
    },
    argTypes: {
        initialLanguage: { control: 'inline-radio', options: ['en', 'es'], description: 'Initial preview language; the page also has its own language controls.' },
        onReload: { action: 'reload requested', control: false },
    },
    args: { initialLanguage: 'en' },
} satisfies Meta<typeof MaintenancePage>

export default meta
type Story = StoryObj<typeof meta>

export const English: Story = {}
export const Spanish: Story = { args: { initialLanguage: 'es' } }
