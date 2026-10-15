/**
 * Catalog picker copy (`voices.catalog.*`, plus the catalog-era keys spread
 * into `voices.picker`; R1-FE-01, 05 §7, 09 §5.2). No accent or works-in-calls
 * copy (§5 of the R1 build: the taxonomy and S-15 are open). `filters.*` are
 * the 05 §9.3 `voices.catalog.filters.{language,gender,age,any,showLocked}`
 * group labels; `gender.*` / `age.*` label the catalog's fixed enums (05 §7.3,
 * BFF `VoiceGender` / `VoiceAgeBucket`). es drafts await LOC review.
 */
export const voiceCatalogEn = {
    providerTag: 'Voice provider: {{provider}}',
    listen: 'Listen',
    listenSample: 'Listen to {{name}}',
    listenSampleIn: 'Listen to {{name}}, {{language}}',
    stopNamedSample: 'Stop the sample of {{name}}',
    stopSample: 'Stop',
    forCalls: 'Narration and calls',
    forNarration: 'Narration',
    moreFilters: 'More filters',
    hideFilters: 'Fewer filters',
    /** Screen-reader count after "More filters" of the folded filters that narrow the list. */
    activeFilters_one: '({{count}} active)',
    activeFilters_other: '({{count}} active)',
    clearFilters: 'Clear filters',
    /** Next to a locked voice: the plans page, in a new tab so a draft survives. */
    seePlans: 'See plans',
    opensInNewTab: '(opens in a new tab)',
    tab: 'Voice catalog',
    search: 'Search voices',
    /** 05 §7.3 catalog enum `male|female|neutral`. */
    gender: {
        male: 'Male',
        female: 'Female',
        neutral: 'Neutral',
    },
    /** 05 §7.3 catalog enum `young|middle_aged|old`. */
    age: {
        young: 'Young',
        middle_aged: 'Middle-aged',
        old: 'Old',
    },
    tags: 'Tags',
    recommended: 'Recommended for this character',
    loadMore: 'Load more',
    empty: 'No voices match these filters.',
    unavailable: 'The voice catalog is unavailable right now.',
    retry: 'Try again',
    /** 05 §9.3 `voices.catalog.count_one/_other`, announced after each load (05 §10). */
    count_one: '{{count}} voice shown',
    count_other: '{{count}} voices shown',
    playSample: 'Play sample of {{name}}',
    /** Visible text of the character editor's voice-field sample button (AC-C7); its name is `playSample` / `playSampleIn`. */
    sampleButton: 'Play sample',
    /** 05 §10: a play button names the voice and the sample's language; it toggles `aria-pressed` instead of its name. */
    playSampleIn: 'Play sample of {{name}}, {{language}}',
    /** The picker's current-voice row (05 §7.2), told apart from the same voice's catalog row. */
    playCurrentSample: 'Play sample of the current voice, {{name}}, {{language}}',
    use: 'Use',
    /** Screen-reader text of one row language and the tiers it is accepted on (05 §7.4). */
    languageTiers: '{{language}}: {{tiers}}',
    languages: 'Languages',
    filters: {
        provider: 'Provider',
        language: 'Language',
        gender: 'Gender',
        age: 'Age',
        any: 'Any',
        showLocked: 'Show locked voices',
    },
}

export const voiceCatalogEs = {
    providerTag: 'Proveedor de voz: {{provider}}',
    listen: 'Escuchar',
    listenSample: 'Escuchar a {{name}}',
    listenSampleIn: 'Escuchar a {{name}}, {{language}}',
    stopNamedSample: 'Detener la muestra de {{name}}',
    stopSample: 'Detener',
    forCalls: 'Narración y llamadas',
    forNarration: 'Narración',
    moreFilters: 'Más filtros',
    hideFilters: 'Menos filtros',
    activeFilters_one: '({{count}} activo)',
    activeFilters_other: '({{count}} activos)',
    clearFilters: 'Quitar filtros',
    seePlans: 'Ver planes',
    opensInNewTab: '(se abre en una pestaña nueva)',
    tab: 'Catálogo de voces',
    search: 'Buscar voces',
    gender: {
        male: 'Masculina',
        female: 'Femenina',
        neutral: 'Neutra',
    },
    age: {
        young: 'Joven',
        middle_aged: 'Mediana edad',
        old: 'Mayor',
    },
    tags: 'Etiquetas',
    recommended: 'Recomendadas para este personaje',
    loadMore: 'Cargar más',
    empty: 'Ninguna voz coincide con estos filtros.',
    unavailable: 'El catálogo de voces no está disponible ahora mismo.',
    retry: 'Reintentar',
    count_one: 'Se muestra {{count}} voz',
    count_other: 'Se muestran {{count}} voces',
    playSample: 'Reproducir muestra de {{name}}',
    sampleButton: 'Reproducir muestra',
    playSampleIn: 'Reproducir muestra de {{name}}, {{language}}',
    playCurrentSample: 'Reproducir muestra de la voz actual, {{name}}, {{language}}',
    use: 'Usar',
    languageTiers: '{{language}}: {{tiers}}',
    languages: 'Idiomas',
    filters: {
        provider: 'Proveedor',
        language: 'Idioma',
        gender: 'Género',
        age: 'Edad',
        any: 'Cualquiera',
        showLocked: 'Mostrar voces bloqueadas',
    },
}

/** New `voices.picker` keys, spread into the existing inline picker object. */
export const voicePickerCatalogEn = {
    presetsTab: 'Presets',
    /**
     * 05 §7.4 / §9.3 `voices.picker.eligibilityError` (D32): a 422 `voice_not_eligible` on save, shown
     * on the voice field and as the save error (`voiceWriteErrorKey`).
     */
    eligibilityError: 'This voice can’t be picked right now. Choose another.',
    /**
     * 05 §10 audio controls: a preset row's buttons name the preset, the preview also its voice and the
     * language heard ("Preview Harbour master, Eldrin, English"). The visible text stays "Preview" / "Use".
     */
    previewNamed: 'Preview {{name}}, {{voice}}, {{language}}',
    /** WCAG 2.5.3: a paid preview's name starts with its visible text (`label`, "Preview · 1 credit"). */
    previewNamedCredit: '{{label}}: {{name}}, {{voice}}, {{language}}',
    stopNamed: 'Stop the preview of {{name}}',
    useNamed: 'Use {{name}}',
    selectedNamed: 'Selected: {{name}}',
}

export const voicePickerCatalogEs = {
    presetsTab: 'Presets',
    eligibilityError: 'Esta voz no se puede elegir ahora mismo. Elige otra.',
    previewNamed: 'Previsualizar {{name}}, {{voice}}, {{language}}',
    previewNamedCredit: '{{label}}: {{name}}, {{voice}}, {{language}}',
    stopNamed: 'Detener la vista previa de {{name}}',
    useNamed: 'Usar {{name}}',
    selectedNamed: 'Seleccionada: {{name}}',
}
