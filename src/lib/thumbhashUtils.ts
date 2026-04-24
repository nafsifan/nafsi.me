import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'
import { rgbaToThumbHash, thumbHashToDataURL } from 'thumbhash'

const MAX_THUMB_SIZE = 64

export interface ThumbhashResult {
	width: number
	height: number
	blurDataURL: string
	contentHash?: string
}

/**
 * Generate thumbhash placeholder from image buffer
 */
export async function generateThumbhash(
	buffer: Buffer,
	options?: { includeContentHash?: boolean },
): Promise<ThumbhashResult> {
	const image = sharp(buffer)
	const meta = await image.metadata()

	const { data, info } = await image
		.resize({
			width: MAX_THUMB_SIZE,
			height: MAX_THUMB_SIZE,
			fit: 'inside',
			withoutEnlargement: true,
		})
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true })

	const thumbHash = rgbaToThumbHash(info.width, info.height, data)
	const blurDataURL = thumbHashToDataURL(thumbHash)

	const result: ThumbhashResult = {
		width: meta.width ?? info.width,
		height: meta.height ?? info.height,
		blurDataURL,
	}

	if (options?.includeContentHash) {
		result.contentHash = crypto
			.createHash('sha256')
			.update(buffer)
			.digest('hex')
			.slice(0, 16)
	}

	return result
}

/**
 * Load image buffer from URL or file path
 */
export async function loadImageBuffer(src: string): Promise<Buffer> {
	const normalized = src.replaceAll('%20', ' ')

	// Remote image
	if (/^https?:\/\//.test(normalized)) {
		const res = await fetch(normalized)
		if (!res.ok) {
			throw new Error(`Failed to fetch: ${normalized} (${res.status})`)
		}
		const arrayBuffer = await res.arrayBuffer()
		return Buffer.from(arrayBuffer)
	}

	// Local image
	const localPath = normalized.startsWith('/') ? normalized.slice(1) : normalized
	return fs.readFile(path.join(process.cwd(), 'public', localPath))
}

/**
 * Generate thumbhash from image URL (convenience wrapper)
 */
export async function generateThumbhashFromUrl(
	src: string,
): Promise<ThumbhashResult | null> {
	try {
		const buffer = await loadImageBuffer(src)
		return await generateThumbhash(buffer, { includeContentHash: true })
	}
	catch (error) {
		console.warn(`[thumbhash] Failed to process ${src}:`, error)
		return null
	}
}
