/** A paid cache miss: the zero-cap probe has no billing side effects. */
export function paidPreviewResponse<T>(response: T, previewsLeft: number) {
    return async (body: { max_credit_cost?: number }): Promise<T> => {
        if (body.max_credit_cost !== 1) throw Object.assign(new Error('Credit confirmation required'), {
            status: 409, code: 'preview_credit_confirmation_required',
            details: { previews_left: previewsLeft, free_previews_left: 0, required_credit_cost: 1 },
        })
        return response
    }
}
