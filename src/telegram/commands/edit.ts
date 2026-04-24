import type { UpdateMomentInput } from '@/lib/moments.schema'
import type { BotContext } from '@/telegram/shared'
import type { ImageMeta, Moment } from '@/types/moment'
import type { Conversation } from '@grammyjs/conversations'
import { InlineKeyboard } from 'grammy'
import { escapeHtml, LINE, MOMENT_LIMITS, parseTagsInput, saveTelegramImageToR2, TELEGRAM_HTML_OPTIONS } from '@/telegram/shared'

const STEP_TIMEOUT_MS = 10 * 60 * 1000

async function waitStep(conversation: Conversation<BotContext, BotContext>) {
	return conversation.wait({ maxMilliseconds: STEP_TIMEOUT_MS })
}

async function clearKeyboard(ctx: BotContext) {
	if (ctx.callbackQuery?.message) {
		await ctx
			.editMessageReplyMarkup(undefined)
			.catch(() => undefined)
	}
}

export async function editMomentConversation(
	conversation: Conversation<BotContext, BotContext>,
	ctx: BotContext,
	moment: Moment,
) {
	const currentContent = moment.content.trim() || '(空)'
	const currentContentPreview = currentContent.length > 120 ? `${currentContent.slice(0, 120)}...` : currentContent
	const currentImageCount = moment.images?.length ?? 0
	const currentTagsText = moment.tags?.length ? moment.tags.join('、') : '无'

	let lastInteractionAt = Date.now()

	const ensureNotTimedOut = async (): Promise<boolean> => {
		const now = Date.now()
		if (now - lastInteractionAt > STEP_TIMEOUT_MS) {
			await ctx.reply('⏱ 会话已超时，请重新开始。')
			return false
		}
		lastInteractionAt = now
		return true
	}

	await ctx.reply(
		[
			'<b>✏️ 步骤 1/4 · 修改内容</b>',
			LINE,
			`当前：<i>${escapeHtml(currentContentPreview)}</i>`,
			'',
			`发送新内容，或点击跳过（最多 ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} 字）`,
		].join('\n'),
		{
			...TELEGRAM_HTML_OPTIONS,
			reply_markup: new InlineKeyboard()
				.text('跳过', 'flow_edit_skip')
				.text('取消', 'flow_edit_cancel'),
		},
	)

	const updateData: UpdateMomentInput = {}
	while (true) {
		const step = await waitStep(conversation)
		if (!await ensureNotTimedOut()) {
			return
		}
		const action = step.callbackQuery?.data
		const text = step.message?.text?.trim()

		if (action === 'flow_edit_cancel') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			await ctx.reply('✅ 已取消。')
			return
		}

		if (action === 'flow_edit_skip') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			break
		}

		if (action) {
			await step.answerCallbackQuery()
			await ctx.reply('输入无效，请按当前步骤操作。')
			continue
		}

		if (!text) {
			await ctx.reply('输入无效，请发送文本内容。')
			continue
		}

		if (text === '/cancel') {
			await ctx.reply('✅ 已取消。')
			return
		}

		if (text === '/skip') {
			break
		}

		if (text.length > MOMENT_LIMITS.MAX_CONTENT_LENGTH) {
			await ctx.reply(`内容超出限制，最多 ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} 个字符。`)
			continue
		}

		updateData.content = text
		break
	}

	await ctx.reply(
		[
			'<b>🖼 步骤 2/4 · 修改图片</b>',
			LINE,
			`当前：${currentImageCount} 张`,
			'',
			`发送新图片，或跳过 / 清空（最多 ${MOMENT_LIMITS.MAX_IMAGES} 张）`,
		].join('\n'),
		{
			...TELEGRAM_HTML_OPTIONS,
			reply_markup: new InlineKeyboard()
				.text('跳过', 'flow_edit_skip')
				.text('清空', 'flow_edit_clear')
				.text('取消', 'flow_edit_cancel'),
		},
	)

	const newImages: ImageMeta[] = []
	let shouldRemoveImages = false

	while (newImages.length < MOMENT_LIMITS.MAX_IMAGES) {
		const step = await waitStep(conversation)
		if (!await ensureNotTimedOut()) {
			return
		}
		const action = step.callbackQuery?.data
		const text = step.message?.text?.trim()

		if (action === 'flow_edit_cancel') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			await ctx.reply('✅ 已取消。')
			return
		}

		if (action === 'flow_edit_skip') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			break
		}

		if (action === 'flow_edit_clear') {
			await step.answerCallbackQuery()
			shouldRemoveImages = true
			newImages.length = 0
			await ctx.reply('已清空图片。可继续发送新图片，或点击跳过。')
			continue
		}

		if (action) {
			await step.answerCallbackQuery()
			await ctx.reply('输入无效，请发送图片，或点击跳过/清空/取消。')
			continue
		}

		if (text === '/cancel') {
			await ctx.reply('✅ 已取消。')
			return
		}

		if (text === '/skip') {
			break
		}

		if (text === '/clear') {
			shouldRemoveImages = true
			newImages.length = 0
			await ctx.reply('已清空图片。可继续发送新图片，或点击跳过。')
			continue
		}

		if (step.message?.photo) {
			const photo = step.message.photo[step.message.photo.length - 1]
			try {
				const imageUrl = await saveTelegramImageToR2(ctx, photo)
				newImages.push(imageUrl)
				shouldRemoveImages = false
				await ctx.reply(`🖼 已添加 ${newImages.length}/${MOMENT_LIMITS.MAX_IMAGES} 张图片`)
			}
			catch (error) {
				console.error('Failed to store image in R2:', error)
				await ctx.reply('图片处理失败，请重试。')
			}
			continue
		}

		await ctx.reply('当前步骤仅支持图片，请发送图片或点击跳过。')
	}

	if (newImages.length > 0) {
		updateData.images = newImages
	}
	else if (shouldRemoveImages) {
		updateData.images = []
	}

	await ctx.reply(
		[
			'<b>🏷 步骤 3/4 · 修改标签</b>',
			LINE,
			`当前：${currentTagsText}`,
			'',
			'发送新标签，或跳过 / 清空',
		].join('\n'),
		{
			...TELEGRAM_HTML_OPTIONS,
			reply_markup: new InlineKeyboard()
				.text('跳过', 'flow_edit_skip')
				.text('清空', 'flow_edit_clear')
				.text('取消', 'flow_edit_cancel'),
		},
	)

	while (true) {
		const step = await waitStep(conversation)
		if (!await ensureNotTimedOut()) {
			return
		}
		const action = step.callbackQuery?.data
		const text = step.message?.text?.trim()

		if (action === 'flow_edit_cancel') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			await ctx.reply('✅ 已取消。')
			return
		}

		if (action === 'flow_edit_skip') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			break
		}

		if (action === 'flow_edit_clear') {
			await step.answerCallbackQuery()
			updateData.tags = []
			await clearKeyboard(step)
			break
		}

		if (action) {
			await step.answerCallbackQuery()
			await ctx.reply('输入无效，请发送标签文本，或点击跳过/清空/取消。')
			continue
		}

		if (!text) {
			await ctx.reply('输入无效，请发送标签文本。')
			continue
		}

		if (text === '/cancel') {
			await ctx.reply('✅ 已取消。')
			return
		}

		if (text === '/skip') {
			break
		}

		if (text === '/clear') {
			updateData.tags = []
			break
		}

		const tags = parseTagsInput(text)
		if (tags.length === 0) {
			await ctx.reply('未识别到有效标签，请重试或点击跳过。')
			continue
		}

		updateData.tags = tags
		break
	}

	if (Object.keys(updateData).length === 0) {
		await ctx.reply('未检测到修改内容。')
		return
	}

	const previewMoment: Moment = {
		...moment,
		content: updateData.content ?? moment.content,
		images: updateData.images !== undefined ? updateData.images : moment.images,
		tags: updateData.tags !== undefined ? updateData.tags : moment.tags,
		updatedAt: new Date(),
	}

	const confirmKeyboard = new InlineKeyboard()
		.text('✅ 保存修改', 'confirm_edit')
		.text('取消', 'cancel_edit')

	const previewContent = escapeHtml(previewMoment.content.substring(0, 80))
	const hasMore = previewMoment.content.length > 80
	const previewImageCount = previewMoment.images?.length ?? 0
	const previewTags = previewMoment.tags?.length ? previewMoment.tags.join('、') : '无'

	await ctx.reply(
		[
			'<b>✅ 步骤 4/4 · 确认保存</b>',
			LINE,
			'<b>📝 内容</b>',
			`<i>${previewContent}${hasMore ? '...' : ''}</i>`,
			'',
			`🖼 图片：${previewImageCount} 张`,
			`🏷 标签：${previewTags}`,
		].join('\n'),
		{ ...TELEGRAM_HTML_OPTIONS, reply_markup: confirmKeyboard },
	)

	while (true) {
		const confirmation = await waitStep(conversation)
		if (!await ensureNotTimedOut()) {
			return
		}
		const action = confirmation.callbackQuery?.data

		if (!action) {
			if (confirmation.message?.text?.trim() === '/cancel') {
				await ctx.reply('已取消当前操作。')
				return
			}
			await ctx.reply('请点击按钮确认，或发送 /cancel 取消。')
			continue
		}

		if (action !== 'confirm_edit' && action !== 'cancel_edit') {
			await confirmation.answerCallbackQuery()
			await ctx.reply('输入无效，请点击下方按钮操作。')
			continue
		}

		await confirmation.answerCallbackQuery()
		await clearKeyboard(confirmation)

		if (action === 'cancel_edit') {
			await ctx.reply('已取消当前操作。')
			return
		}

		break
	}

	try {
		await ctx.reply('⏳ 正在保存修改...')
		const { MomentService } = await import('@/lib/moments.service')
		await MomentService.update(moment.id, updateData)

		await ctx.reply('✅ 碎碎念已保存成功！')
	}
	catch (error) {
		console.error('[Telegram Edit] update moment failed:', error)
		await ctx.reply('❌ 修改失败，请稍后重试。')
	}
}
