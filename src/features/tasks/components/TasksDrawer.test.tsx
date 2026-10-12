import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { BackgroundTaskBuckets, BackgroundTaskPublic, Character } from '@/shared'
import { formatApiDateTime } from '@/utils/time'
import { TasksDrawer } from './TasksDrawer'

const mocks = vi.hoisted(() => ({
    useBackgroundTasks: vi.fn(),
    useData: vi.fn(),
    refreshTasks: vi.fn(),
    cancelTask: vi.fn(),
    clearTerminalTasks: vi.fn(),
    closeDrawer: vi.fn(),
    setPage: vi.fn(),
}))

vi.mock('@/app/hooks', () => ({
    useBackgroundTasks: mocks.useBackgroundTasks,
    useData: mocks.useData,
    useNavigation: () => ({ setPage: mocks.setPage }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getCharacter: vi.fn(),
        getWorld: vi.fn(),
        getItem: vi.fn(),
        getAdventureTemplate: vi.fn(),
    },
    resolveMediaUrl: (u?: string | null) => (u == null || u === '' ? undefined : u),
}))

vi.mock('@/ui/components/audio', () => ({
    AudioWavePlayer: ({ title }: { title: string }) => <div data-testid="audio-player">{title}</div>,
}))

function task(status: BackgroundTaskPublic['status'], id: string, targetName = 'Card One'): BackgroundTaskPublic {
    return {
        task_id: id,
        operation: 'theme_song',
        status,
        target: { type: 'character', id: 'card-1', display_name: targetName },
        title: targetName,
        status_url: `/tasks/theme_song/${id}`,
        result_url: `/theme-songs/jobs/${id}/result`,
        cancel_url: status === 'pending' ? `/tasks/theme_song/${id}` : null,
        result: status === 'completed'
            ? {
                  assets: [{
                      asset_id: `asset-${id}`,
                      url: `/generated-audio/${id}.mp3`,
                      content_type: 'audio/mpeg',
                      file_size_bytes: 16,
                      duration_ms: 94_000,
                      output_format: 'mp3',
                  }],
                  lyrics: { source: 'writer', lyrics_sha256: 'a'.repeat(64), lyrics_length_chars: 80 },
              }
            : null,
        error: status === 'failed' ? { category: 'timeout', detail: 'Theme song generation timed out.' } : null,
        created_at: '2026-06-07T10:00:00',
        updated_at: status === 'pending' ? '2026-06-07T10:00:00' : '2026-06-07T10:05:00',
    }
}

const character: Character = {
    id: 'card-1',
    name: 'Card One',
    race: 'Elf',
    stats: {},
    description: 'A singer from the glasswood.',
    triggers: ['moon', 'song'],
    image_url: '/portrait.png',
    createdAt: '2026-06-01T09:00:00',
}

function mockDrawerState(buckets: BackgroundTaskBuckets) {
    mocks.useBackgroundTasks.mockReturnValue({
        tasks: [...buckets.active, ...buckets.completed, ...buckets.failed],
        taskBuckets: buckets,
        activeTasks: buckets.active,
        activeCount: buckets.active.length,
        drawerOpen: true,
        openDrawer: vi.fn(),
        closeDrawer: mocks.closeDrawer,
        refreshTasks: mocks.refreshTasks,
        registerTask: vi.fn(),
        registerThemeSongJob: vi.fn(),
        cancelTask: mocks.cancelTask,
        clearTerminalTasks: mocks.clearTerminalTasks,
        terminalHasMore: { completed: false, failed: false },
        loadMoreTerminalTasks: vi.fn(),
    })
    mocks.useData.mockReturnValue({
        characters: [character],
        worlds: [],
        items: [],
        templateAdventures: [],
    })
}

function renderDrawer(buckets: BackgroundTaskBuckets) {
    mockDrawerState(buckets)
    return render(<TasksDrawer />)
}

