import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { BackgroundTaskBuckets, BackgroundTaskPublic } from '@/shared'
import { SidebarTasksMenu } from './SidebarTasksMenu'

const mocks = vi.hoisted(() => ({
    useBackgroundTasks: vi.fn(),
    useData: vi.fn(),
}))

vi.mock('@/app/hooks', () => ({
    useBackgroundTasks: mocks.useBackgroundTasks,
    useData: mocks.useData,
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

function task(status: BackgroundTaskPublic['status'], id: string): BackgroundTaskPublic {
    return {
        task_id: id,
        operation: 'theme_song',
        status,
        target: { type: 'character', id: 'card-1', display_name: 'Card One' },
        title: 'Card One',
        status_url: `/tasks/theme_song/${id}`,
        result_url: `/theme-songs/jobs/${id}/result`,
        cancel_url: status === 'pending' ? `/tasks/theme_song/${id}` : null,
        result: status === 'completed' ? { assets: [], lyrics: { song_title: 'Aurora' } } : null,
        error: status === 'failed' ? { category: 'timeout', detail: 'Theme song generation timed out.' } : null,
        created_at: '2026-06-07T10:00:00',
        updated_at: '2026-06-07T10:00:00',
    }
}

function mockState(buckets: BackgroundTaskBuckets) {
    mocks.useBackgroundTasks.mockReturnValue({
        tasks: [...buckets.active, ...buckets.completed, ...buckets.failed],
        taskBuckets: buckets,
        activeTasks: buckets.active,
        activeCount: buckets.active.length,
        drawerOpen: false,
        openDrawer: vi.fn(),
        closeDrawer: vi.fn(),
        refreshTasks: vi.fn().mockResolvedValue(undefined),
        registerTask: vi.fn(),
        registerThemeSongJob: vi.fn(),
        cancelTask: vi.fn(),
    })
    mocks.useData.mockReturnValue({ characters: [], worlds: [], items: [], templateAdventures: [] })
}

describe('SidebarTasksMenu', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows the active-count label on the trigger', () => {
        mockState({ active: [task('pending', 'a-1'), task('in_progress', 'a-2')], completed: [], failed: [] })
        render(<SidebarTasksMenu />)
        expect(screen.getByRole('button', { name: /2 active tasks/i })).toBeInTheDocument()
    })

    it('opens the popover on click and closes on Escape', () => {
        mockState({ active: [], completed: [], failed: [] })
        render(<SidebarTasksMenu />)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        const trigger = screen.getByRole('button', { name: 'Tasks' })
        fireEvent.click(trigger)

        expect(screen.getByRole('dialog', { name: 'Tasks' })).toBeInTheDocument()
        expect(trigger).toHaveAttribute('aria-expanded', 'true')

        fireEvent.keyDown(document.body, { key: 'Escape' })
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes on an outside pointer-down', () => {
        mockState({ active: [], completed: [], failed: [] })
        render(<SidebarTasksMenu defaultOpen />)

        const trigger = screen.getByRole('button', { name: 'Tasks' })
        expect(trigger).toHaveAttribute('aria-expanded', 'true')

        fireEvent.pointerDown(document.body)
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('keeps the popover open when interacting inside it', () => {
        mockState({ active: [task('pending', 'a-1')], completed: [], failed: [] })
        render(<SidebarTasksMenu defaultOpen />)

        const trigger = screen.getByRole('button', { name: /1 active task/i })
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Refresh' }))

        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('dialog', { name: 'Tasks' })).toBeInTheDocument()
    })

    it('renders the shared task panel inside the popover', () => {
        mockState({ active: [task('pending', 'a-1')], completed: [], failed: [] })
        render(<SidebarTasksMenu defaultOpen />)

        expect(screen.getByRole('group', { name: 'Filter tasks by status' })).toBeInTheDocument()
        expect(screen.getByText('Queued')).toBeInTheDocument()
    })
})
