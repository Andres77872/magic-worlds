import type { Meta, StoryObj } from '@storybook/react-vite'
import { ensureSafetyLocales } from '@/features/safety/test/ensureSafetyLocales'
import type { MinorReportAdminItem } from '@/shared/types/minorReport.types'
import { MinorReportsTable } from './MinorReportsTable'

// Until the `minorReports` copy is spread into the app bundles; a no-op afterwards.
ensureSafetyLocales()

const base: MinorReportAdminItem = {
    report_id: 'r-1',
    reporter_user_id: 31,
    reported_user_id: 912,
    subject_kind: 'username',
    subject_ref: 'moonlit_wren',
    reason: 'stated_age',
    details: 'In a shared adventure they said they were fourteen and in ninth grade.',
    reporter_eligible: true,
    hold: { restriction_id: 'h-1', ends_at: '2026-10-15T09:00:00Z', lifted_at: null },
    status: 'open',
    review_outcome: null,
    reviewed_at: null,
    created_at: '2026-10-13T09:00:00Z',
}

const items: MinorReportAdminItem[] = [
    base,
    {
        ...base,
        report_id: 'r-2',
        reported_user_id: null,
        subject_kind: 'public_card',
        subject_ref: 'card-7f3a',
        reason: 'content',
        details: null,
        reporter_eligible: false,
        hold: null,
        created_at: '2026-10-12T18:30:00Z',
    },
    {
        ...base,
        report_id: 'r-3',
        subject_ref: 'ember_scribe',
        reason: 'other',
        details: null,
        hold: { restriction_id: 'h-3', ends_at: '2026-10-13T09:00:00Z', lifted_at: '2026-10-12T20:00:00Z' },
        status: 'lifted',
        review_outcome: 'inconclusive',
        reviewed_at: '2026-10-12T20:00:00Z',
        created_at: '2026-10-11T08:15:00Z',
    },
    {
        ...base,
        report_id: 'r-4',
        subject_ref: 'gale_rider',
        details: null,
        hold: { restriction_id: 'h-4', ends_at: '2026-10-12T09:00:00Z', lifted_at: '2026-10-11T12:00:00Z' },
        status: 'escalated',
        review_outcome: 'escalated',
        reviewed_at: '2026-10-11T12:00:00Z',
        created_at: '2026-10-10T07:45:00Z',
    },
]

const meta = {
    title: 'Admin/Voices/MinorReportsTable',
    component: MinorReportsTable,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The root review queue for "Report a minor" (R2-BE-02): subject, reason, reporter eligibility, the temporary voice hold and the status, spoken as text. Unreviewed rows offer Unfounded, Inconclusive and Escalate (danger: it keeps voice off and flags the account, so the module confirms first). Details stay collapsed.',
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
    argTypes: {
        items: { control: false },
        locale: { control: 'inline-radio', options: ['en', 'es'] },
        disabled: { control: 'boolean' },
        onReview: { action: 'reviewed' },
    },
    args: { items, locale: 'en', disabled: false, onReview: () => {} },
} satisfies Meta<typeof MinorReportsTable>

export default meta
type Story = StoryObj<typeof meta>

/** Open, unmatched, lifted and escalated reports together. */
export const Queue: Story = {}

/** A review is being saved: every review button waits. */
export const Saving: Story = { args: { disabled: true } }
