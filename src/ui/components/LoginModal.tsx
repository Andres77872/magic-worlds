/**
 * Login Modal component with authentication forms
 */

import { useState } from 'react'
import { useAuth } from '../../app/hooks'
import { FiX, FiUser, FiLock, FiEye, FiEyeOff, FiAlertTriangle } from 'react-icons/fi'
import { GiMagicSwirl } from 'react-icons/gi'
import './LoginModal.css'

interface LoginModalProps {
    isOpen: boolean
    onClose: () => void
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const { login, isLoading, error, clearError } = useAuth()
    const [isLoginMode, setIsLoginMode] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [credentials, setCredentials] = useState({
        username: '',
        password: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isLoginMode) {
            const success = await login(credentials)
            if (success) {
                handleClose()
            }
        }
    }

    const handleClose = () => {
        setCredentials({ username: '', password: '' })
        setShowPassword(false)
        setIsLoginMode(true)
        onClose()
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose()
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setCredentials(prev => ({
            ...prev,
            [name]: value
        }))
        // Clear error when user starts typing
        if (error) {
            clearError()
        }
    }

    if (!isOpen) return null

    return (
        <div className="login-modal-overlay" onClick={handleOverlayClick}>
            <div className="login-modal-container" onClick={e => e.stopPropagation()}>
                <div className="login-modal-header">
                    <div className="login-modal-title">
                        <GiMagicSwirl className="login-modal-icon" />
                        <h2>{isLoginMode ? 'Login' : 'Register'}</h2>
                    </div>
                    <button 
                        className="login-modal-close-button"
                        onClick={handleClose}
                        aria-label="Close modal"
                    >
                        <FiX />
                    </button>
                </div>

                <div className="login-modal-body">
                    {/* Alpha Version Disclaimer */}
                    <div className="alpha-disclaimer">
                        <FiAlertTriangle className="warning-icon" />
                        <p>
                            <strong>Alpha Version Notice:</strong> This project is currently in alpha development.
                            Login and registration functionality may change in future updates. User accounts and data 
                            may be deleted without prior notification during development phases.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <div className="input-wrapper">
                                <FiUser className="input-icon" />
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={credentials.username}
                                    onChange={handleInputChange}
                                    placeholder="Enter your username"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper">
                                <FiLock className="input-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    value={credentials.password}
                                    onChange={handleInputChange}
                                    placeholder="Enter your password"
                                    required
                                    autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <FiEyeOff /> : <FiEye />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="error-message">
                                <FiAlertTriangle className="error-icon" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            className="submit-button"
                            disabled={isLoading || !isLoginMode}
                        >
                            {isLoading ? (
                                <>
                                    <GiMagicSwirl className="loading-icon" />
                                    Authenticating...
                                </>
                            ) : (
                                <>
                                    {isLoginMode ? 'Login' : 'Register (Coming Soon)'}
                                </>
                            )}
                        </button>
                    </form>

                    <div className="auth-toggle">
                        <p>
                            {isLoginMode ? "Don't have an account?" : "Already have an account?"}
                            <button 
                                type="button"
                                className="toggle-mode-button"
                                onClick={() => setIsLoginMode(!isLoginMode)}
                            >
                                {isLoginMode ? 'Register' : 'Login'}
                            </button>
                        </p>
                        {!isLoginMode && (
                            <p className="register-notice">
                                Registration is currently disabled during alpha development.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
} 