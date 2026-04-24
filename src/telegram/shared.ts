import type { ImageMeta, Moment } from '@/types/moment'
import type { ConversationFlavor } from '@grammyjs/conversations'
import type { Context, SessionFlavor } from 'grammy'
import type { PhotoSize } from 'grammy/types'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { InlineKeyboard } from 'grammy'
import { uploadObjectToR2 } from '@/lib/cloudflare-r2'
import { generateThumbhash } from '@/lib/thumbhashUtils'

dayjs.extend(utc)
dayjs.extend(timezone)

// Types
type SessionData = Record<string, never>
type MyContext = Context & SessionFlavor<SessionData>
export type BotContext = MyContext & ConversationFlavor<MyContext>

// Constants
export const MOMENT_LIMITS = {
	MAX_CONTENT_LENGTH: 500,
	MAX_IMAGES: 9,
	MAX_TAGS: 5,
	MAX_TAG_LENGTH: 20,
} as const

export const ERROR_MESSAGES = {
	UNAUTHORIZED: 'Access denied. Only authorised users can use this bot.',
	GENERAL_ERROR: 'Something went wrong. Please try again later.',
	NOT_FOUND: 'Moment with id "{id}" was not found.',
	INVALID_ID: 'Moment id is required.',
	EMPTY_CONTENT: 'Content is required. Creation cancelled.',
	CONTENT_TOO_LONG: `Content is too long. Maximum length is ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} characters.`,
} as const

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

// Image upload
export async function saveTelegramImageToR2(ctx: BotContext, image: PhotoSize): Promise<ImageMeta> {
	const file = await ctx.api.getFile(image.file_id)

	if (!file.file_path) {
		throw new Error('Telegram file path is missing')
	}

	const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`
	const response = await fetch(downloadUrl)

	if (!response.ok) {
		const message = await response.text().catch(() => '')
		throw new Error(`Failed to download Telegram file (${response.status}): ${message}`)
	}

	const arrayBuffer = await response.arrayBuffer()
	const body = Buffer.from(arrayBuffer)

	const extension = path.extname(file.file_path).toLowerCase()

	if (!extension || !ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
		throw new Error(`Invalid image extension: ${extension}`)
	}

	let contentType = response.headers.get('content-type')
	if (!contentType || contentType === 'application/octet-stream') {
		contentType = getContentTypeFromExtension(extension)
	}

	// Upload to R2
	const { publicUrl } = await uploadObjectToR2({
		body,
		contentType,
		prefix: 'moments',
		extension,
		filenameHint: image.file_unique_id,
	})

	// Generate thumbhash
	const thumbhashResult = await generateThumbhash(body)

	return {
		url: publicUrl,
		width: thumbhashResult.width,
		height: thumbhashResult.height,
		blurDataURL: thumbhashResult.blurDataURL,
	}
}

function getContentTypeFromExtension(ext: string): string {
	switch (ext.toLowerCase()) {
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg'
		case '.png':
			return 'image/png'
		case '.webp':
			return 'image/webp'
		default:
			return 'application/octet-stream'
	}
}

// Tag parsing
interface TagParsingLimits {
	maxTags: number
	maxTagLength: number
}

const defaultLimits: TagParsingLimits = {
	maxTags: MOMENT_LIMITS.MAX_TAGS,
	maxTagLength: MOMENT_LIMITS.MAX_TAG_LENGTH,
}

export function parseTagsInput(input: string, limits: TagParsingLimits = defaultLimits): string[] {
	const { maxTags, maxTagLength } = limits
	const seen = new Set<string>()
	const tags: string[] = []

	for (const token of input.trim().split(/\s+/)) {
		const tag = token.trim()

		if (!tag || tag.length > maxTagLength) {
			continue
		}

		if (seen.has(tag)) {
			continue
		}

		seen.add(tag)
		tags.push(tag)

		if (tags.length >= maxTags) {
			break
		}
	}

	return tags
}

// DateTime formatting
const TELEGRAM_TIMEZONE = 'Asia/Shanghai'
const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss'

export function formatTelegramDateTime(value: Date | string, format: string = DEFAULT_FORMAT): string {
	return dayjs(value).tz(TELEGRAM_TIMEZONE).format(format)
}

// Moment formatting
export function formatMomentDetails(moment: Moment): string {
	const formatDateTime = (value: Date | string) => formatTelegramDateTime(value)
	const hasTags = Boolean(moment.tags && moment.tags.length > 0)
	const lines = [
		'Moment Overview',
		'---------------',
		`ID: ${moment.id}`,
		'',
		'Content:',
		moment.content.trim() || '(empty)',
		'',
		`Tags: ${hasTags ? moment.tags!.join(', ') : 'None'}`,
		`Created: ${formatDateTime(moment.createdAt)}`,
		`Updated: ${formatDateTime(moment.updatedAt)}`,
	]

	return lines.join('\n')
}

export function formatDeleteConfirmation(moment: Moment): string {
	const truncatedContent = moment.content.substring(0, 100)
	const hasMoreContent = moment.content.length > 100
	const contentLine = hasMoreContent ? `${truncatedContent}...` : truncatedContent
	const imagesCount = moment.images?.length ?? 0
	const tagsLine = moment.tags?.length ? moment.tags.join(', ') : 'None'

	return [
		'Confirm delete',
		'',
		`ID: ${moment.id}`,
		`Content: ${contentLine}`,
		`Images: ${imagesCount}`,
		`Tags: ${tagsLine}`,
		'',
		'This action cannot be undone.',
	].join('\n')
}

// Keyboards
export function createDeleteConfirmKeyboard(momentId: string): InlineKeyboard {
	return new InlineKeyboard()
		.text('Confirm delete', `confirm_delete_${momentId}`)
		.text('Cancel', 'cancel_delete')
}

// Moment helpers
export async function fetchMomentOrReplyNotFound(ctx: BotContext, momentId: string): Promise<Moment | undefined> {
	const { MomentService } = await import('@/lib/moments.service')
	const moment = await MomentService.findById(momentId)

	if (!moment) {
		await ctx.reply(ERROR_MESSAGES.NOT_FOUND.replace('{id}', momentId))
		return undefined
	}

	return moment
}
