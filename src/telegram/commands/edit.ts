import type { UpdateMomentInput } from '@/lib/moments.schema'
import type { BotContext } from '@/telegram/shared'
import type { ImageMeta, Moment } from '@/types/moment'
import type { Conversation } from '@grammyjs/conversations'
import { InlineKeyboard } from 'grammy'
import { formatMomentDetails, MOMENT_LIMITS, parseTagsInput, saveTelegramImageToR2 } from '@/telegram/shared'

export async function editMomentConversation(
	conversation: Conversation<BotContext, BotContext>,
	ctx: BotContext,
	moment: Moment,
) {
	await ctx.reply(
		[
			'Edit existing moment.',
			'',
			formatMomentDetails(moment),
			'',
			'Use /cancel at any time to abort.',
		].join('\n'),
	)

	const updateData: UpdateMomentInput = {}

	await ctx.reply(
		[
			`Send the updated content (up to ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} characters).`,
			'Use /skip to keep the current content or /cancel to abort.',
		].join('\n'),
	)

	const contentMessage = await conversation.wait()
	const contentText = contentMessage.message?.text

	if (contentText === '/cancel') {
		await ctx.reply('Edit cancelled.')
		return
	}

	if (!contentText) {
		await ctx.reply('Content is required. Edit cancelled.')
		return
	}

	if (contentText !== '/skip') {
		if (contentText.trim().length === 0) {
			await ctx.reply('Content is required. Edit cancelled.')
			return
		}

		if (contentText.length > MOMENT_LIMITS.MAX_CONTENT_LENGTH) {
			await ctx.reply(`Content is too long. Maximum is ${MOMENT_LIMITS.MAX_CONTENT_LENGTH} characters. Edit cancelled.`)
			return
		}

		updateData.content = contentText.trim()
	}

	await ctx.reply(
		[
			`Send new images (up to ${MOMENT_LIMITS.MAX_IMAGES}).`,
			'Use /skip to keep current images, /clear to remove all images, or /cancel to abort.',
		].join('\n'),
	)

	const newImages: ImageMeta[] = []
	let shouldRemoveImages = false

	while (newImages.length < MOMENT_LIMITS.MAX_IMAGES) {
		const imageMessage = await conversation.wait()
		const message = imageMessage.message
		const text = message?.text?.trim()

		if (text === '/cancel') {
			await ctx.reply('Edit cancelled.')
			return
		}

		if (text === '/skip') {
			if (newImages.length === 0) {
				if (shouldRemoveImages) {
					await ctx.reply('No images will remain for this moment.')
				}
				else {
					await ctx.reply('Keeping existing images.')
				}
			}
			else {
				await ctx.reply('Continuing to the next step.')
			}
			break
		}

		if (text === '/clear') {
			shouldRemoveImages = true
			newImages.length = 0
			await ctx.reply('All images removed. Send new images, use /skip to keep none, or /cancel to abort.')
			continue
		}

		if (message?.photo) {
			const photo = message.photo[message.photo.length - 1]
			try {
				const imageUrl = await saveTelegramImageToR2(ctx, photo)
				newImages.push(imageUrl)
				shouldRemoveImages = false

				await ctx.reply(`Image added (${newImages.length}/${MOMENT_LIMITS.MAX_IMAGES}). Send more photos, or use /skip to continue.`)
			}
			catch (error) {
				console.error('Failed to store image in R2:', error)
				await ctx.reply('Failed to process the image. Please try again.')
			}
			continue
		}

		if (text && text.startsWith('/')) {
			await ctx.reply('Unsupported command. Send a photo, use /skip, /clear, or /cancel.')
			continue
		}

		await ctx.reply('Only photos are supported here. Send an image, use /skip to keep current images, /clear to remove them, or /cancel to abort.')
	}

	if (newImages.length > 0) {
		updateData.images = newImages
	}
	else if (shouldRemoveImages) {
		updateData.images = []
	}

	await ctx.reply(
		[
			`Send updated tags separated by spaces (maximum ${MOMENT_LIMITS.MAX_TAGS} tags, each up to ${MOMENT_LIMITS.MAX_TAG_LENGTH} characters).`,
			'Use /skip to keep current tags, /clear to remove all tags, or /cancel to abort.',
		].join('\n'),
	)

	const tagsMessage = await conversation.wait()
	const tagsText = tagsMessage.message?.text

	if (tagsText === '/cancel') {
		await ctx.reply('Edit cancelled.')
		return
	}

	if (!tagsText) {
		await ctx.reply('No tags were provided. Edit cancelled.')
		return
	}

	if (tagsText === '/clear') {
		updateData.tags = []
		await ctx.reply('All tags will be removed.')
	}
	else if (tagsText !== '/skip') {
		const tags = parseTagsInput(tagsText)

		if (tags.length === 0) {
			await ctx.reply('No valid tags were provided. Edit cancelled.')
			return
		}

		updateData.tags = tags
		await ctx.reply(`Tags will be updated to: ${tags.join(', ')}`)
	}

	if (Object.keys(updateData).length === 0) {
		await ctx.reply('No changes detected. Edit cancelled.')
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
		.text('Save changes', 'confirm_edit')
		.text('Cancel', 'cancel_edit')

	await ctx.reply(
		[
			'Review the updated moment.',
			'',
			formatMomentDetails(previewMoment),
			'',
			'Save changes?',
		].join('\n'),
		{ reply_markup: confirmKeyboard },
	)

	const confirmation = await conversation.wait()

	if (confirmation.callbackQuery?.data !== 'confirm_edit') {
		if (confirmation.callbackQuery) {
			await confirmation.answerCallbackQuery()
			if (confirmation.callbackQuery.message) {
				await confirmation
					.editMessageReplyMarkup(undefined)
					.catch(() => undefined)
			}
		}
		await ctx.reply('Edit cancelled.')
		return
	}

	await confirmation.answerCallbackQuery()
	if (confirmation.callbackQuery?.message) {
		await confirmation
			.editMessageReplyMarkup(undefined)
			.catch(() => undefined)
	}
	await ctx.reply('Saving changes...')

	const { MomentService } = await import('@/lib/moments.service')
	const updatedMoment = await MomentService.update(moment.id, updateData)

	await ctx.reply(
		[
			'Moment updated successfully.',
			'',
			formatMomentDetails(updatedMoment),
		].join('\n'),
	)
}
