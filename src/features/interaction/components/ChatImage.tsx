import './ChatImage.css'

interface ChatImageProps {
    imageUrl: string
    isAssistant: boolean
    alt?: string
}

export function ChatImage({ imageUrl, isAssistant, alt = "Generated scene" }: ChatImageProps) {
    return (
        <div className={`chat-image ${isAssistant ? 'chat-image--assistant' : 'chat-image--user'}`}>
            <img 
                src={imageUrl} 
                alt={alt} 
                className="chat-image__img"
                loading="lazy"
            />
        </div>
    )
} 