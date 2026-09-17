export type GenerationStage = 'generating' | 'validating' | 'saving'

export type TextGenerationEvent =
    | { type: 'progress'; request_id?: string; stage: GenerationStage }
    | { type: 'delta'; request_id?: string; delta: string }
    | { type: 'preview'; request_id?: string; path: Array<string | number>; text: string }

export interface TextGenerationOptions {
    signal?: AbortSignal
    requestId?: string
    timeoutMs?: number
    onEvent?: (event: TextGenerationEvent) => void
}
