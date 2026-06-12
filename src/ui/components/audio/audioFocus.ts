/**
 * App-wide exclusive audio focus. Playback is exclusive across every audio
 * surface (the playlist player, TTS narration): starting any registered
 * element pauses the previous one. Pausing fires the displaced element's own
 * 'pause' event, so its owner's state stays in sync without extra wiring.
 */

/** The one currently-audible element; claiming focus pauses the previous. */
let activeAudio: HTMLAudioElement | null = null

export function claimAudioFocus(audio: HTMLAudioElement): void {
    if (activeAudio && activeAudio !== audio) activeAudio.pause()
    activeAudio = audio
}

export function releaseAudioFocus(audio: HTMLAudioElement): void {
    if (activeAudio === audio) activeAudio = null
}
