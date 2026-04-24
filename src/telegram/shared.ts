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
	UNAUTHORIZED: '🚫 暂无权限。',
	GENERAL_ERROR: '❌ 操作失败，请稍后重试。',
	NOT_FOUND: '❌ 未找到该碎碎念。',
	INVALID_ID: '❌ 缺少碎碎念 ID。',
	EMPTY_CONTENT: '❌ 内容不能为空，操作已取消。',
	CONTENT_TOO_LONG: `❌ 内容超出限制，最多 ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} 个字符。`,
} as const

export const TELEGRAM_HTML_OPTIONS = {
	parse_mode: 'HTML' as const,
}

export function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const b = (s: string) => `<b>${s}</b>`
export const i = (s: string) => `<i>${s}</i>`
export const code = (s: string) => `<code>${s}</code>`
export const LINE = '─────────────────'

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
	const tagsText = moment.tags?.length ? moment.tags.join('、') : '无'
	const imageCount = moment.images?.length ?? 0
	const content = escapeHtml(moment.content.trim() || '(空)')

	const lines = [
		b('📄 碎碎念详情'),
		LINE,
		`🆔 ID：${code(moment.id)}`,
		`📝 内容：${content}`,
		`🖼 图片：${imageCount} 张`,
		`🏷 标签：${tagsText}`,
		`🕐 创建：${formatDateTime(moment.createdAt)}`,
		`🔄 更新：${formatDateTime(moment.updatedAt)}`,
	]

	return lines.join('\n')
}

export function formatDeleteConfirmation(moment: Moment): string {
	const normalizedContent = moment.content.trim() || '(空)'
	const truncatedContent = normalizedContent.substring(0, 80)
	const hasMoreContent = normalizedContent.length > 80
	const contentLine = hasMoreContent ? `${truncatedContent}...` : truncatedContent
	const imagesCount = moment.images?.length ?? 0
	const tagsLine = moment.tags?.length ? moment.tags.join('、') : '无'

	return [
		b('⚠️ 确认删除'),
		LINE,
		`📝 内容：${i(escapeHtml(contentLine))}`,
		`🖼 图片：${imagesCount} 张`,
		`🏷 标签：${tagsLine}`,
		LINE,
		b('删除后不可恢复'),
	].join('\n')
}

// Keyboards
export function createDeleteConfirmKeyboard(momentId: string): InlineKeyboard {
	return new InlineKeyboard()
		.text('✅ 确认删除', `confirm_delete_${momentId}`)
		.text('取消', 'cancel_delete')
}

export function createDeleteStartKeyboard(momentId: string): InlineKeyboard {
	return new InlineKeyboard()
		.text('确认删除', `delete_${momentId}`)
		.text('取消', 'cancel_delete')
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
