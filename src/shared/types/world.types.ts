/**
 * World domain types and interfaces
 */

export interface World {
    id: string
    name: string
    type: string
    description?: string
    details: Record<string, string>
    createdAt?: string
    updatedAt?: string
}

export interface WorldDetails {
    [key: string]: string
}

export interface WorldFormData {
    name: string
    type: string
    description?: string
    details: WorldDetails
}
