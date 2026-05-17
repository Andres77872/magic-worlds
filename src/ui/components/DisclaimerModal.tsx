/**
 * Disclaimer Modal component for app usage terms
 */

import { FiAlertTriangle, FiCheck, FiExternalLink, FiInfo, FiShield, FiZap } from 'react-icons/fi'
import { GiMagicSwirl } from 'react-icons/gi'
import './DisclaimerModal.css'

interface DisclaimerModalProps {
    isOpen: boolean
    onAccept: () => void
    onReject: () => void
}

interface DisclaimerPoint {
    icon: React.ReactNode
    title: string
    description: string
    isWarning?: boolean
}

const disclaimerPoints: DisclaimerPoint[] = [
    {
        icon: <FiAlertTriangle />,
        title: 'Alpha Development',
        description: 'This app is under active development and may change significantly in future updates.',
        isWarning: false
    },
    {
        icon: <FiInfo />,
        title: 'Free Credits',
        description: 'The service is currently free while I can afford it and during development phase.',
        isWarning: false
    },
    {
        icon: <FiShield />,
        title: 'No Ads',
        description: 'No advertisements are shown at the moment.',
        isWarning: false
    },
    {
        icon: <FiInfo />,
        title: 'Data Storage',
        description: 'Your conversations will be saved on my server for functionality purposes.',
        isWarning: false
    },
    {
        icon: <FiZap />,
        title: 'AI Providers',
        description: 'This app uses various LLM (Large Language Model) providers to generate content.',
        isWarning: false
    },
    {
        icon: <FiShield />,
        title: 'No Account Required',
        description: 'No user account is required at the moment - you can use the app anonymously.',
        isWarning: false
    },
    {
        icon: <FiZap />,
        title: 'Session Token',
        description: 'If you accept, a temporary access token will be created for your session, stored locally, and is unique per user.',
        isWarning: false
    },
    {
        icon: <FiAlertTriangle />,
        title: 'No Guarantee',
        description: 'This service is provided as-is with no guarantees of availability, data persistence, or functionality.',
        isWarning: true
    }
]

export function DisclaimerModal({ isOpen, onAccept }: DisclaimerModalProps) {
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            return
        }
    }

    const handleReject = () => {
        window.location.href = 'https://arizmendi.io/'
    }

    if (!isOpen) return null

    return (
        <div className="disclaimer-modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
            <div className="disclaimer-modal-container" onClick={e => e.stopPropagation()}>
                <div className="disclaimer-modal-header">
                    <div className="disclaimer-modal-title">
                        <GiMagicSwirl className="disclaimer-modal-icon" aria-hidden="true" />
                        <h2 id="disclaimer-title">Welcome to Magic Worlds</h2>
                    </div>
                    <p className="disclaimer-modal-subtitle">
                        Before you begin, please review the following information
                    </p>
                </div>

                <div className="disclaimer-modal-body">
                    <div className="disclaimer-content">
                        <div className="disclaimer-notice" role="alert">
                            <FiAlertTriangle className="disclaimer-notice-icon" aria-hidden="true" />
                            <div className="disclaimer-notice-content">
                                <h3>Important Development Notice</h3>
                                <p>Please read and understand the terms below before continuing</p>
                            </div>
                        </div>
                        
                        <div className="disclaimer-points">
                            {disclaimerPoints.map((point, index) => (
                                <div 
                                    key={index} 
                                    className={`disclaimer-point ${point.isWarning ? 'disclaimer-point--warning' : ''}`}
                                >
                                    <span className="disclaimer-point-icon" aria-hidden="true">{point.icon}</span>
                                    <div className="disclaimer-point-content">
                                        <h4>{point.title}</h4>
                                        <p>{point.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="disclaimer-modal-actions">
                        <button 
                            className="disclaimer-modal-button disclaimer-modal-button--reject"
                            onClick={handleReject}
                            type="button"
                        >
                            <FiExternalLink aria-hidden="true" />
                            I Don't Accept
                        </button>
                        
                        <button 
                            className="disclaimer-modal-button disclaimer-modal-button--accept"
                            onClick={onAccept}
                            type="button"
                        >
                            <FiCheck aria-hidden="true" />
                            I Accept - Start Using Magic Worlds
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
} 