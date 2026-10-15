import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { i18n } from '@/app/i18n'
import { installPlayAdminAuditApi, type AuditState } from '@/features/admin/playAdminAuditFixtures'
import { apiService } from '@/infrastructure/api'
import type { LibraryVoice, LibraryVoicePage, LibraryVoiceQuery } from '@/shared'
import { auditLibraryPage, libraryVoice } from '../../fixtures'
import { VoiceConsoleProvider } from '../shell/VoiceConsoleContext'
import { LibraryBrowser } from './LibraryBrowser'

type LibraryState = Extract<AuditState, 'populated' | 'empty' | 'loading' | 'error'>

const harbourMaster = auditLibraryPage.items[0]

/** Already added: the row shows "In catalog" instead of the add action. */
const harborWatch: LibraryVoice = {
    ...harbourMaster,
    public_owner_id: libraryVoice.public_owner_id ?? 'owner_0004',
    library_voice_id: libraryVoice.library_voice_id ?? 'lib_0004',
    name: 'Harbor watch',
    description: 'A steady night-watch voice for long crossings.',
    labels: { accent: 'american', age: 'middle_aged', gender: 'male' },
    catalog_voice_key: libraryVoice.voice_key,
}

/** Sparse upstream terms: unknown notice period, no upstream preview, no verified languages. */
const lanternKeeper: LibraryVoice = {
    ...harbourMaster,
    public_owner_id: 'owner_0011',
    library_voice_id: 'lib_0011',
    name: 'Lantern keeper',
    description: null,
    labels: {},
    notice_period_days: null,
    rate: null,
    free_users_allowed: false,
    verified_languages: [],
    preview_url: null,
}

/** The second page behind "Load more". */
const tideSinger: LibraryVoice = {
    ...harbourMaster,
    public_owner_id: 'owner_0012',
    library_voice_id: 'lib_0012',
    name: 'Tide singer',
    description: 'Light and lilting, made for sea shanties.',
    labels: { accent: 'scottish', age: 'young', gender: 'female' },
    verified_languages: [{ language: 'en', locale: 'en-GB', accent: 'scottish', model_ids: ['eleven_v4'] }],
}

const never = <T,>() => new Promise<T>(() => {})

/** The offline Library read: two pages when populated; the audit states otherwise. */
function fakeLibrary(state: LibraryState) {
    return async (query: LibraryVoiceQuery = {}): Promise<LibraryVoicePage> => {
        if (state === 'loading') return never()
        if (state === 'error') throw new Error('The preview service is temporarily unavailable. Try again.')
        if (state === 'empty') return { items: [], page: 0, has_more: false }
        const search = (query.search ?? '').toLowerCase()
        const match = (voice: LibraryVoice) => !search || voice.name.toLowerCase().includes(search)
        if ((query.page ?? 0) > 0) return { items: [tideSinger].filter(match), page: 1, has_more: false }
        return { items: [harbourMaster, harborWatch, lanternKeeper].filter(match), page: 0, has_more: !search }
    }
}

/** `state` picks the offline API answers (installed in `beforeEach`). */
function LibraryScene({ state }: { state: LibraryState }) {
    return (
        <div data-audit-state={state}>
            <VoiceConsoleProvider initialModule="library">
                <LibraryBrowser />
            </VoiceConsoleProvider>
        </div>
    )
}

const meta = {
    title: 'Admin/Voices/LibraryBrowser',
    component: LibraryScene,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Root Library browser (05 §8.7): live search of shared provider voices with the curated filters always applied, each voice’s upstream terms, a root-only upstream preview, and "Add to catalog" behind the terms checklist and both attestations. A voice already added reads "In catalog". Every API method is replaced offline; adding fails locally.',
            },
        },
    },
    beforeEach: ({ args }) => {
        const restore = installPlayAdminAuditApi(args.state)
        // The audit fakes leave the Library read blocked; this one answers offline (restored with the rest).
        Object.assign(apiService as unknown as Record<string, unknown>, { listAdminLibrary: fakeLibrary(args.state) })
        return restore
    },
    argTypes: {
        state: { control: 'inline-radio', options: ['populated', 'empty', 'loading', 'error'] },
    },
    args: { state: 'populated' },
} satisfies Meta<typeof LibraryScene>

export default meta
type Story = StoryObj<typeof meta>

/** Three voices and a second page: one ready to add, one already in the catalog, one with sparse terms. */
export const Populated: Story = {}
export const Empty: Story = { args: { state: 'empty' } }
export const Loading: Story = { args: { state: 'loading' } }
export const LoadError: Story = { args: { state: 'error' } }

/** The add dialog for Old harbour master: its terms pass; both attestations are still unticked, so adding stays disabled. */
export const AddToCatalog: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const [first] = await canvas.findAllByRole('button', { name: i18n.t('admin.voices.library.add') })
        await userEvent.click(first)
    },
}
