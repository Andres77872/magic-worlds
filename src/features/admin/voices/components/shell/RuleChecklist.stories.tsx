import type { Meta, StoryObj } from '@storybook/react-vite'
import { RuleChecklist } from './RuleChecklist'

const meta = {
    title: 'Admin/Voices/RuleChecklist',
    component: RuleChecklist,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Pass/fail checklist for publish, readiness and Library terms. The state is spoken as text ("Passed" / "Not met"), never only shown by icon colour.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[380px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    args: {
        title: 'Readiness',
        checks: [
            { id: 'sourceKind', passed: true, labelKey: 'admin.voices.defaults.readiness.sourceKind' },
            { id: 'active', passed: true, labelKey: 'admin.voices.defaults.readiness.active' },
            { id: 'callEligible', passed: false, labelKey: 'admin.voices.defaults.readiness.callEligible' },
            { id: 'flashAccepted', passed: true, labelKey: 'admin.voices.defaults.readiness.flashAccepted', labelValues: { language: 'Spanish' } },
            { id: 'sample', passed: false, labelKey: 'admin.voices.defaults.readiness.sample', labelValues: { language: 'Spanish' } },
        ],
    },
} satisfies Meta<typeof RuleChecklist>

export default meta
type Story = StoryObj<typeof meta>

export const Mixed: Story = {}

export const AllPassed: Story = {
    args: {
        title: 'Library terms (re-checked by the server)',
        checks: [
            { id: 'notice', passed: true, labelKey: 'admin.voices.library.checklist.notice' },
            { id: 'rate', passed: true, labelKey: 'admin.voices.library.checklist.rate' },
            { id: 'liveModeration', passed: true, labelKey: 'admin.voices.library.checklist.liveModeration' },
            { id: 'category', passed: true, labelKey: 'admin.voices.library.checklist.category' },
            { id: 'safety', passed: true, labelKey: 'admin.voices.library.checklist.safety' },
        ],
    },
}
