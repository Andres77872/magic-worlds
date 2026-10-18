import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
/**
 * 03 §5.12 / 05 §9.3 (R1-FE-03): the card preview modal dates a leaving voice
 * ("Leaving on {date}") from the catalog `disable_at` of the stored voice; the
 * catalog is read only for an ElevenLabs projection badged `leaving`.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { apiService } from '@/infrastructure/api'
import { CATALOG_SELA_LEAVING, V2_VOICE, VOICE_KEY_SELA, effectiveVoice } from '@/features/voices/fixtures'
import { formatBadgeDate } from '@/features/voices/components/VoiceBadges'
import type { CardPreview } from '../cardPreview'
import { CardPreviewBody } from './CardPreviewBody'

const STORED = { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela' }
const LEAVING = effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] })
const CHARACTER: CardPreview = { id: 'c1', type: 'character', mediaType: 'character', title: 'Lyra', triggers: [], voice: { stored: STORED, effective: LEAVING } }

let readCatalog: ReturnType<typeof vi.spyOn>

/** Lets the catalog lookup start its deferred read (it begins a microtask after the effect), so a stray read is seen. */
async function flushReads() {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

beforeEach(async () => {
    await i18n.changeLanguage('en')
    readCatalog = vi.spyOn(apiService, 'getVoiceCatalogByKeys').mockResolvedValue([CATALOG_SELA_LEAVING])
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('CardPreviewBody leaving voice (05 §9.3)', () => {
    it('reads "Leaving on {date}" from the catalog, not "Leaving soon"', async () => {
        render(<CardPreviewBody card={CHARACTER} loading={false} error={null} />)
        const line = screen.getByTestId('card-preview-voice')
        const expected = `Leaving on ${formatBadgeDate(CATALOG_SELA_LEAVING.disable_at, 'en')}`
        expect(await within(line).findByText(expected)).toBeInTheDocument()
        expect(within(line).queryByText('Leaving soon')).not.toBeInTheDocument()
        expect(readCatalog).toHaveBeenCalledWith([VOICE_KEY_SELA])
    })

    it('keeps "Leaving soon" when the catalog has no entry', async () => {
        readCatalog.mockResolvedValue([])
        render(<CardPreviewBody card={CHARACTER} loading={false} error={null} />)
        await waitFor(() => expect(readCatalog).toHaveBeenCalledTimes(1))
        expect(within(screen.getByTestId('card-preview-voice')).getByText('Leaving soon')).toBeInTheDocument()
    })

    it('reads nothing for a voice that is not leaving, or without a projection', async () => {
        const { unmount } = render(<CardPreviewBody card={{ ...CHARACTER, voice: { stored: STORED, effective: { ...LEAVING, badges: ['replaced'] } } }} loading={false} error={null} />)
        await flushReads()
        expect(screen.getByTestId('card-preview-voice')).toHaveTextContent('Sela')
        expect(readCatalog).not.toHaveBeenCalled()
        unmount()
        render(<CardPreviewBody card={{ ...CHARACTER, voice: { stored: STORED, effective: null } }} loading={false} error={null} />)
        await flushReads()
        expect(screen.queryByTestId('card-preview-voice')).not.toBeInTheDocument()
        expect(readCatalog).not.toHaveBeenCalled()
    })
})
