import type { BotContext } from '@/telegram/shared'
import { createDeleteConfirmKeyboard, ERROR_MESSAGES, fetchMomentOrReplyNotFound, formatDeleteConfirmation, formatTelegramDateTime } from '@/telegram/shared'

export async function handleDeleteCommand(ctx: BotContext) {
	const momentId = ctx.match?.toString().trim()

	if (!momentId) {
		await ctx.reply(
			[
				ERROR_MESSAGES.INVALID_ID,
				'Usage: /delete <id>',
				'Example: /delete 0856dbcdabf9',
			].join('\n'),
		)
		return
	}

	const moment = await fetchMomentOrReplyNotFound(ctx, momentId)
	if (!moment) {
		return
	}

	await ctx.reply(formatDeleteConfirmation(moment), {
		reply_markup: createDeleteConfirmKeyboard(moment.id),
	})
}

export async function handleDeleteCallback(ctx: BotContext) {
	const callbackData = ctx.callbackQuery?.data

	if (!callbackData) {
		return
	}

	if (callbackData === 'cancel_delete') {
		if (ctx.callbackQuery) {
			await ctx.answerCallbackQuery()
			if (ctx.callbackQuery.message) {
				await ctx
					.editMessageReplyMarkup(undefined)
					.catch(() => undefined)
			}
		}
		await ctx.reply('Delete cancelled.')
		return
	}

	if (callbackData.startsWith('confirm_delete_')) {
		if (ctx.callbackQuery) {
			await ctx.answerCallbackQuery()
		}

		const momentId = callbackData.replace('confirm_delete_', '')
		const { MomentService } = await import('@/lib/moments.service')

		await MomentService.delete(momentId)

		if (ctx.callbackQuery?.message) {
			await ctx
				.editMessageReplyMarkup(undefined)
				.catch(() => undefined)
		}

		await ctx.reply(
			[
				'Moment deleted.',
				`ID: ${momentId}`,
				`Deleted at: ${formatTelegramDateTime(new Date())}`,
			].join('\n'),
		)
		return
	}

	if (callbackData.startsWith('delete_')) {
		if (ctx.callbackQuery) {
			await ctx.answerCallbackQuery()
		}

		const momentId = callbackData.replace('delete_', '')
		const moment = await fetchMomentOrReplyNotFound(ctx, momentId)
		if (!moment) {
			return
		}

		await ctx.reply(formatDeleteConfirmation(moment), {
			reply_markup: createDeleteConfirmKeyboard(moment.id),
		})
	}
}
