import type { BotContext } from '@/telegram/shared'
import type { ImageMeta } from '@/types/moment'
import type { Conversation } from '@grammyjs/conversations'
import { InlineKeyboard } from 'grammy'
import { ERROR_MESSAGES, formatMomentDetails, MOMENT_LIMITS, parseTagsInput, saveTelegramImageToR2 } from '@/telegram/shared'

export async function createMomentConversation(
	conversation: Conversation<BotContext, BotContext>,
	ctx: BotContext,
) {
	await ctx.reply(
		[
			'Create a new moment.',
			`Send the content (up to ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} characters).`,
			'Use /cancel to abort.',
		].join('\n'),
	)

	const contentMessage = await conversation.wait()

	if (contentMessage.message?.text === '/cancel') {
		await ctx.reply('Creation cancelled.')
		return
	}

	const content = contentMessage.message?.text

	if (!content || content.trim().length === 0) {
		await ctx.reply(ERROR_MESSAGES.EMPTY_CONTENT)
		return
	}

	if (content.length > MOMENT_LIMITS.MAX_CONTENT_LENGTH) {
		await ctx.reply(ERROR_MESSAGES.CONTENT_TOO_LONG)
		return
	}

	const images: ImageMeta[] = []

	await ctx.reply(
		[
			'Add images (optional).',
			`Send photos, up to ${MOMENT_LIMITS.MAX_IMAGES}.`,
			'Use /skip to continue without images or /cancel to abort.',
		].join('\n'),
	)

	while (images.length < MOMENT_LIMITS.MAX_IMAGES) {
		const imageMessage = await conversation.wait()
		const message = imageMessage.message
		const text = message?.text?.trim()

		if (text === '/cancel') {
			await ctx.reply('Creation cancelled.')
			return
		}

		if (text === '/skip') {
			await ctx.reply('Continuing to the next step.')
			break
		}

		if (message?.photo) {
			const photo = message.photo[message.photo.length - 1]
			try {
				const imageUrl = await saveTelegramImageToR2(ctx, photo)
				images.push(imageUrl)

				await ctx.reply(
					`Image added (${images.length}/${MOMENT_LIMITS.MAX_IMAGES}). Send more photos, or use /skip to continue without more images.`,
				)
			}
			catch (error) {
				console.error('Failed to store image in R2:', error)
				await ctx.reply('Failed to process the image. Please try again.')
			}
			continue
		}

		if (text && text.startsWith('/')) {
			await ctx.reply('Unsupported command. Send a photo, use /skip to continue without images, or /cancel to abort.')
			continue
		}
		else {
			await ctx.reply('Only photos are supported here. Send an image, use /skip to continue without images, or /cancel to abort.')
		}
	}

	if (images.length > 0) {
		await ctx.reply(`Added ${images.length} image(s).`)
	}

	await ctx.reply(
		[
			'Add tags (optional).',
			`Send tags separated by spaces. Maximum ${MOMENT_LIMITS.MAX_TAGS} tags.`,
			'Use /skip to continue without tags or /cancel to abort.',
		].join('\n'),
	)

	const tagsMessage = await conversation.wait()

	let tags: string[] = []

	if (tagsMessage.message?.text === '/cancel') {
		await ctx.reply('Creation cancelled.')
		return
	}

	if (tagsMessage.message?.text && tagsMessage.message.text !== '/skip') {
		const parsedTags = parseTagsInput(tagsMessage.message.text)

		if (parsedTags.length === 0) {
			await ctx.reply('No valid tags were provided.')
		}
		else {
			tags = parsedTags
			await ctx.reply(`Tags added: ${tags.join(', ')}`)
		}
	}

	const confirmKeyboard = new InlineKeyboard()
		.text('Publish', 'confirm_create')
		.text('Cancel', 'cancel_create')

	await ctx.reply(
		[
			'Review your moment.',
			`Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
			`Images: ${images.length}`,
			`Tags: ${tags.length > 0 ? tags.join(', ') : 'None'}`,
			'',
			'Publish now?',
		].join('\n'),
		{ reply_markup: confirmKeyboard },
	)

	const confirmation = await conversation.wait()

	if (confirmation.callbackQuery?.data === 'cancel_create') {
		await confirmation.answerCallbackQuery()
		if (confirmation.callbackQuery.message) {
			await confirmation
				.editMessageReplyMarkup(undefined)
				.catch(() => undefined)
		}
		await ctx.reply('Creation cancelled.')
		return
	}

	if (confirmation.callbackQuery?.data !== 'confirm_create') {
		if (confirmation.callbackQuery) {
			await confirmation.answerCallbackQuery()
			if (confirmation.callbackQuery.message) {
				await confirmation
					.editMessageReplyMarkup(undefined)
					.catch(() => undefined)
			}
		}
		await ctx.reply('Invalid action. Creation cancelled.')
		return
	}

	await confirmation.answerCallbackQuery()
	if (confirmation.callbackQuery?.message) {
		await confirmation
			.editMessageReplyMarkup(undefined)
			.catch(() => undefined)
	}

	try {
		await ctx.reply('Creating moment...')

		const { MomentService } = await import('@/lib/moments.service')

		const moment = await MomentService.create({
			content: content.trim(),
			images: images.length > 0 ? images : undefined,
			tags: tags.length > 0 ? tags : undefined,
		})

		await ctx.reply(
			[
				'New moment created.',
				'',
				formatMomentDetails(moment),
			].join('\n'),
		)
	}
	catch {
		await ctx.reply('Failed to create moment. Please try again later.')
	}
}
