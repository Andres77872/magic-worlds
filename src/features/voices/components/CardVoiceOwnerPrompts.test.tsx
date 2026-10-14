import { useRef, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectiveVoice, StoredCharacterVoice } from '@/shared'
import { CATALOG_SELA_LEAVING, V2_VOICE, VOICE_KEY_MAREN, VOICE_KEY_SELA, effectiveVoice } from '../fixtures'
import { CardVoiceOwnerPrompts } from './CardVoiceOwnerPrompts'

const getVoiceCatalogByKeys = vi.fn()

vi.mock('@/infrastructure/api', () => ({
    apiService: { getVoiceCatalogByKeys: (...args: unknown[]) => getVoiceCatalogByKeys(...args) },
}))

const SELA_VOICE = { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela', emotion: 'calm' as const, preset_id: 'user-v2', preset_name: 'Night ferry' }
const SELA_LEAVING = effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] })

/** A host like the character editor: a switch drops the projection; focus returns to "Change voice". */
function EditorHost({ stored, effective, leavingItem }: { stored: StoredCharacterVoice; effective: EffectiveVoice; leavingItem?: typeof CATALOG_SELA_LEAVING | null }) {
    const [voice, setVoice] = useState<StoredCharacterVoice>(stored)
    const [projection, setProjection] = useState<EffectiveVoice | null>(effective)
    const change = useRef<HTMLButtonElement>(null)
    return (
        <div>
            {projection && (
                <CardVoiceOwnerPrompts
                    stored={voice}
                    effective={projection}
                    leavingItem={leavingItem}
                    onSwitch={(next) => {
                        setVoice(next)
                        setProjection(null)
                    }}
                    onChoose={vi.fn()}
                    returnFocus={() => change.current?.focus()}
                />
            )}
            <button ref={change} type="button">Change voice</button>
        </div>
    )
}

describe('CardVoiceOwnerPrompts (05 §7.7 character editor, §7.8)', () => {
    beforeEach(() => {
        getVoiceCatalogByKeys.mockReset().mockResolvedValue([CATALOG_SELA_LEAVING])
    })

    it('switches a leaving card voice to its replacement, keeping the recipe', async () => {
        const onSwitch = vi.fn()
        render(
            <CardVoiceOwnerPrompts
                stored={SELA_VOICE}
                effective={effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] })}
                onSwitch={onSwitch}
                onChoose={vi.fn()}
            />,
        )
        fireEvent.click(await screen.findByRole('button', { name: 'Switch to Maren' }))
        expect(getVoiceCatalogByKeys).toHaveBeenCalledWith([VOICE_KEY_SELA])
        expect(onSwitch).toHaveBeenCalledWith({
            ...SELA_VOICE,
            voice_key: VOICE_KEY_MAREN,
            voice_name: 'Maren',
            preset_id: null,
            preset_name: null,
        })
    })

    it('opens the picker for a voice that needs re-selection or is retired, without a catalog read', () => {
        const onChoose = vi.fn()
        const { unmount } = render(
            <CardVoiceOwnerPrompts stored={V2_VOICE} effective={effectiveVoice({ badges: ['needs_reselect'] })} onSwitch={vi.fn()} onChoose={onChoose} />,
        )
        fireEvent.click(screen.getByRole('button', { name: 'Choose a voice' }))
        fireEvent.click(screen.getByRole('button', { name: 'Keep for now' }))
        expect(screen.queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        unmount()

        render(<CardVoiceOwnerPrompts stored={V2_VOICE} effective={effectiveVoice({ badges: ['retired'] })} onSwitch={vi.fn()} onChoose={onChoose} />)
        fireEvent.click(screen.getByRole('button', { name: 'Pick another' }))
        expect(onChoose).toHaveBeenCalledTimes(2)
        expect(getVoiceCatalogByKeys).not.toHaveBeenCalled()
    })

    it('uses the leaving entry the host looked up instead of reading the catalog again', () => {
        const onSwitch = vi.fn()
        const { unmount } = render(<CardVoiceOwnerPrompts stored={SELA_VOICE} effective={SELA_LEAVING} leavingItem={CATALOG_SELA_LEAVING} onSwitch={onSwitch} onChoose={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Switch to Maren' }))
        expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ voice_key: VOICE_KEY_MAREN }))
        unmount()

        // The host's lookup has not answered (or found nothing): no switch yet, still no read here.
        const { container } = render(<CardVoiceOwnerPrompts stored={SELA_VOICE} effective={SELA_LEAVING} leavingItem={null} onSwitch={vi.fn()} onChoose={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
        // A slot without a stored voice: its leaving projection is matched by the voice it plays.
        render(<CardVoiceOwnerPrompts stored={null} effective={SELA_LEAVING} leavingItem={CATALOG_SELA_LEAVING} onSwitch={vi.fn()} onChoose={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Switch to Maren' })).toBeInTheDocument()
        expect(getVoiceCatalogByKeys).not.toHaveBeenCalled()
    })

    it('returns focus to the host once "Keep for now" or "Switch to" unmounts under it (05 §10)', async () => {
        const { unmount } = render(<EditorHost stored={V2_VOICE} effective={effectiveVoice({ badges: ['needs_reselect'] })} />)
        const keep = screen.getByRole('button', { name: 'Keep for now' })
        keep.focus()
        fireEvent.click(keep)
        expect(screen.queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole('button', { name: 'Change voice' })).toHaveFocus())
        unmount()

        render(<EditorHost stored={SELA_VOICE} effective={SELA_LEAVING} leavingItem={CATALOG_SELA_LEAVING} />)
        const switchTo = screen.getByRole('button', { name: 'Switch to Maren' })
        switchTo.focus()
        fireEvent.click(switchTo)
        expect(screen.queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole('button', { name: 'Change voice' })).toHaveFocus())
    })

    it('leaves focus alone when the acted-on prompt stays (the picker took it)', async () => {
        const returnFocus = vi.fn()
        render(<CardVoiceOwnerPrompts stored={V2_VOICE} effective={effectiveVoice({ badges: ['retired'] })} onSwitch={vi.fn()} onChoose={vi.fn()} returnFocus={returnFocus} />)
        const pick = screen.getByRole('button', { name: 'Pick another' })
        pick.focus()
        fireEvent.click(pick)
        await new Promise((resolve) => setTimeout(resolve, 5))
        expect(returnFocus).not.toHaveBeenCalled()
        expect(pick).toHaveFocus()
    })

    it('renders nothing without a projection or without prompt badges', async () => {
        const { container, rerender } = render(<CardVoiceOwnerPrompts stored={V2_VOICE} effective={null} onSwitch={vi.fn()} onChoose={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
        rerender(<CardVoiceOwnerPrompts stored={V2_VOICE} effective={undefined} onSwitch={vi.fn()} onChoose={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
        rerender(<CardVoiceOwnerPrompts stored={V2_VOICE} effective={effectiveVoice({ badges: ['replaced'] })} onSwitch={vi.fn()} onChoose={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
        // A leaving voice without a catalog replacement offers no switch.
        getVoiceCatalogByKeys.mockResolvedValue([{ ...CATALOG_SELA_LEAVING, replacement: null }])
        rerender(<CardVoiceOwnerPrompts stored={SELA_VOICE} effective={effectiveVoice({ voice_key: VOICE_KEY_SELA, badges: ['leaving'] })} onSwitch={vi.fn()} onChoose={vi.fn()} />)
        await waitFor(() => expect(getVoiceCatalogByKeys).toHaveBeenCalled())
        expect(container).toBeEmptyDOMElement()
    })
})
