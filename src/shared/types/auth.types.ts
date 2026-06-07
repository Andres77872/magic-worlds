/**
 * Authentication types
 */

export interface User {
    user_hash: string
    username: string
    email?: string | null
    user_type: string
    created_at: string | null
    updated_at: string | null
}

/**
 * Per-type counts of cards the user has authored, as returned inside the
 * `/user/me` response (magic-worlds-api `UserCardCounts`).
 */
export interface UserCardCounts {
    character: number
    world: number
    adventure_template: number
}

/**
 * Shape of `GET /user/me` (magic-worlds-api `UserMeResponse`). Distinct from
 * {@link User}: the profile endpoint carries usage + content stats rather than
 * the email/timestamps returned at login. This API is read-only — username,
 * email and password are owned by the external auth provider.
 */
export interface UserProfile {
    user_hash: string
    username: string
    user_type: string
    /** Usage quota / credits (reserved for a future credit system). */
    user_usage: number
    card_counts: UserCardCounts
}

export interface Project {
    project_hash: string
    project_name: string
    project_description: string
    created_at: string | null
    updated_at: string | null
}

export interface UserGroupInfo {
    group_hash: string
    group_name: string
    description?: string
}

export interface LoginResponse {
    success: boolean
    message: string
    session_token?: string
    user?: User
    project?: Project | null
    accessible_projects?: Project[]
    user_groups?: UserGroupInfo[]
    expires_at?: string | null
    user_id?: number
}

export interface LoginCredentials {
    username: string
    password: string
}

export interface RegisterData {
    username: string
    password: string
    email?: string
}

export interface RegisterResponse {
    success: boolean
    message: string
    user?: User
    project?: Project | null
    user_id?: number
}

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export interface AuthState {
    isAuthenticated: boolean
    user: User | null
    token: string | null
    projects: Project[]
    isLoading: boolean
    error: string | null
} 
