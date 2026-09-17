/**
 * aiActionRow — the DOM for the in-document AI action row.
 *
 * Generated prose is real document text carrying the `aiSuggestion` mark, so
 * the controls that act on it belong to the document too: this row is mounted
 * by a ProseMirror widget decoration at the block boundary after the run. That
 * is why it can never drift — no `coordsAtPos`, no scroll or resize listeners,
 * no absolutely-positioned overlay chasing the caret.
 *
 * Raw DOM by deliberate choice: this repo mounts no React inside ProseMirror,
 * and the row must survive being re-created by the view without a React tree.
 * Handlers are read from `getModel()` at click time, so the DOM only has to be
 * rebuilt when the row's *state* changes (see the widget key in aiSuggestion).
 */

export type AiActionRowState = 'generating' | 'reviewing'

export interface AiActionRowLabels {
    actions: string
    accept: string
    decline: string
    regenerate: string
    cancel: string
    generating: string
    acceptKey: string
    declineKey: string
    regenerateKey: string
}

export interface AiActionRowModel {
    state: AiActionRowState
    preview?: string
    /** Right-aligned muted readout ("+121 words"); empty while generating. */
    meta: string
    /**
     * What the writer asked for, already formatted. Shown on its own line above
     * the controls so a beat is never reduced to its output — empty for the
     * canned commands, which have no prompt.
     */
    prompt: string
    labels: AiActionRowLabels
    /** False when there is no request to replay (regenerate is hidden, never disabled). */
    canRegenerate: boolean
    onAccept: () => void
    onDecline: () => void
    onRegenerate: () => void
    onCancel: () => void
}

/** A key chip. Hidden from the accessibility tree — the shortcut rides `aria-keyshortcuts`. */
function keyChip(text: string): HTMLElement {
    const chip = document.createElement('span')
    chip.className = 'ai-action-key'
    chip.setAttribute('aria-hidden', 'true')
    chip.textContent = text
    return chip
}

function button(
    variant: 'accept' | 'regen' | 'decline',
    label: string,
    chip: string,
    shortcut: string,
    onClick: () => void,
    testId: string,
): HTMLButtonElement {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = `ai-action-btn ai-action-btn--${variant}`
    element.setAttribute('aria-keyshortcuts', shortcut)
    element.setAttribute('data-testid', testId)
    element.append(document.createTextNode(label), keyChip(chip))
    // The row lives inside a contenteditable; a mousedown that reaches the
    // editor would move the caret before the click ever lands.
    element.addEventListener('mousedown', (event) => event.preventDefault())
    element.addEventListener('click', (event) => {
        event.preventDefault()
        onClick()
    })
    return element
}

/**
 * Build the row for the model current at mount time. Handlers deliberately
 * re-read `getModel()` so a rebuilt React tree never leaves a stale closure
 * wired to a button.
 */
export function renderActionRow(getModel: () => AiActionRowModel | null): HTMLElement {
    const model = getModel()
    const row = document.createElement('div')
    row.className = 'ai-action-row'
    row.setAttribute('data-testid', 'ai-action-row')
    if (!model) return row

    row.dataset.state = model.state
    const { labels } = model

    // The prompt line sits above the controls in BOTH states, so the box does
    // not change height when the prose lands — and so the writer can read what
    // they asked for while they wait for it.
    if (model.prompt) {
        const prompt = document.createElement('p')
        prompt.className = 'ai-action-prompt'
        prompt.textContent = model.prompt
        // The line truncates; the full instruction stays reachable on hover.
        prompt.title = model.prompt
        prompt.setAttribute('data-testid', 'ai-action-prompt')
        row.append(prompt)
    }

    if (model.state === 'generating') {
        const preview = document.createElement('div')
        preview.className = 'whitespace-pre-wrap font-narrative text-body text-parchment-100'
        preview.setAttribute('data-testid', 'ai-stream-preview')
        preview.setAttribute('aria-live', 'off')
        preview.textContent = model.preview ?? ''
        row.append(preview)
    }
    const controls = document.createElement('div')
    controls.className = 'ai-action-controls'
    row.append(controls)

    if (model.state === 'generating') {
        controls.setAttribute('role', 'status')
        const spinner = document.createElement('span')
        spinner.className = 'ai-action-spinner'
        const status = document.createElement('span')
        status.className = 'ai-action-status'
        status.textContent = labels.generating
        controls.append(
            spinner,
            status,
            button('decline', labels.cancel, labels.declineKey, 'Escape', () => getModel()?.onCancel(), 'ai-action-cancel'),
        )
        return row
    }

    controls.setAttribute('role', 'toolbar')
    controls.setAttribute('aria-label', labels.actions)
    controls.append(
        button('accept', labels.accept, labels.acceptKey, 'Tab', () => getModel()?.onAccept(), 'ai-action-accept'),
    )
    const divider = document.createElement('span')
    divider.className = 'ai-action-divider'
    divider.setAttribute('aria-hidden', 'true')
    controls.append(divider)
    if (model.canRegenerate) {
        controls.append(
            button(
                'regen',
                labels.regenerate,
                labels.regenerateKey,
                'Meta+Enter Control+Enter',
                () => getModel()?.onRegenerate(),
                'ai-action-regenerate',
            ),
        )
    }
    controls.append(
        button('decline', labels.decline, labels.declineKey, 'Escape', () => getModel()?.onDecline(), 'ai-action-decline'),
    )
    if (model.meta) {
        const meta = document.createElement('span')
        meta.className = 'ai-action-meta'
        meta.textContent = model.meta
        controls.append(meta)
    }
    return row
}