function renderDrawerSpanish(buckets: BackgroundTaskBuckets) {
    mockDrawerState(buckets)
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}><TasksDrawer /></I18nextProvider>)
}

describe('TasksDrawer', () => {
    it('shows narration as a task with playback and no invented attached card', async () => {
        const narration: BackgroundTaskPublic = { ...task('completed','tts-task'),operation:'text_to_speech',
            title:'Narration',target:{type:'media',id:'tts-task'},cancel_url:null,
            result:{assets:[],tts_assets:[{asset_id:'voice-1',url:'/tts/assets/voice-1.mp3',content_type:'audio/mpeg',duration_ms:2000,output_format:'mp3'}]} }
        renderDrawer({active:[],completed:[narration],failed:[]})
        fireEvent.click(await screen.findByRole('button',{name:/completed\s*1/i}))
        fireEvent.click(await screen.findByRole('button',{name:'Show Narration details'}))
        expect(screen.getByTestId('audio-player')).toHaveTextContent('Narration')
        expect(screen.queryByRole('button',{name:/Attached card:/})).toBeNull()
    })

    it('labels image generation without song progress text', async () => {
        const image: BackgroundTaskPublic = { ...task('in_progress','image-task'),operation:'image_generation',
            title:'Image generation',target:{type:'media',id:'image-task'},cancel_url:null,result:null }
        renderDrawer({active:[image],completed:[],failed:[]})
        expect(await screen.findByText('Generating image')).toBeInTheDocument()
        expect(screen.queryByText('Writing lyrics')).toBeNull()
    })
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        vi.resetAllMocks()
    })

    it('shows resource tasks with their own progress and opens the completed PDF resource', async () => {
        const pdf: BackgroundTaskPublic = { ...task('completed','pdf-task'),operation:'pdf_import',
            title:'court.pdf',target:{ type:'resource',id:'resource-pdf',display_name:'court.pdf' },result:{ assets:[],resource_id:'resource-pdf' } }
        const metadata: BackgroundTaskPublic = { ...task('in_progress','metadata-task'),operation:'lorebook_extraction',
            title:'court.pdf',target:{ type:'resource',id:'resource-pdf',display_name:'court.pdf' },result:null }
        renderDrawer({ active:[metadata],completed:[pdf],failed:[] })
        expect(await screen.findByText('Generate metadata · court.pdf')).toBeInTheDocument()
        expect(screen.getByText('Generating metadata')).toBeInTheDocument()
        expect(screen.queryByText('Writing lyrics')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button',{ name:/completed/i }))
        fireEvent.click(await screen.findByRole('button',{ name:'Show Import PDF · court.pdf details' }))
        fireEvent.click(screen.getByRole('button',{ name:'Attached card: Resource - court.pdf' }))
        expect(mocks.setPage).toHaveBeenCalledWith('gallery-resources',{hash:'#/gallery/resources?resource=resource-pdf'})
        expect(screen.queryByTestId('audio-player')).not.toBeInTheDocument()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('separates tasks into active, completed, and failed tabs', async () => {
        renderDrawer({
            active: [task('pending', 'active-1')],
            completed: [task('completed', 'done-1')],
            failed: [task('failed', 'failed-1'), task('canceled', 'canceled-1')],
        })

        expect(await screen.findByRole('button', { name: /active\s*1/i })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('Queued')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /completed\s*1/i }))
        expect(screen.getByText('Ready')).toBeInTheDocument()
        expect(screen.getByText('Card One theme')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /failed\s*2/i }))
        expect(screen.getAllByText('Failed').length).toBeGreaterThan(0)
        expect(screen.getByText('Canceled')).toBeInTheDocument()
        expect(screen.getByText('Theme song generation timed out.')).toBeInTheDocument()
    })

    it('shows an empty state for tabs without tasks', async () => {
        renderDrawer({
            active: [task('pending', 'active-1')],
            completed: [],
            failed: [],
        })

        fireEvent.click(await screen.findByRole('button', { name: /completed\s*0/i }))
        expect(screen.getByRole('heading', { name: 'No completed tasks yet' })).toBeInTheDocument()
    })

    it('opens the attached card modal from task metadata', async () => {
        renderDrawer({
            active: [task('pending', 'active-1')],
            completed: [],
            failed: [],
        })

        fireEvent.click(await screen.findByRole('button', { name: /attached card: character - card one/i }))

        await waitFor(() => expect(screen.getByText('A singer from the glasswood.')).toBeInTheDocument())
        expect(screen.getAllByText('Card One').length).toBeGreaterThan(0)
        expect(screen.getByText('Elf')).toBeInTheDocument()
        expect(screen.getByText('A singer from the glasswood.')).toBeInTheDocument()
        expect(screen.getByText('moon')).toBeInTheDocument()
    })

    it('disables the refresh button while a manual refresh is in flight', async () => {
        let resolveRefresh: () => void = () => {}
        mocks.refreshTasks.mockImplementation(
            () => new Promise<void>((resolve) => { resolveRefresh = resolve }),
        )
        renderDrawer({ active: [], completed: [], failed: [] })

        const refreshButton = await screen.findByRole('button', { name: /refresh/i })
        fireEvent.click(refreshButton)
        expect(refreshButton).toBeDisabled()

        resolveRefresh()
        await waitFor(() => expect(refreshButton).not.toBeDisabled())
        expect(mocks.refreshTasks).toHaveBeenCalledTimes(1)
    })

    it('disables clear while archiving and surfaces an archive failure', async () => {
        let rejectClear: (reason?: unknown) => void = () => {}
        mocks.clearTerminalTasks.mockImplementation(
            () => new Promise<void>((_resolve, reject) => { rejectClear = reject }),
        )
        renderDrawer({ active: [], completed: [task('completed', 'done-1')], failed: [] })

        fireEvent.click(await screen.findByRole('button', { name: /completed\s*1/i }))
        const clearButton = screen.getByRole('button', { name: 'Clear completed' })
        fireEvent.click(clearButton)
        expect(clearButton).toBeDisabled()

        rejectClear(new Error('server unavailable'))
        expect(await screen.findByRole('alert')).toHaveTextContent('Some tasks could not be cleared. Try again.')
        expect(clearButton).not.toBeDisabled()
    })

    it('shows relative timestamps with the absolute time on hover', async () => {
        // Fixture created_at is 2026-06-07T10:00:00 — pin "now" 9 minutes later.
        vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-07T10:09:00Z'))
        const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })
        const absolute = formatApiDateTime('2026-06-07T10:00:00')

        renderDrawer({ active: [task('pending', 'active-1')], completed: [], failed: [] })

        const created = await screen.findByText(`Created ${rtf.format(-9, 'minute')}`)
        expect(created).toHaveAttribute('title', absolute)
    })

    it('toggles a task row open and closed', async () => {
        renderDrawer({ active: [task('pending', 'active-1')], completed: [], failed: [] })

        const toggle = await screen.findByRole('button', { name: /show .*details/i })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(toggle)
        expect(screen.getByRole('button', { name: /hide .*details/i })).toHaveAttribute('aria-expanded', 'true')
    })

    it('renders drawer tabs, statuses, and audio labels in Spanish', async () => {
        renderDrawerSpanish({
            active: [],
            completed: [task('completed', 'done-1')],
            failed: [],
        })

        expect(await screen.findByText('Tareas')).toBeInTheDocument()
        expect(screen.getByRole('group', { name: 'Filtrar tareas por estado' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Activas\s*0/i })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('No hay tareas activas')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Completadas\s*1/i }))
        expect(screen.getByText('Listo')).toBeInTheDocument()
        expect(screen.getByText('Tema de Card One')).toBeInTheDocument()
    })
})
