/**
 * GuidedSection — a StudioSection driven by a GuidedSectionDefinition: bespoke
 * first-class fields (children) first, then the section's active guided rows,
 * then its "add a field" palette. Removing a filled field asks once.
 *
 * Renders nothing when the section has no content for the current role —
 * e.g. the persona-only Boundaries section while editing an AI character.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { StudioSection } from '../components/StudioSection'
import { GuidedFieldRow } from './GuidedFieldRow'
import { FieldPalette } from './FieldPalette'
import type { GuidedCardApi } from './useGuidedCard'
import type { CardFieldDefinition, GuidedSectionDefinition } from './types'

export interface GuidedSectionProps {
    section: GuidedSectionDefinition
    guided: GuidedCardApi
    /** Bespoke first-class fields rendered above the guided rows. */
    children?: ReactNode
    /** Rendered after the guided rows, before the palette (quick-adds, managers). */
    footer?: ReactNode
    /** Right-aligned header slot, passed through to StudioSection. */
    right?: ReactNode
}

export function GuidedSection({ section, guided, children, footer, right }: GuidedSectionProps) {
    const { t } = useTranslation()
    const [pendingRemove, setPendingRemove] = useState<CardFieldDefinition | null>(null)

    const inSection = (field: CardFieldDefinition) => section.fieldIds.includes(field.id)
    const active = guided.activeFields.filter(inSection)
    const palette = guided.paletteFields.filter(inSection)

    if (!children && !footer && active.length === 0 && palette.length === 0) return null

    const requestRemove = (field: CardFieldDefinition) => {
        if (guided.values[field.id]?.trim()) setPendingRemove(field)
        else guided.removeField(field.id)
    }

    return (
        <StudioSection
            id={section.id}
            icon={section.icon}
            tone={section.tone}
            title={section.title}
            description={section.description}
            right={right}
        >
            {children}
            {active.map((field) => (
                <GuidedFieldRow
                    key={field.id}
                    field={field}
                    value={guided.values[field.id] ?? ''}
                    hint={guided.hints[field.id]}
                    offRole={guided.isOffRole(field)}
                    onChange={(value) => guided.setValue(field.id, value)}
                    onRemove={field.removable === false ? undefined : () => requestRemove(field)}
                    onUseExample={() => guided.useExample(field.id)}
                />
            ))}
            {footer}
            <FieldPalette fields={palette} onAdd={guided.activateField} />
            <ConfirmDialog
                visible={pendingRemove !== null}
                title={t('creation.common.guidedSection.discardTitle', { label: pendingRemove?.label ?? '' })}
                message={t('creation.common.guidedSection.discardMessage')}
                confirmLabel={t('creation.common.guidedSection.discardConfirm')}
                variant="danger"
                onConfirm={() => {
                    if (pendingRemove) guided.removeField(pendingRemove.id)
                    setPendingRemove(null)
                }}
                onCancel={() => setPendingRemove(null)}
            />
        </StudioSection>
    )
}
