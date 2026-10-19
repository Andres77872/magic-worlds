/** Complete only the display copy of an active Markdown tail. Never persist it. */
export function streamingMarkdown(text: string): string {
    const source = text.replace(/!?\[([^\]\n]*)\]\([^\)\n]*$/, '$1')
    const open: string[] = []
    let code: string | undefined
    for (const match of source.matchAll(/\\.|`+|\*\*|__|~~|\*|_|~/g)) {
        const mark = match[0]
        const index = match.index
        if (mark.startsWith('\\')) continue
        if (mark.startsWith('`')) {
            if (code === mark) code = undefined
            else if (!code) code = mark
            continue
        }
        if (code) continue
        const before = source[index - 1] ?? ''
        const after = source[index + mark.length] ?? ''
        if (mark === '_' && /[\p{L}\p{N}]/u.test(before) && /[\p{L}\p{N}]/u.test(after)) continue
        if (open[open.length - 1] === mark && before && !/\s/.test(before)) open.pop()
        else if (after && !/\s/.test(after)) open.push(mark)
    }
    return source + (code ? (code.length >= 3 ? '\n' : '') + code : '') + open.reverse().join('')
}
