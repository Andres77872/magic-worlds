import type {Dispatch, SetStateAction} from 'react'
import {useEffect} from 'react'
import '../styles/App.css'

export type ThemeOption = 'light' | 'dark' | 'system'

/**
 * App header with logo, title, and theme selector.
 */
export function Header({
                           theme,
                           setTheme,
                           goTo,
                       }: {
    theme: ThemeOption
    setTheme: Dispatch<SetStateAction<ThemeOption>>
    goTo: (page: 'landing' | 'character' | 'world' | 'adventure' | 'interaction') => void
}) {
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
                onClick={() => goTo('landing')}
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
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </label>
            </div>
        </header>
    )
}