/** The existing storage-only upload contract, shared by card and cover editors. */
export const IMAGE_UPLOAD_TYPES:ReadonlySet<string>=new Set(['image/jpeg','image/png','image/webp'])
export const IMAGE_UPLOAD_MAX_BYTES=15*1024*1024
export const ownedImageUrl=(assetId:string)=>'/images/assets/'+encodeURIComponent(assetId)
