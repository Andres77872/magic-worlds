export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface UserNotification {
    notification_id: number
    type: string
    category: string
    severity: NotificationSeverity
    title: string
    body: string
    action_label: string | null
    action_url: string | null
    metadata: Record<string, unknown> | null
    read_at: string | null
    created_at: string
    expires_at: string | null
}

export interface NotificationListResponse {
    items: UserNotification[]
    limit: number
    offset: number
}

export interface NotificationUnreadCountResponse {
    unread_count: number
}

export interface NotificationReadAllResponse {
    updated: number
}
