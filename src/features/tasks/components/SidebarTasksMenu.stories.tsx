import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import type { BackgroundTaskBuckets, BackgroundTaskPublic } from '@/shared'
import { BackgroundTasksContext } from '@/app/providers/backgroundTasksContext'
import { DataContext } from '@/app/providers/DataProvider'
import { SidebarTasksMenu } from './SidebarTasksMenu'

type TasksValue = NonNullable<ComponentProps<typeof BackgroundTasksContext.Provider>['value']>
type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>

function task(
    status: BackgroundTaskPublic['status'],
    id: string,
    songTitle?: string,
): BackgroundTaskPublic {
    return {
        task_id: id,
        operation: 'theme_song',
        status,
        target: { type: 'character', id: `card-${id}`, display_name: 'Whisperwind' },
        title: songTitle ?? 'Whisperwind',
        status_url: `/tasks/theme_song/${id}`,
        result_url: `/theme-songs/jobs/${id}/result`,
        cancel_url: status === 'pending' ? `/tasks/theme_song/${id}` : null,
        result: status === 'completed' ? { assets: [], lyrics: { song_title: songTitle ?? 'Aurora hymn' } } : null,
        error: status === 'failed' ? { category: 'timeout', detail: 'Theme song generation timed out.' } : null,
        created_at: '2026-06-07T10:00:00',
        updated_at: '2026-06-07T10:05:00',
    }
}

function tasksValue(buckets: BackgroundTaskBuckets): TasksValue {
    return {
        tasks: [...buckets.active, ...buckets.completed, ...buckets.failed],
        taskBuckets: buckets,
        activeTasks: buckets.active,
        activeCount: buckets.active.length,
        drawerOpen: false,
        openDrawer: () => {},
        closeDrawer: () => {},
        refreshTasks: async () => {},
        registerTask: () => {},
        registerThemeSongJob: () => {},
        cancelTask: async () => {},
    }
}

// The panel only reads the four list arrays from data context; the rest of the
// provider surface is irrelevant to this view, so a minimal stub stands in.
const data = { characters: [], worlds: [], items: [], templateAdventures: [] } as unknown as DataValue

const withTasks = (buckets: BackgroundTaskBuckets): Decorator =>
    function Provided(Story) {
        return (
            <DataContext.Provider value={data}>
                <BackgroundTasksContext.Provider value={tasksValue(buckets)}>
                    <div style={{ display: 'flex', minHeight: 540, alignItems: 'flex-end', gap: '1rem' }}>
                        <div style={{ width: 56 }}>
                            <Story />
                        </div>
                        <p className="max-w-prose font-narrative text-parchment-400">
                            The tasks popover rises from the sidebar footer, mirroring the API-status and account
                            menus. Switch tabs to triage active, completed and failed theme songs; expand a row for
                            its waveform, attached card and timestamps.
                        </p>
                    </div>
                </BackgroundTasksContext.Provider>
            </DataContext.Provider>
        )
    }

const meta = {
    title: 'Components/SidebarTasksMenu',
    component: SidebarTasksMenu,
    tags: ['autodocs'],
    args: { collapsed: false, defaultOpen: true },
    argTypes: {
        collapsed: { control: 'boolean' },
        defaultOpen: { control: 'boolean' },
    },
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Desktop host for the background-tasks UI: an anchored popover that rises from the sidebar tasks button and wraps the shared TasksPanel. Mobile keeps the full-height TasksDrawer.',
            },
        },
    },
} satisfies Meta<typeof SidebarTasksMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
    decorators: [withTasks({ active: [], completed: [], failed: [] })],
}

export const ActiveTasks: Story = {
    decorators: [
        withTasks({
            active: [task('pending', '1'), task('synthesizing', '2'), task('mirroring', '3')],
            completed: [],
            failed: [],
        }),
    ],
}

export const Mixed: Story = {
    decorators: [
        withTasks({
            active: [task('synthesizing', '1', 'Ember of dawn')],
            completed: [task('completed', '2', 'Whisperwind theme'), task('completed', '3', 'Sunken keep')],
            failed: [task('failed', '4'), task('canceled', '5')],
        }),
    ],
}

export const Collapsed: Story = {
    args: { collapsed: true, defaultOpen: true },
    decorators: [
        withTasks({
            active: [task('pending', '1'), task('synthesizing', '2')],
            completed: [task('completed', '3', 'Whisperwind theme')],
            failed: [],
        }),
    ],
}
