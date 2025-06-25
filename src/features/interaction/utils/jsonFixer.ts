/**
 * Utility to fix incomplete or malformed JSON from streaming responses
 */

interface ForwardOption {
    forward_question: string
}

/**
 * Remove markdown code block markers if present
 */
function removeCodeBlockMarkers(content: string): string {
    let cleaned = content.trim()
    
    // Remove opening code block marker (```json or just ```)
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7).trim()
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3).trim()
    }
    
    // Remove closing code block marker
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3).trim()
    }
    
    return cleaned
}

/**
 * Attempts to fix incomplete JSON by adding missing closing characters
 * and handling common streaming issues
 */
export function fixIncompleteJSON(jsonStr: string): string {
    let fixed = jsonStr.trim()
    
    // Remove any trailing commas before closing brackets/braces
    fixed = fixed.replace(/,\s*([}\]])/g, '$1')
    
    // Count opening and closing characters
    const counts = {
        openBrackets: (fixed.match(/\[/g) || []).length,
        closeBrackets: (fixed.match(/\]/g) || []).length,
        openBraces: (fixed.match(/\{/g) || []).length,
        closeBraces: (fixed.match(/\}/g) || []).length,
        quotes: (fixed.match(/"/g) || []).length
    }
    
    // If we have an odd number of quotes, we might have an incomplete string
    if (counts.quotes % 2 !== 0) {
        // Find the last quote and check if it's part of an incomplete string
        const lastQuoteIndex = fixed.lastIndexOf('"')
        const afterLastQuote = fixed.substring(lastQuoteIndex + 1)
        
        // If there's no closing quote after the last quote, add one
        if (!afterLastQuote.includes('"')) {
            // Check if we need to close the string and potentially add more
            const needsComma = afterLastQuote.includes(':') || afterLastQuote.includes('{')
            if (needsComma) {
                fixed += '"'
            } else {
                // Likely an incomplete value, close it
                fixed += '"'
                
                // Check if we need to close the object
                const inObject = counts.openBraces > counts.closeBraces
                const inArray = counts.openBrackets > counts.closeBrackets
                
                if (inObject && !fixed.trim().endsWith('}')) {
                    fixed += '}'
                }
            }
        }
    }
    
    // Add missing closing braces for objects
    while (counts.openBraces > counts.closeBraces) {
        fixed += '}'
        counts.closeBraces++
    }
    
    // Add missing closing brackets for arrays
    while (counts.openBrackets > counts.closeBrackets) {
        fixed += ']'
        counts.closeBrackets++
    }
    
    return fixed
}

/**
 * Safely parse forward options JSON with error recovery
 */
export function parseForwardOptions(jsonStr: string): ForwardOption[] | null {
    // Remove code block markers if present
    const cleanedStr = removeCodeBlockMarkers(jsonStr)
    
    try {
        // First attempt: parse as-is
        return JSON.parse(cleanedStr) as ForwardOption[]
    } catch (e) {
        // Second attempt: fix incomplete JSON
        try {
            const fixed = fixIncompleteJSON(cleanedStr)
            const parsed = JSON.parse(fixed) as ForwardOption[]
            
            // Validate the structure
            if (Array.isArray(parsed)) {
                // Filter out any incomplete entries
                return parsed.filter(item => 
                    item && 
                    typeof item === 'object' && 
                    'forward_question' in item &&
                    typeof item.forward_question === 'string' &&
                    item.forward_question.trim().length > 0
                )
            }
            
            return null
        } catch (e2) {
            // Silently fail - no console logging
            return null
        }
    }
}

/**
 * Extract forward options from a partial or complete forward_options tag content
 */
export function extractForwardOptions(content: string): ForwardOption[] | null {
    // Remove code block markers if present
    const cleanedContent = removeCodeBlockMarkers(content)
    
    // Try to extract JSON array from the content
    const jsonMatch = cleanedContent.match(/\[\s*\{[\s\S]*/)
    if (!jsonMatch) {
        return null
    }
    
    const jsonStr = jsonMatch[0]
    return parseForwardOptions(jsonStr)
} 