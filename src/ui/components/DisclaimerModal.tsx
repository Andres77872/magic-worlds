/**
 * Disclaimer Modal component for app usage terms
 */

import { FiX, FiAlertTriangle, FiCheck, FiExternalLink } from 'react-icons/fi'
import { GiMagicSwirl } from 'react-icons/gi'
import './DisclaimerModal.css'

interface DisclaimerModalProps {
    isOpen: boolean
    onAccept: () => void
    onReject: () => void
}

export function DisclaimerModal({ isOpen, onAccept, onReject }: DisclaimerModalProps) {
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            // Don't allow closing by clicking overlay - force user to make a choice
            return
        }
    }

    const handleReject = () => {
        // Redirect to arizmendi.io
        window.location.href = 'https://arizmendi.io/'
    }

    if (!isOpen) return null

    return (
        <div className="disclaimer-modal-overlay" onClick={handleOverlayClick}>
            <div className="disclaimer-modal-container" onClick={e => e.stopPropagation()}>
                <div className="disclaimer-modal-header">
                    <div className="disclaimer-modal-title">
                        <GiMagicSwirl className="disclaimer-modal-icon" />
                        <h2>Welcome to Magic Worlds</h2>
                    </div>
                </div>

                <div className="disclaimer-modal-body">
                    {/* Main disclaimer content */}
                    <div className="disclaimer-content">
                        <div className="disclaimer-notice">
                            <FiAlertTriangle className="notice-icon" />
                            <h3>Important Development Notice</h3>
                        </div>
                        
                        <div className="disclaimer-points">
                            <div className="disclaimer-point">
                                <span className="point-icon">⚠️</span>
                                <p><strong>Alpha Development:</strong> This app is under active development and may change significantly in future updates.</p>
                            </div>
                            
                            <div className="disclaimer-point">
                                <span className="point-icon">💰</span>
                                <p><strong>Free Credits:</strong> The service is currently free while I can afford it and during development phase.</p>
                            </div>
                            
                            <div className="disclaimer-point">
                                <span className="point-icon">🚫</span>
                                <p><strong>No Ads:</strong> No advertisements are shown at the moment.</p>
                            </div>
                            
                            <div className="disclaimer-point">
                                <span className="point-icon">💾</span>
                                <p><strong>Data Storage:</strong> Your conversations will be saved on my server for functionality purposes.</p>
                            </div>
                            
                            <div className="disclaimer-point">
                                <span className="point-icon">🤖</span>
                                <p><strong>AI Providers:</strong> This app uses various LLM (Large Language Model) providers to generate content.</p>
                            </div>
                            
                            <div className="disclaimer-point">
                                <span className="point-icon">👤</span>
                                <p><strong>No Account Required:</strong> No user account is required at the moment - you can use the app anonymously.</p>
                            </div>
                            
                            <div className="disclaimer-point">
                                <span className="point-icon">⚡</span>
                                <p><strong>Session Token:</strong> If you accept, a temporary access token will be created for your session, stored locally, and is unique per user.</p>
                            </div>
                            
                            <div className="disclaimer-point warning-point">
                                <span className="point-icon">🚨</span>
                                <p><strong>No Guarantee:</strong> This service is provided as-is with no guarantees of availability, data persistence, or functionality.</p>
                            </div>
                        </div>
                    </div>

                    <div className="disclaimer-actions">
                        <button 
                            className="reject-button"
                            onClick={handleReject}
                        >
                            <FiExternalLink />
                            I Don't Accept - Take me to arizmendi.io
                        </button>
                        
                        <button 
                            className="accept-button"
                            onClick={onAccept}
                        >
                            <FiCheck />
                            I Accept - Start Using Magic Worlds
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
} 