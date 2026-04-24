import type { BotContext } from '@/telegram/shared'
import type { ImageMeta } from '@/types/moment'
import type { Conversation } from '@grammyjs/conversations'
import { InlineKeyboard } from 'grammy'
import { escapeHtml, LINE, MOMENT_LIMITS, parseTagsInput, saveTelegramImageToR2, TELEGRAM_HTML_OPTIONS } from '@/telegram/shared'

const STEP_TIMEOUT_MS = 5 * 60 * 1000 // 5分钟

async function waitStep(
	conversation: Conversation<BotContext, BotContext>,
	ctx: BotContext,
	lastInteractionTime: { value: number }
): Promise<BotContext> {
	const step = await conversation.wait()

	const now = await conversation.now()
	const elapsed = now - lastInteractionTime.value

	if (elapsed > STEP_TIMEOUT_MS) {
		await ctx.reply('⏱ 会话已超时（5分钟无操作），请重新开始。')
		await conversation.halt()
	}

	lastInteractionTime.value = now
	return step
}

async function clearKeyboard(ctx: BotContext) {
	if (ctx.callbackQuery?.message) {
		await ctx
			.editMessageReplyMarkup(undefined)
			.catch(() => undefined)
	}
}

export async function createMomentConversation(
	conversation: Conversation<BotContext, BotContext>,
	ctx: BotContext,
) {
	const lastInteractionTime = { value: await conversation.now() }
	await ctx.reply(
		[
			'<b>📝 步骤 1/4 · 内容</b>',
			'',
			`请输入碎碎念内容（最多 ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} 字）`,
		].join('\n'),
		{
			...TELEGRAM_HTML_OPTIONS,
			reply_markup: new InlineKeyboard().text('取消', 'flow_publish_cancel'),
		},
	)

	let content = ''
	while (!content) {
		const step = await waitStep(conversation, ctx, lastInteractionTime)

		const action = step.callbackQuery?.data
		const text = step.message?.text?.trim()

		if (action === 'flow_publish_cancel') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			await ctx.reply('✅ 已取消。')
			return
		}

		if (action) {
			await step.answerCallbackQuery()
			await ctx.reply('输入无效，请按当前步骤操作。')
			continue
		}

		if (!text) {
			await ctx.reply('输入无效，请发送碎碎念内容。')
			continue
		}

		if (text === '/cancel') {
			await ctx.reply('✅ 已取消。')
			return
		}

		if (text.length > MOMENT_LIMITS.MAX_CONTENT_LENGTH) {
			await ctx.reply(`内容超出限制，最多 ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} 个字符。`)
			continue
		}

		content = text
	}

	const images: ImageMeta[] = []
	await ctx.reply(
		[
			'<b>🖼 步骤 2/4 · 图片</b>',
			'',
			`发送图片，或点击跳过（最多 ${MOMENT_LIMITS.MAX_IMAGES} 张）`,
		].join('\n'),
		{
			...TELEGRAM_HTML_OPTIONS,
			reply_markup: new InlineKeyboard()
				.text('跳过', 'flow_publish_skip')
				.text('取消', 'flow_publish_cancel'),
		},
	)

	while (images.length < MOMENT_LIMITS.MAX_IMAGES) {
		const step = await waitStep(conversation, ctx, lastInteractionTime)
		const action = step.callbackQuery?.data
		const text = step.message?.text?.trim()

		if (action === 'flow_publish_cancel') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			await ctx.reply('✅ 已取消。')
			return
		}

		if (action === 'flow_publish_skip') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			break
		}

		if (action) {
			await step.answerCallbackQuery()
			await ctx.reply('输入无效，请发送图片，或点击跳过/取消。')
			continue
		}

		if (text === '/cancel') {
			await ctx.reply('✅ 已取消。')
			return
		}

		if (text === '/skip') {
			break
		}

		if (step.message?.photo) {
			const photo = step.message.photo[step.message.photo.length - 1]
			try {
				const imageUrl = await saveTelegramImageToR2(ctx, photo)
				images.push(imageUrl)
				await ctx.reply(`🖼 已添加 ${images.length}/${MOMENT_LIMITS.MAX_IMAGES} 张图片`)
			}
			catch (error) {
				console.error('Failed to store image in R2:', error)
				await ctx.reply('图片处理失败，请重试。')
			}
			continue
		}

		await ctx.reply('当前步骤仅支持图片，请发送图片或点击跳过。')
	}

	await ctx.reply(
		[
			'<b>🏷 步骤 3/4 · 标签</b>',
			'',
			`发送标签，空格分隔，或点击跳过（最多 ${MOMENT_LIMITS.MAX_TAGS} 个）`,
		].join('\n'),
		{
			...TELEGRAM_HTML_OPTIONS,
			reply_markup: new InlineKeyboard()
				.text('跳过', 'flow_publish_skip')
				.text('取消', 'flow_publish_cancel'),
		},
	)

	let tags: string[] = []
	while (true) {
		const step = await waitStep(conversation, ctx, lastInteractionTime)
		const action = step.callbackQuery?.data
		const text = step.message?.text?.trim()

		if (action === 'flow_publish_cancel') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			await ctx.reply('✅ 已取消。')
			return
		}

		if (action === 'flow_publish_skip') {
			await step.answerCallbackQuery()
			await clearKeyboard(step)
			break
		}

		if (action) {
			await step.answerCallbackQuery()
			await ctx.reply('输入无效，请发送标签文本，或点击跳过/取消。')
			continue
		}

		if (text === '/cancel') {
			await ctx.reply('✅ 已取消。')
			return
		}

		if (text === '/skip') {
			break
		}

		if (!text) {
			await ctx.reply('输入无效，请发送标签文本。')
			continue
		}

		const parsedTags = parseTagsInput(text)
		if (parsedTags.length === 0) {
			await ctx.reply('未识别到有效标签，请重试或点击跳过。')
			continue
		}

		tags = parsedTags
		break
	}

	const confirmKeyboard = new InlineKeyboard()
		.text('✅ 确认发布', 'confirm_create')
		.text('取消', 'cancel_create')

	const previewContent = escapeHtml(content.substring(0, 80))
	const hasMore = content.length > 80

	await ctx.reply(
		[
			'<b>✅ 步骤 4/4 · 确认发布</b>',
			LINE,
			'<b>📝 内容</b>',
			`<i>${previewContent}${hasMore ? '...' : ''}</i>`,
			'',
			`🖼 图片：${images.length} 张`,
			`🏷 标签：${tags.length > 0 ? tags.join('、') : '无'}`,
		].join('\n'),
		{ ...TELEGRAM_HTML_OPTIONS, reply_markup: confirmKeyboard },
	)

	while (true) {
		const confirmation = await waitStep(conversation, ctx, lastInteractionTime)
		const action = confirmation.callbackQuery?.data

		if (!action) {
			if (confirmation.message?.text?.trim() === '/cancel') {
				await ctx.reply('已取消当前操作。')
				return
			}
			await ctx.reply('请点击按钮确认，或发送 /cancel 取消。')
			continue
		}

		if (action !== 'confirm_create' && action !== 'cancel_create') {
			await confirmation.answerCallbackQuery()
			await ctx.reply('输入无效，请点击下方按钮操作。')
			continue
		}

		await confirmation.answerCallbackQuery()
		await clearKeyboard(confirmation)

		if (action === 'cancel_create') {
			await ctx.reply('已取消当前操作。')
			return
		}

		break
	}

	try {
		await ctx.reply('⏳ 正在发布...')

		const { MomentService } = await import('@/lib/moments.service')
		await MomentService.create({
			content: content.trim(),
			images: images.length > 0 ? images : undefined,
			tags: tags.length > 0 ? tags : undefined,
		})

		await ctx.reply('🎉 碎碎念已发布成功！')
	}
	catch (error) {
		console.error('[Telegram Publish] create moment failed:', error)
		await ctx.reply('❌ 发布失败，请稍后重试。')
	}
}
