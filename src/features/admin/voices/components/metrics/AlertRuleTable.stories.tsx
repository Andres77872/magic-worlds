import type { Meta, StoryObj } from '@storybook/react-vite'
import type { NarrationMetricsResponse, ProviderMetricsResponse, SpendMetricsResponse } from '@/shared'
import { callMetrics, narrationMetrics, providerMetrics, spendMetrics } from '../../metricsFixtures'
import { metricsRuleStatuses } from '../../metricsRules'
import { AlertRuleTable } from './AlertRuleTable'

const quietNarration: NarrationMetricsResponse = {
    ...narrationMetrics,
    window: { ...narrationMetrics.window, hours: 1 },
    db: { ...narrationMetrics.db, providers: [{ ...narrationMetrics.db.providers[0], terminal: 120 }] },
    alerts: [],
}

const accountEvent: ProviderMetricsResponse = {
    ...providerMetrics,
    alerts: [
        ...providerMetrics.alerts,
        { alert: 'account_event', severity: 'page', provider: 'elevenlabs', value: 1, threshold: 1, sample: 1, runbook: 'RB-8', detail: 'voice_ban' },
    ],
}

const unbudgeted: SpendMetricsResponse = { ...spendMetrics, alerts: [], db: { ...spendMetrics.db, daily_budget_chars: null } }

const meta = {
    title: 'Admin/Voices/AlertRuleTable',
    component: AlertRuleTable,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Alert rules of one root metrics area: each rule with its threshold, its state and, when it fires, the server’s value, threshold, sample, provider and runbook. The state is spoken as text (Firing, Not firing, Sample too small, No data, Not evaluated), never only by badge colour.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="max-w-[1100px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    args: {
        caption: 'Alert rules: Narration',
        statuses: metricsRuleStatuses(narrationMetrics),
        locale: 'en',
    },
} satisfies Meta<typeof AlertRuleTable>

export default meta
type Story = StoryObj<typeof meta>

export const NarrationFiring: Story = {}

export const NarrationSmallSample: Story = {
    args: { statuses: metricsRuleStatuses(quietNarration) },
}

export const Calls: Story = {
    args: { caption: 'Alert rules: Calls', statuses: metricsRuleStatuses(callMetrics) },
}

export const ProviderHealth: Story = {
    args: { caption: 'Alert rules: Provider health', statuses: metricsRuleStatuses(providerMetrics) },
}

export const ProviderAccountEvent: Story = {
    args: { caption: 'Alert rules: Provider health', statuses: metricsRuleStatuses(accountEvent) },
}

export const SpendWithoutBudget: Story = {
    args: { caption: 'Alert rules: Spend and budget', statuses: metricsRuleStatuses(unbudgeted) },
}
