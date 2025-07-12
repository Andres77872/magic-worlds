/**
 * App header with enhanced UI/UX, magical effects, and theme selector
 */

import { useEffect } from 'react'
import { useTheme, useNavigation, useAuth } from '../../app/hooks'
import type { ThemeOption } from '../../shared'
import { FiMoon, FiSun, FiMonitor, FiGithub, FiLogIn, FiLogOut, FiUser } from 'react-icons/fi'
import { GiMagicSwirl, GiCrystalBall } from 'react-icons/gi'
import './Header.css'

export function Header() {
    const { theme, setTheme } = useTheme()
    const { currentPage, setPage } = useNavigation()
    const { isAuthenticated, user, logout, openLoginModal } = useAuth()

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

    const getThemeIcon = () => {
        switch (theme) {
            case 'dark': return <FiMoon />
            case 'light': return <FiSun />
            case 'system': return <FiMonitor />
            default: return <FiSun />
        }
    }

    const getPageTitle = () => {
        switch (currentPage) {
            case 'character': return 'Character Creation'
            case 'world': return 'World Building'
            case 'adventure': return 'Adventure Creation'
            case 'interaction': return 'Active Adventure'
            default: return 'Dashboard'
        }
    }

    return (
        <header className="app-header">
            <div className="header-content">
                <div className="header-brand">
                    <button 
                        className="brand-button hover-magical"
                        onClick={() => setPage('landing')}
                        aria-label="Go to home"
                    >
                        <GiCrystalBall className="app-logo animate-float" />
                        <div className="brand-text">
                            <span className="brand-title">Magic Worlds</span>
                            <span className="brand-subtitle">RPG</span>
                        </div>
                    </button>
                </div>

                <div className="header-center">
                    <div className="page-indicator">
                        <GiMagicSwirl className="page-icon animate-pulse" />
                        <span className="page-title">{getPageTitle()}</span>
                    </div>
                </div>

                <div className="header-actions">
                    <div className="auth-section">
                        {isAuthenticated ? (
                            <div className="user-menu">
                                <div className="user-info">
                                    <FiUser className="user-icon" />
                                    <span className="username">{user?.username}</span>
                                </div>
                                <button
                                    className="logout-button hover-magical"
                                    onClick={logout}
                                    aria-label="Logout"
                                    title="Logout"
                                >
                                    <FiLogOut className="logout-icon" />
                                </button>
                            </div>
                        ) : (
                            <button
                                className="login-button hover-magical"
                                onClick={openLoginModal}
                                aria-label="Login"
                                title="Login"
                            >
                                <FiLogIn className="login-icon" />
                                <span>Login</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="github-link">
                        <a
                            href="https://github.com/Andres77872/magic-worlds"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="github-button hover-magical"
                            aria-label="View source code on GitHub"
                            title="View on GitHub"
                        >
                            <FiGithub className="github-icon" />
                        </a>
                    </div>
                    
                    <div className="theme-selector">
                        <button
                            className="theme-button hover-magical"
                            onClick={() => {
                                const themes: ThemeOption[] = ['light', 'dark', 'system']
                                const currentIndex = themes.indexOf(theme)
                                const nextIndex = (currentIndex + 1) % themes.length
                                setTheme(themes[nextIndex])
                            }}
                            aria-label={`Current theme: ${theme}`}
                            title={`Theme: ${theme}`}
                        >
                            <span className="theme-icon">{getThemeIcon()}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Magical effect border */}
            <div className="header-border-effect"></div>
        </header>
    )
}
