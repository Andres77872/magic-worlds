/**
 * Guided-field engine types. A guided field is a styled, optional, removable
 * input bound to a `(category group, attribute key)` pair in the card's API
 * `category` payload — the engine renders rich per-card-type creation UIs
 * while serializing to the exact same JSON contract as the free-form
 * Attribute Manager.
 */
import type { LucideIcon } from 'lucide-react'
import type { SelectOption } from '@/ui/primitives'

export type GuidedInputKind = 'text' | 'textarea' | 'suggest' | 'select' | 'chips'

export interface GuidedBinding {
    /** Category group name — part of the saved card, never rename after ship. */
    group: string
    /** Attribute key inside the group — also part of the saved card. */
    key: string
    /** Written as the group's `description` when this field creates the group. */
    groupDescription?: string
}

export interface CardFieldDefinition {
    /** Stable id, e.g. 'personality.motivation'. Never serialized — the binding is. */
    id: string
    label: string
    /** One play-focused sentence: why this field matters at the table. */
    helper?: string
    input: GuidedInputKind
    /** For 'suggest' / 'select' — `description` renders as per-option example text. */
    options?: readonly SelectOption[]
    placeholder?: string
    rows?: number
    /** Default ghost example; templates override per field. */
    exampleHint?: string
    /** Default true. Non-removable fields are always active. */
    removable?: boolean
    /**
     * Role visibility, e.g. ['persona'] for persona-only fields. A role-hidden
     * field with a non-empty value stays visible (muted) so values never vanish.
     */
    roles?: string[]
    /**
     * Active without a template: true = always, string[] = for those roles.
     * Everything else starts in the "add a field" palette.
     */
    defaultActive?: boolean | string[]
    binding: GuidedBinding
}

export interface GuidedSectionDefinition {
    /** StudioSection anchor id — drives StudioSectionNav. */
    id: string
    title: string
    description?: string
    icon?: LucideIcon
    tone?: 'ember' | 'arcane'
    /** Which CardFieldDefinitions render here, in order. */
    fieldIds: string[]
}

export interface CardTemplate {
    id: string
    name: string
    /** Optional i18n key for `name`; resolved with t() at the template card. */
    nameKey?: string
    /** One evocative line shown on the template card. */
    tagline: string
    /** Optional i18n key for `tagline`; resolved with t() at the template card. */
    taglineKey?: string
    icon?: LucideIcon
    /** Guided field ids active on pick; everything else starts in the palette. */
    fieldIds: string[]
    /** Ghost example per guided field id (placeholder + one-click "use example"). */
    examples?: Record<string, string>
    /** Ghost placeholders for first-class fields, keyed by creator-known names ('name', 'race', 'greeting'…). */
    firstClassExamples?: Record<string, string>
    /** Character templates only: the card role this template implies. */
    role?: string
}

/**
 * A first-class form value dual-written into a category group so it survives
 * round-trips (e.g. world `place_type`, which the backend model drops).
 */
export interface GuidedMirror {
    group: string
    key: string
    groupDescription?: string
    /** Current first-class value — serialized into the group when non-empty. */
    value: string
    /** Called when hydration finds the mirrored attribute (assistant-apply). */
    onHydrate?: (value: string) => void
}
