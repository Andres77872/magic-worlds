import type { SupportedLanguage } from '@/app/i18n/languages'

// Both small locales ship with the outage screen. It must remain usable without
// the full application's i18n bootstrap, account preferences or locale requests.
const en = {
    documentTitle: 'Under maintenance · Magic Worlds',
    languageLabel: 'Page language',
    status: 'Under maintenance',
    title: 'A pause between',
    titleAccent: 'chapters.',
    description: 'Magic Worlds is temporarily unavailable while we make a few improvements. Please check back in a little while.',
    retry: 'Try again',
    retryHint: 'Reload the page to check if we’re back.',
    illustrationAlt: 'A closed, gold-edged storybook and a glowing candle in an enchanted library, with warm light behind its closed doors.',
    illustrationLabel: 'Between chapters',
    illustrationCaption: 'A little care for the worlds you create.',
    footer: 'Thank you for your patience.',
    tagline: 'Worlds that talk back.',
}

export const maintenanceCopy: Record<SupportedLanguage, Record<keyof typeof en, string>> = {
    en,
    es: {
        documentTitle: 'En mantenimiento · Magic Worlds',
        languageLabel: 'Idioma de la página',
        status: 'En mantenimiento',
        title: 'Una pausa entre',
        titleAccent: 'capítulos.',
        description: 'Magic Worlds no está disponible por el momento mientras hacemos algunas mejoras. Vuelve a visitarnos dentro de un rato.',
        retry: 'Volver a intentar',
        retryHint: 'Recarga la página para ver si ya volvimos.',
        illustrationAlt: 'Un libro cerrado de bordes dorados y una vela encendida en una biblioteca encantada, con luz cálida detrás de sus puertas cerradas.',
        illustrationLabel: 'Entre capítulos',
        illustrationCaption: 'Un poco de cuidado para los mundos que creas.',
        footer: 'Gracias por tu paciencia.',
        tagline: 'Mundos que te responden.',
    },
}
