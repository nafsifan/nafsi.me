import type { BotContext } from '@/telegram/shared'
import { createDeleteConfirmKeyboard, createDeleteStartKeyboard, ERROR_MESSAGES, fetchMomentOrReplyNotFound, formatDeleteConfirmation, TELEGRAM_HTML_OPTIONS } from '@/telegram/shared'

export async function promptDeleteMoment(ctx: BotContext, momentId: string) {
	const moment = await fetchMomentOrReplyNotFound(ctx, momentId)
	if (!moment) {
		return
	}

	await ctx.reply(formatDeleteConfirmation(moment), {
		...TELEGRAM_HTML_OPTIONS,
		reply_markup: createDeleteStartKeyboard(moment.id),
	})
}

export async function handleDeleteCommand(ctx: BotContext) {
	const momentId = ctx.match?.toString().trim()

	if (!momentId) {
		await ctx.reply(
			[
				ERROR_MESSAGES.INVALID_ID,
				'用法：/delete <id>',
				'示例：/delete 0856dbcdabf9',
			].join('\n'),
		)
		return
	}

	await promptDeleteMoment(ctx, momentId)
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
		await ctx.reply('已取消当前操作。')
		return
	}

	if (callbackData.startsWith('confirm_delete_')) {
		try {
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
				'碎碎念已删除成功！',
			)
		}
		catch (error) {
			console.error('[Telegram Delete] delete moment failed:', error)
			await ctx.reply('删除失败，请稍后重试。')
		}
		return
	}

	if (callbackData.startsWith('delete_')) {
		if (ctx.callbackQuery) {
			await ctx.answerCallbackQuery()
		}

		const momentId = callbackData.replace('delete_', '')
		await ctx
			.editMessageReplyMarkup({
				reply_markup: createDeleteConfirmKeyboard(momentId),
			})
			.catch(() => undefined)
	}
}
