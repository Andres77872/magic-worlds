/**
 * Authentication types
 */

export interface User {
    user_hash: string
    username: string
    email: string
    user_type: string
    created_at: string | null
    updated_at: string | null
}

export interface Project {
    project_hash: string
    project_name: string
    project_description: string
    created_at: string | null
    updated_at: string | null
}

export interface LoginResponse {
    success: boolean
    message: string
    session_token: string
    user: User
    project: Project | null
    accessible_projects: Project[]
    expires_at: string | null
}

export interface LoginCredentials {
    username: string
    password: string
}

export interface AuthState {
    isAuthenticated: boolean
    user: User | null
    token: string | null
    projects: Project[]
    isLoading: boolean
    error: string | null
} 