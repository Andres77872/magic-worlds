import { useEffect, type ImgHTMLAttributes, type SyntheticEvent } from 'react'
import { useAuthenticatedMediaUrl } from '@/infrastructure/api/useAuthenticatedMediaUrl'

type AuthenticatedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
    src?: string | null
}

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

export function AuthenticatedImage({ src, onError, ...props }: AuthenticatedImageProps) {
    const media = useAuthenticatedMediaUrl(src, 'image/*')

    useEffect(() => {
        if (!media.error || !onError) return
        onError({ currentTarget: null, target: null } as unknown as SyntheticEvent<HTMLImageElement, Event>)
    }, [media.error, onError])

    if (!src) return null
    const imageProps = media.src ? props : { ...props, alt: '', 'aria-hidden': true }
    return <img {...imageProps} src={media.src ?? TRANSPARENT_PIXEL} onError={onError} />
}
