import type { BotContext } from '@/telegram/shared'
import process from 'node:process'
import { conversations, createConversation } from '@grammyjs/conversations'
import { Bot, session } from 'grammy'
import { ERROR_MESSAGES, fetchMomentOrReplyNotFound } from '@/telegram/shared'
import { handleDeleteCallback, handleDeleteCommand } from './commands/delete'
import { editMomentConversation } from './commands/edit'
import { createMomentConversation } from './commands/publish'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID

if (!BOT_TOKEN) {
	throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables')
}

if (!ADMIN_ID) {
	throw new Error('TELEGRAM_ADMIN_ID is not defined in environment variables')
}

const ALLOWED_USER_ID = Number(ADMIN_ID)

if (Number.isNaN(ALLOWED_USER_ID)) {
	throw new TypeError('TELEGRAM_ADMIN_ID must be a valid number')
}

export const bot = new Bot<BotContext>(BOT_TOKEN)

const CONVERSATION_CALLBACK_ACTIONS = new Set([
	'confirm_create',
	'cancel_create',
	'confirm_edit',
	'cancel_edit',
])

bot.use(session({
	initial: () => ({}),
}))

bot.use(conversations())

bot.use(async (ctx, next) => {
	const userId = ctx.from?.id

	if (!userId) {
		return
	}

	if (userId !== ALLOWED_USER_ID) {
		await ctx.reply(ERROR_MESSAGES.UNAUTHORIZED)
		return
	}

	await next()
})

bot.use(async (ctx, next) => {
	try {
		await next()
	}
	catch {
		await ctx.reply(ERROR_MESSAGES.GENERAL_ERROR)
	}
})

const FLOW_INLINE_ACTIONS = new Set([
	'confirm_create',
	'cancel_create',
	'confirm_edit',
	'cancel_edit',
])

const ALLOWED_FLOW_COMMANDS = new Set(['/skip', '/clear'])

bot.use(async (ctx, next) => {
	const publishActive = ctx.conversation.active('createMoment') > 0
	const editActive = ctx.conversation.active('editMoment') > 0

	if (!publishActive && !editActive) {
		return next()
	}

	if (ctx.callbackQuery?.data) {
		if (FLOW_INLINE_ACTIONS.has(ctx.callbackQuery.data)) {
			return next()
		}

		await ctx.answerCallbackQuery({ text: 'Finish the current flow or use /cancel first.', show_alert: true })
		return
	}

	const rawText = ctx.message?.text?.trim()

	if (!rawText || !rawText.startsWith('/')) {
		return next()
	}

	const commandToken = rawText.split(/\s+/)[0]
	const baseCommand = commandToken.split('@')[0]

	if (baseCommand === '/cancel') {
		if (publishActive) {
			await ctx.conversation.exit('createMoment')
		}
		if (editActive) {
			await ctx.conversation.exit('editMoment')
		}
		await ctx.reply('Active flow cancelled.')
		return
	}

	if (ALLOWED_FLOW_COMMANDS.has(baseCommand)) {
		return next()
	}

	await ctx.reply('A flow is already in progress. Finish it first or use /cancel to abort.')
})

bot.use(createConversation(createMomentConversation, 'createMoment'))
bot.use(createConversation(editMomentConversation, 'editMoment'))

bot.catch(async (err) => {
	if (err.ctx.callbackQuery) {
		await err.ctx
			.answerCallbackQuery({ text: ERROR_MESSAGES.GENERAL_ERROR, show_alert: true })
			.catch(() => undefined)
	}
})

bot.command('start', async (ctx) => {
	await ctx.reply(
		[
			'commands:',
			'',
			'/publish - create a new moment',
			'',
			'/edit <id> - edit a moment',
			'',
			'/delete <id> - delete a moment',
		].join('\n'),
	)
})

bot.command('publish', async (ctx) => {
	await ctx.conversation.enter('createMoment')
})

bot.command('edit', async (ctx) => {
	const momentId = ctx.match?.toString().trim()

	if (!momentId) {
		await ctx.reply(
			[
				ERROR_MESSAGES.INVALID_ID,
				'Usage: /edit <id>',
				'Example: /edit abc123',
			].join('\n'),
		)
		return
	}

	const moment = await fetchMomentOrReplyNotFound(ctx, momentId)
	if (!moment) {
		return
	}

	await ctx.conversation.enter('editMoment', moment)
})

bot.command('delete', handleDeleteCommand)

bot.command('cancel', async (ctx) => {
	await ctx.reply('Operation cancelled.')
})

bot.on('callback_query:data', async (ctx) => {
	const data = ctx.callbackQuery.data

	if (data.startsWith('edit_')) {
		const momentId = data.replace('edit_', '')
		await ctx.answerCallbackQuery()
		const moment = await fetchMomentOrReplyNotFound(ctx, momentId)
		if (!moment) {
			return
		}
		await ctx.conversation.enter('editMoment', moment)
		return
	}

	if (data.startsWith('delete_') || data.startsWith('confirm_delete_') || data === 'cancel_delete') {
		await handleDeleteCallback(ctx)
		return
	}

	if (CONVERSATION_CALLBACK_ACTIONS.has(data)) {
		await ctx.answerCallbackQuery()
		return
	}

	await ctx.answerCallbackQuery('Unknown action.')
})

bot.on('message', async (ctx) => {
	if (ctx.message?.text) {
		return
	}

	await ctx.reply('Unsupported message type. Use commands. See /start for help.')
})
