/**
 * Focus after a voice notice is dismissed (05 §10 "Notices": "Dismissal moves
 * focus to the next notice or the page heading"). The dismissed notice
 * unmounts under its Dismiss button, so without this the focus falls to the
 * page and the next Tab starts over from the top.
 *
 * Order: the next voice notice on the page; else the host's target (e.g. the
 * character editor's "Change voice" button); else the heading of the section
 * holding the notice; else the page heading; else the next focusable element.
 * Disabled controls (an archived workspace's `ReadOnlyFieldset`) are skipped.
 *
 * Notices mark their region with `data-voice-notice` (`VOICE_NOTICE_ATTRIBUTE`).
 */

export const VOICE_NOTICE_ATTRIBUTE = 'data-voice-notice'

const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Disabled by its own attribute or by a disabled fieldset ancestor (outside that fieldset's first legend). */
function isDisabled(el: HTMLElement): boolean {
    if (!el.matches('button, input, select, textarea')) return false
    if ((el as HTMLButtonElement).disabled) return true
    for (let fieldset = el.parentElement?.closest('fieldset'); fieldset; fieldset = fieldset.parentElement?.closest('fieldset')) {
        if (!fieldset.hasAttribute('disabled')) continue
        const legend = fieldset.querySelector(':scope > legend')
        if (!legend || !legend.contains(el)) return true
    }
    return false
}

function usable(el: HTMLElement | null | undefined): el is HTMLElement {
    return Boolean(el && el.isConnected && !el.closest('[hidden], [inert], [aria-hidden="true"]') && !isDisabled(el))
}

function follows(reference: Element, el: Element): boolean {
    return el !== reference && !reference.contains(el) && Boolean(reference.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
}

function nextNotice(notice: HTMLElement): HTMLElement | null {
    const all = Array.from(notice.ownerDocument.querySelectorAll<HTMLElement>(`[${VOICE_NOTICE_ATTRIBUTE}]`))
    return all.find((el) => follows(notice, el) && !el.contains(notice)) ?? null
}

/** The heading naming the closest labelled section around the notice (e.g. a Creator Studio section). */
function sectionHeading(notice: HTMLElement): HTMLElement | null {
    const section = notice.parentElement?.closest('section[aria-labelledby]')
    const id = section?.getAttribute('aria-labelledby')?.split(/\s+/)[0]
    return id ? notice.ownerDocument.getElementById(id) : null
}

/** The page's own heading (never a markdown heading inside chat content). */
function pageHeading(doc: Document): HTMLElement | null {
    return doc.querySelector<HTMLElement>('main h1:not(.markdown-h1)') ?? doc.querySelector<HTMLElement>('h1:not(.markdown-h1)')
}

function nextFocusable(notice: HTMLElement): HTMLElement | null {
    const all = Array.from(notice.ownerDocument.querySelectorAll<HTMLElement>(FOCUSABLE))
    return all.find((el) => follows(notice, el) && usable(el)) ?? null
}

function focusElement(el: HTMLElement) {
    // Headings and regions are not focusable by default: make them programmatic targets only.
    if (!el.hasAttribute('tabindex') && el.tabIndex < 0) el.setAttribute('tabindex', '-1')
    el.focus()
}

/**
 * Call from the Dismiss handler, before the host removes the notice. Only a
 * dismissal made from inside the notice (its focused Dismiss button) moves
 * the focus. The candidates are read now (the notice is still in place) and
 * focused after the dismissal renders, unless the focus has moved on meanwhile.
 */
export function focusAfterNoticeDismiss(notice: HTMLElement | null, hostTarget?: () => HTMLElement | null): void {
    if (!notice) return
    const doc = notice.ownerDocument
    if (!notice.contains(doc.activeElement)) return
    const next = nextNotice(notice)
    const heading = sectionHeading(notice)
    const following = nextFocusable(notice)
    const view = doc.defaultView ?? window
    view.setTimeout(() => {
        const active = doc.activeElement as HTMLElement | null
        if (active && active !== doc.body && active.isConnected && !notice.contains(active)) return
        const target = [next, hostTarget?.() ?? null, heading, pageHeading(doc), following].find(usable)
        if (target) focusElement(target)
    }, 0)
}
