/**
 * App header with logo, title, and theme selector
 */

import { useEffect } from 'react'
import { useTheme, useNavigation } from '../../app/providers'
import type { ThemeOption } from '../../shared/types'
import './Header.css'

export function Header() {
    const { theme, setTheme } = useTheme()
    const { setPage } = useNavigation()

    // Apply theme attribute to <html>
    useEffect(() => {
        const apply = (mode: ThemeOption) => {
            const dark =
                mode === 'dark' ||
                (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
            document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
        }
        apply(theme)
        if (theme === 'system') {
            const mql = window.matchMedia('(prefers-color-scheme: dark)')
            const listener = () => apply('system')
            mql.addEventListener('change', listener)
            return () => mql.removeEventListener('change', listener)
        }
    }, [theme])

    return (
        <header className="app-header">
            <img
                src="/react.svg"
                alt="Magic Worlds Logo"
                className="app-logo"
                onClick={() => setPage('landing')}
            />
            <div className="app-title">Magic Worlds RPG</div>
            <div className="theme-toggle">
                <label className="field-label">
                    Theme:
                    <select
                        className="field-input"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as ThemeOption)}
                    >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                    </select>
                </label>
            </div>
        </header>
    )
}
