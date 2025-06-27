import './ForwardOptions.css'

interface ForwardOption {
    forward_question: string
}

interface ForwardOptionsProps {
    options?: ForwardOption[]
    isStreaming?: boolean
    onOptionClick: (option: string) => void
}

export function ForwardOptions({ options, isStreaming, onOptionClick }: ForwardOptionsProps) {
    if (!options?.length && !isStreaming) {
        return null
    }

    return (
        <div className="forward-options interaction-shimmer">
            <div className="forward-options__header">
                <span className="forward-options__title">Suggested Actions</span>
                {isStreaming && (
                    <div className="interaction-loading__dots">
                        <span className="interaction-loading__dot"></span>
                        <span className="interaction-loading__dot"></span>
                        <span className="interaction-loading__dot"></span>
                    </div>
                )}
            </div>
            {options && options.length > 0 && (
                <div className="forward-options__list">
                    {options.map((option, index) => (
                        <button
                            key={index}
                            className="forward-options__button interaction-focusable"
                            onClick={() => onOptionClick(option.forward_question)}
                            style={{animationDelay: `${index * 0.1}s`}}
                        >
                            <span className="forward-options__icon">✨</span>
                            <span className="forward-options__text">{option.forward_question}</span>
                            <span className="forward-options__arrow">→</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
} 