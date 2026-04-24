/**
 * Image metadata with thumbhash placeholder
 */
export interface ImageMeta {
	url: string
	width: number
	height: number
	blurDataURL?: string
}

/**
 * Moment data type definitions
 */
export interface Moment {
	id: string
	content: string
	images: ImageMeta[] | null
	tags: string[] | null
	createdAt: Date
	updatedAt: Date
}

/**
 * API response formats
 */
export interface MomentListResponse {
	data: Moment[]
	total: number
	limit: number
	offset: number
}

export interface MomentResponse {
	data: Moment
}

export interface ErrorResponse {
	error: string
	message?: string
	details?: unknown
}
