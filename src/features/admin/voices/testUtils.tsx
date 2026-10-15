/** Test helpers for the root voice console (never imported by the application). */
import type { ReactElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import type { AdminVoiceMetricsArea } from '@/shared'
import { VoiceConsoleProvider, type ConsoleModule } from './components/shell/VoiceConsoleContext'
import { auditCatalogVoices, auditDefaults, auditGlobalPresets, auditLibraryPage, auditLimits } from './fixtures'
import { metricsByArea } from './metricsFixtures'

/** Fresh `apiService` mocks for every console method, resolving the audit fixtures. */
export function consoleApiMock() {
    return {
        listAdminCatalog: vi.fn().mockResolvedValue({ items: auditCatalogVoices, next_cursor: null, summary: null }),
        updateAdminCatalogVoice: vi.fn(),
        getAdminCatalogImpact: vi.fn(),
        syncAdminCatalog: vi.fn().mockResolvedValue({ job: 'A', run_id: 'run-1', status: 'queued' }),
        deleteAdminCatalogVoice: vi.fn(),
        renderAcceptance: vi.fn(),
        putAcceptanceVerdict: vi.fn(),
        renderCatalogSamples: vi.fn(),
        getVoiceDefaults: vi.fn().mockResolvedValue(auditDefaults),
        putVoiceDefaults: vi.fn(),
        listAdminLibrary: vi.fn().mockResolvedValue(auditLibraryPage),
        addAdminLibraryVoice: vi.fn(),
        designAdminVoice: vi.fn(),
        getFishDesignCapabilities: vi.fn().mockResolvedValue({ provider: 'fish_audio', available: false, languages: ['en', 'es'], max_candidates: 4, max_text_chars: 150, model_id: 'voice-design-1', request_price_usd_micros: null }),
        designFishVoice: vi.fn(),
        saveFishDesign: vi.fn(),
        saveAdminDesign: vi.fn(),
        remixAdminVoice: vi.fn(),
        testAdminVoice: vi.fn(),
        // A4 does not exist yet (R1-FE-06): the lab falls back to the R0 model list.
        listAdminLabModels: vi.fn().mockRejectedValue(new ApiError(404, 'Not Found')),
        listAdminGlobalPresets: vi.fn().mockResolvedValue(auditGlobalPresets),
        createAdminGlobalPreset: vi.fn(),
        updateAdminGlobalPreset: vi.fn(),
        deleteAdminGlobalPreset: vi.fn().mockResolvedValue(undefined),
        getVoiceLimits: vi.fn().mockResolvedValue(auditLimits),
        getRuntimeSettings: vi.fn().mockResolvedValue({ items: [] }),
        putRuntimeSetting: vi.fn(),
        getAdminVoiceMetrics: vi.fn().mockImplementation((area: AdminVoiceMetricsArea) => Promise.resolve(metricsByArea[area])),
        fetchProtectedMediaBlob: vi.fn().mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' })),
        // No surfaces listed: the lab keeps the BFF cap (tests that need limits pass a body).
        getVoiceCapabilities: vi.fn().mockResolvedValue({
            surfaces: [],
            provider_route: 'elevenlabs',
            tiers_allowed: ['standard'],
            narration_tier: 'standard',
            consent_version_required: 'voice-v2',
            status: { narration_available: true, calls_available: true, auto_narration_paused: false },
        }),
    }
}

export type ConsoleApiMock = ReturnType<typeof consoleApiMock>

export function renderInConsole(ui: ReactElement, initialModule: ConsoleModule = 'catalog') {
    return render(<VoiceConsoleProvider initialModule={initialModule}>{ui}</VoiceConsoleProvider>)
}

/** Open a Select (combobox) by its accessible name and click an option. */
export function chooseOption(combobox: string | RegExp, option: string | RegExp) {
    fireEvent.click(screen.getByRole('combobox', { name: combobox }))
    fireEvent.click(screen.getByRole('option', { name: option }))
}
