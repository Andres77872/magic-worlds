import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadApplication } from './loadApplication'

describe('application bootstrap', () => {
    const loadApp = vi.fn()
    const loadLocales = vi.fn()
    const loadMaintenance = vi.fn()
    const App = () => null
    const MaintenancePage = () => null

    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        vi.doMock('@/app/App', () => {
            loadApp()
            return { default: App }
        })
        vi.doMock('@/app/i18n', () => {
            loadLocales()
            return {}
        })
        vi.doMock('@/features/maintenance/MaintenancePage', () => {
            loadMaintenance()
            return { default: MaintenancePage }
        })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.doUnmock('@/app/App')
        vi.doUnmock('@/app/i18n')
        vi.doUnmock('@/features/maintenance/MaintenancePage')
    })

    it('loads only the standalone page when maintenance is enabled', async () => {
        vi.stubEnv('VITE_MAINTENANCE_MODE', 'true')

        expect((await loadApplication()).default).toBe(MaintenancePage)
        expect(loadMaintenance).toHaveBeenCalledOnce()
        expect(loadApp).not.toHaveBeenCalled()
        expect(loadLocales).not.toHaveBeenCalled()
    })

    it.each([undefined, '', 'false', 'TRUE', '1', ' true '])(
        'loads the normal app and translations for flag %j', async (flag) => {
            vi.stubEnv('VITE_MAINTENANCE_MODE', flag)

            expect((await loadApplication()).default).toBe(App)
            expect(loadApp).toHaveBeenCalledOnce()
            expect(loadLocales).toHaveBeenCalledOnce()
            expect(loadMaintenance).not.toHaveBeenCalled()
        },
    )
})
