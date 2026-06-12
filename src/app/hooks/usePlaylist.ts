import { useContext } from 'react'
import { AudioPlaylistContext } from '../providers/audioPlaylistContext'

export function usePlaylist() {
    const context = useContext(AudioPlaylistContext)
    if (context === undefined) {
        throw new Error('usePlaylist must be used within an AudioPlaylistProvider')
    }
    return context
}
