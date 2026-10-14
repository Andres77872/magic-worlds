import type { Meta, StoryObj } from '@storybook/react-vite'
import { ensureSafetyLocales } from '@/features/safety/test/ensureSafetyLocales'
import { ApiError } from '@/infrastructure/api'
import type { MinorReportInput } from '@/shared/types/minorReport.types'
import { ReportMinorFormView } from './ReportMinorForm'

// Until the `minorReports` copy is spread into the app bundles; a no-op afterwards.
ensureSafetyLocales()

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const meta = {
    title: 'Features/Legal/ReportMinorForm',
    component: ReportMinorFormView,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    '"Report a possible minor" on the Contact page (R2-BE-02), shown only to a signed-in account while reporting is open. Subject kind, card ID or username, reason and optional details. Success only thanks the reporter and never says what happened to the reported account; the daily limit (429) and a disabled reporter (403) map to their own copy. Ember marks the one action.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="max-w-[760px]">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        status: { control: 'object' },
        onSubmit: { control: false },
        className: { control: false },
    },
    args: {
        status: { enabled: true, can_report: true, reports_left_today: 3, reason: null },
        onSubmit: async (body: MinorReportInput) => {
            await wait(body.details ? 900 : 600)
        },
    },
} satisfies Meta<typeof ReportMinorFormView>

export default meta
type Story = StoryObj<typeof meta>

/** Fill the form and send: the thank-you copy replaces it. */
export const Open: Story = {}

/** The send is refused with today's limit (429). */
export const LimitOnSubmit: Story = {
    args: {
        onSubmit: async () => {
            await wait(400)
            throw new ApiError(429, 'Daily report limit reached.', { code: 'minor_report_limit' })
        },
    },
}

/** Reporting was turned off for this account after unfounded reports (403). */
export const DisabledOnSubmit: Story = {
    args: {
        onSubmit: async () => {
            await wait(400)
            throw new ApiError(403, 'Reporting disabled.', { code: 'minor_report_disabled' })
        },
    },
}

/** The status already says the account cannot report today. */
export const LimitReached: Story = { args: { status: { enabled: true, can_report: false, reports_left_today: 0, reason: 'limit' } } }
