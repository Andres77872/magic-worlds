import type {
    CardMediaTargetType,
    ThemeSongAssetPublic,
    ThemeSongErrorPublic,
    ThemeSongJobPublic,
    ThemeSongJobStatus,
    ThemeSongLyricsPublic,
} from './media.types'

export type BackgroundTaskOperation = 'theme_song'
export type BackgroundTaskState = 'active' | 'terminal' | 'all'

export const BACKGROUND_TASK_ACTIVE_STATUSES: ThemeSongJobStatus[] = ['pending', 'in_progress', 'synthesizing', 'mirroring']
export const BACKGROUND_TASK_COMPLETED_STATUSES: ThemeSongJobStatus[] = ['completed']
export const BACKGROUND_TASK_FAILED_STATUSES: ThemeSongJobStatus[] = ['failed', 'canceled']

export interface BackgroundTaskResult {
    assets: ThemeSongAssetPublic[]
    lyrics?: ThemeSongLyricsPublic | null
}

export interface BackgroundTaskPublic {
    task_id: string
    operation: BackgroundTaskOperation
    status: ThemeSongJobStatus
    target: {
        type: CardMediaTargetType
        id: string
        display_name?: string | null
    }
    title?: string | null
    status_url: string
    result_url: string
    cancel_url?: string | null
    result?: BackgroundTaskResult | null
    error?: ThemeSongErrorPublic | null
    created_at: string
    updated_at: string
}

export interface BackgroundTaskListResponse {
    items: BackgroundTaskPublic[]
    limit: number
    offset: number
    next_offset?: number | null
}

export interface BackgroundTaskBuckets {
    active: BackgroundTaskPublic[]
    completed: BackgroundTaskPublic[]
    failed: BackgroundTaskPublic[]
}

export function taskFromThemeSongJob(job: ThemeSongJobPublic): BackgroundTaskPublic {
    return {
        task_id: job.job_id,
        operation: 'theme_song',
        status: job.status,
        target: job.target,
        title: job.target.display_name || 'Theme song',
        status_url: `/tasks/theme_song/${job.job_id}`,
        result_url: job.result_url,
        cancel_url: job.status === 'pending' ? `/tasks/theme_song/${job.job_id}` : null,
        result: job.assets.length || job.lyrics ? { assets: job.assets, lyrics: job.lyrics } : null,
        error: job.error ?? null,
        created_at: job.created_at,
        updated_at: job.updated_at,
    }
}
