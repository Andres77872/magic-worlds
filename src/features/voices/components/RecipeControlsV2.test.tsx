import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VoiceSurfaceCapabilities } from '@/shared'
import { surfaceCapabilitiesFor } from '@/shared/voice'
import { CAPABILITIES_EL_PLUS } from '../fixtures'
import { normalizeSettingsForWrite } from '../recipeV2'
import { ControlSlider } from './ControlSlider'
import { RecipeControlsV2, visibleControls } from './RecipeControlsV2'

const standard = surfaceCapabilitiesFor(CAPABILITIES_EL_PLUS, 'preview', 'standard') as VoiceSurfaceCapabilities
const expressive = surfaceCapabilitiesFor(CAPABILITIES_EL_PLUS, 'preview', 'expressive') as VoiceSurfaceCapabilities

describe('RecipeControlsV2 (R1-FE-02, D13)', () => {
    it('renders stability, similarity and speed with the server’s ranges and defaults', () => {
        render(<RecipeControlsV2 surface={standard} settings={null} onChange={vi.fn()} />)
        const stability = screen.getByLabelText('Stability')
        expect(stability).toHaveAttribute('min', '0')
        expect(stability).toHaveAttribute('max', '1')
        expect(stability).toHaveAttribute('step', '0.05')
        expect(stability).toHaveValue('0.5')
        expect(screen.getByLabelText('Similarity')).toHaveValue('0.75')
        const speed = screen.getByLabelText('Speed')
        expect(speed).toHaveAttribute('min', '0.7')
        expect(speed).toHaveAttribute('max', '1.2')
        expect(screen.queryByText(/Style/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/speaker boost/i)).not.toBeInTheDocument()
    })

    it('never shows a control the server does not mark editable or ranges', () => {
        const surface: VoiceSurfaceCapabilities = {
            ...standard,
            controls: [
                { ...standard.controls[0], user_editable: false },
                { key: 'style', min: 0, max: 1, step: 0.05, default: 0, user_editable: true },
                { key: 'use_speaker_boost', default: true, user_editable: true },
                { ...standard.controls[1], min: undefined },
                standard.controls[2],
            ],
        }
        expect(visibleControls(surface).map((spec) => spec.key)).toEqual(['speed'])
        expect(visibleControls(null)).toEqual([])
    })

    it('quantizes a change and keeps the other values', () => {
        const onChange = vi.fn()
        render(<RecipeControlsV2 surface={standard} settings={{ stability: 0.4, speed: 1.1 }} onChange={onChange} />)
        fireEvent.change(screen.getByLabelText('Similarity'), { target: { value: '0.83' } })
        expect(onChange).toHaveBeenCalledWith({ stability: 0.4, speed: 1.1, similarity_boost: 0.85 })
    })

    it('hides speed on Expressive but keeps the stored value', () => {
        const onChange = vi.fn()
        render(<RecipeControlsV2 surface={expressive} settings={{ stability: 0.4, speed: 1.1 }} onChange={onChange} />)
        expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument()
        expect(screen.getByText('Speed applies to Standard narration and calls.')).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Stability'), { target: { value: '0.6' } })
        expect(onChange).toHaveBeenCalledWith({ stability: 0.6, speed: 1.1 })
    })

    it('tags a slider at the voice default with "Voice default" (05 §5.1)', () => {
        render(<RecipeControlsV2 surface={standard} settings={{ stability: 0.4 }} onChange={vi.fn()} />)
        const tagOf = (label: string) => screen.getByLabelText(label).closest('div.flex-col')?.querySelector('[data-testid="control-default-tag"]') ?? null
        expect(tagOf('Stability')).toBeNull()
        expect(tagOf('Similarity')).toHaveTextContent('Voice default')
        expect(tagOf('Speed')).toHaveTextContent('Voice default')
        expect(screen.getByLabelText('Similarity')).toHaveAttribute('aria-valuetext', 'Similarity 0.75, closer to the voice, Voice default')
        expect(screen.getByLabelText('Stability')).toHaveAttribute('aria-valuetext', 'Stability 0.40, more expressive')
    })

    it('marks the Expressive controls and links back to the Standard ones (05 §5.1, AC-E1)', () => {
        const onShowStandard = vi.fn()
        const { rerender } = render(<RecipeControlsV2 surface={expressive} settings={null} onChange={vi.fn()} onShowStandard={onShowStandard} />)
        expect(screen.getByTestId('recipe-controls-v2').querySelector('[data-badge="expressive_only"]')).toHaveTextContent('Expressive')
        fireEvent.click(screen.getByRole('button', { name: 'Show Standard controls' }))
        expect(onShowStandard).toHaveBeenCalledTimes(1)
        rerender(<RecipeControlsV2 surface={standard} settings={null} onChange={vi.fn()} onShowStandard={onShowStandard} />)
        expect(screen.queryByRole('button', { name: 'Show Standard controls' })).not.toBeInTheDocument()
        expect(screen.getByTestId('recipe-controls-v2').querySelector('[data-badge]')).toBeNull()
        // A Standard surface without speed keeps the note but never links to the tier already shown.
        rerender(<RecipeControlsV2 surface={{ ...standard, supports_speed: false }} settings={null} onChange={vi.fn()} onShowStandard={onShowStandard} />)
        expect(screen.getByText('Speed applies to Standard narration and calls.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Show Standard controls' })).not.toBeInTheDocument()
    })

    it('leaves the console slider without the tag, end labels or notice unless the host asks for them', () => {
        // A V2 control at its default, with none of the opt-in props the recipe passes.
        render(<ControlSlider label="Stability" value={0.5} min={0} max={1} step={0.05} defaultValue={0.5} onChange={vi.fn()} />)
        expect(screen.queryByTestId('control-default-tag')).not.toBeInTheDocument()
        expect(screen.queryByTestId('control-ends')).not.toBeInTheDocument()
        const stability = screen.getByLabelText('Stability')
        expect(stability).toHaveAttribute('aria-valuetext', '0.5')
        expect(stability).not.toHaveAttribute('aria-describedby')
        // The row holds exactly the header and the track, as before the opt-in slots.
        expect(stability.parentElement?.children).toHaveLength(2)
    })

    it('labels the stability and similarity ends, and shows speed as a multiple (05 §5.1, §9.3, §10)', () => {
        render(<RecipeControlsV2 surface={standard} settings={{ stability: 0.7, speed: 1.05 }} onChange={vi.fn()} />)
        const endsOf = (label: string) => screen.getByLabelText(label).parentElement?.querySelector('[data-testid="control-ends"]') ?? null
        expect(endsOf('Stability')).toHaveTextContent(/^More expressiveMore consistent$/)
        expect(endsOf('Similarity')).toHaveTextContent(/^LooserCloser to the voice$/)
        expect(endsOf('Speed')).toBeNull()
        expect(screen.getByLabelText('Stability')).toHaveAttribute('aria-valuetext', 'Stability 0.70, more consistent')
        expect(screen.getByText('1.05×')).toBeInTheDocument()
        expect(screen.getByText('0.75')).toBeInTheDocument()
        expect(screen.getByLabelText('Speed')).toHaveAttribute('aria-valuetext', 'Speed 1.05 times')
    })

    it('names no end at the middle of the range', () => {
        render(<RecipeControlsV2 surface={standard} settings={{ stability: 0.5 }} onChange={vi.fn()} />)
        expect(screen.getByLabelText('Stability')).toHaveAttribute('aria-valuetext', 'Stability 0.50, Voice default')
    })

    describe('a stored value outside the range (AC-E2)', () => {
        const flagOf = (key: string) => screen.queryAllByTestId('recipe-out-of-range').find((node) => node.getAttribute('data-key') === key) ?? null

        it('shows it clamped and flagged under its slider, and writes nothing until the user acts', () => {
            const onChange = vi.fn()
            render(<RecipeControlsV2 surface={standard} settings={{ stability: 0.4, speed: 1.5 }} onChange={onChange} />)
            const speed = screen.getByLabelText('Speed')
            expect(speed).toHaveValue('1.2')
            expect(screen.getByText('1.20×')).toBeInTheDocument()
            expect(screen.queryByText('1.50×')).not.toBeInTheDocument()
            const flag = flagOf('speed') as HTMLElement
            expect(flag).toHaveTextContent('Speed was saved as 1.50×, outside the supported range, so it shows as 1.20×. Saving this preset stores 1.20×.')
            expect(flag).toHaveAttribute('role', 'note')
            // The flag describes its slider.
            expect(speed.getAttribute('aria-describedby')).toBe(flag.parentElement?.id)
            expect(flagOf('stability')).toBeNull()
            expect(onChange).not.toHaveBeenCalled()
        })

        it('flags a value below the range too, and clears the flag once the slider moves', () => {
            const onChange = vi.fn()
            const { rerender } = render(<RecipeControlsV2 surface={standard} settings={{ speed: 0.5, similarity_boost: -0.2 }} onChange={onChange} />)
            expect(flagOf('speed')).toHaveTextContent('saved as 0.50×')
            expect(flagOf('speed')).toHaveTextContent('stores 0.70×')
            expect(flagOf('similarity_boost')).toHaveTextContent('Similarity was saved as -0.20, outside the supported range, so it shows as 0.00.')
            fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '0.9' } })
            expect(onChange).toHaveBeenCalledWith({ speed: 0.9, similarity_boost: -0.2 })
            rerender(<RecipeControlsV2 surface={standard} settings={{ speed: 0.9, similarity_boost: -0.2 }} onChange={onChange} />)
            expect(flagOf('speed')).toBeNull()
            expect(flagOf('similarity_boost')).not.toBeNull()
        })

        it('flags a hidden value the save clamps (speed on Expressive), from the write controls', () => {
            const onChange = vi.fn()
            const writeControls = [...standard.controls, ...expressive.controls]
            const { rerender } = render(<RecipeControlsV2 surface={expressive} settings={{ speed: 1.35 }} onChange={onChange} writeControls={writeControls} />)
            expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument()
            expect(flagOf('speed')).toHaveTextContent('Speed was saved as 1.35×, outside the supported range. Saving this preset stores 1.20×.')
            fireEvent.change(screen.getByLabelText('Stability'), { target: { value: '0.6' } })
            // The hidden value is kept as stored: only the save clamps it.
            expect(onChange).toHaveBeenCalledWith({ speed: 1.35, stability: 0.6 })
            // Without write controls the Expressive surface has no speed range, so nothing would clamp it.
            rerender(<RecipeControlsV2 surface={expressive} settings={{ speed: 1.35 }} onChange={onChange} />)
            expect(flagOf('speed')).toBeNull()
        })

        it('flags it on the read-only recipe as well', () => {
            render(<RecipeControlsV2 surface={null} settings={{ speed: 1.5 }} onChange={vi.fn()} writeControls={standard.controls} />)
            expect(screen.getByText('Speed 1.5×')).toBeInTheDocument()
            expect(flagOf('speed')).toHaveTextContent('Speed was saved as 1.50×, outside the supported range. Saving this preset stores 1.20×.')
        })

        it('shows an in-range value off the 0.05 grid as the save writes it, with no flag (05 §5.1, AC-E2)', () => {
            const onChange = vi.fn()
            render(<RecipeControlsV2 surface={standard} settings={{ stability: 0.43, speed: 1.12 }} onChange={onChange} />)
            const stability = screen.getByLabelText('Stability')
            expect(stability).toHaveValue('0.45')
            expect(screen.getByText('0.45')).toBeInTheDocument()
            expect(screen.queryByText('0.43')).not.toBeInTheDocument()
            expect(stability).toHaveAttribute('aria-valuetext', 'Stability 0.45, more expressive')
            expect(screen.getByLabelText('Speed')).toHaveValue('1.1')
            expect(screen.getByText('1.10×')).toBeInTheDocument()
            expect(normalizeSettingsForWrite({ stability: 0.43, speed: 1.12 }, standard.controls)).toEqual({ stability: 0.45, speed: 1.1 })
            expect(screen.queryByTestId('recipe-out-of-range')).not.toBeInTheDocument()
            expect(onChange).not.toHaveBeenCalled()
        })

        it('never flags values inside the range, at its ends, or with float noise', () => {
            render(<RecipeControlsV2 surface={standard} settings={{ stability: 1, similarity_boost: 0, speed: 1.2000000000001 }} onChange={vi.fn()} />)
            expect(screen.queryByTestId('recipe-out-of-range')).not.toBeInTheDocument()
        })
    })

    it('"Use voice defaults" stores no settings', () => {
        const onChange = vi.fn()
        const { rerender } = render(<RecipeControlsV2 surface={standard} settings={{ stability: 0.4 }} onChange={onChange} />)
        fireEvent.click(screen.getByRole('button', { name: 'Use voice defaults' }))
        expect(onChange).toHaveBeenCalledWith(null)
        rerender(<RecipeControlsV2 surface={standard} settings={null} onChange={onChange} />)
        expect(screen.getByRole('button', { name: 'Use voice defaults' })).toBeDisabled()
    })

    it('shows read-only chips and a retry without capabilities', () => {
        const onRetry = vi.fn()
        render(<RecipeControlsV2 surface={null} settings={{ stability: 0.4, speed: 1.1 }} onChange={vi.fn()} onRetry={onRetry} />)
        expect(screen.getByTestId('recipe-controls-readonly')).toBeInTheDocument()
        expect(screen.getByText('Stability 0.4')).toBeInTheDocument()
        expect(screen.queryByRole('slider')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})
