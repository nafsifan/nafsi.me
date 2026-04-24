import type { BotContext } from '@/telegram/shared'
import type { Moment } from '@/types/moment'
import process from 'node:process'
import { conversations, createConversation } from '@grammyjs/conversations'
import { Bot, InlineKeyboard, session } from 'grammy'
import { ERROR_MESSAGES, fetchMomentOrReplyNotFound, TELEGRAM_HTML_OPTIONS } from '@/telegram/shared'
import { handleDeleteCallback, handleDeleteCommand, promptDeleteMoment } from './commands/delete'
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
	'flow_publish_cancel',
	'flow_publish_skip',
	'flow_edit_cancel',
	'flow_edit_skip',
	'flow_edit_clear',
])

const START_CALLBACK_ACTIONS = new Set([
	'start_publish',
	'start_edit',
	'start_delete',
	'start_help',
])

const MOMENT_SELECTOR_PAGE_SIZE = 5

function formatSelectorLabel(moment: Moment): string {
	const preview = moment.content.replace(/\s+/g, ' ').trim().slice(0, 22)
	return preview || '无内容'
}

async function renderMomentSelector(ctx: BotContext, mode: 'edit' | 'delete', page: number) {
	const offset = page * MOMENT_SELECTOR_PAGE_SIZE
	const { MomentService } = await import('@/lib/moments.service')
	const result = await MomentService.findAll({
		limit: MOMENT_SELECTOR_PAGE_SIZE,
		offset,
		tag: undefined,
	})

	const totalPages = Math.max(1, Math.ceil(result.total / MOMENT_SELECTOR_PAGE_SIZE))
	const safePage = Math.min(Math.max(0, page), totalPages - 1)
	const safeOffset = safePage * MOMENT_SELECTOR_PAGE_SIZE

	const pageData = safePage === page
		? result
		: await MomentService.findAll({ limit: MOMENT_SELECTOR_PAGE_SIZE, offset: safeOffset, tag: undefined })

	const title = mode === 'edit' ? '<b>✏️ 选择要编辑的碎碎念</b>' : '<b>🗑️ 选择要删除的碎碎念</b>'
	const emptyText = mode === 'edit' ? '暂无可编辑碎碎念。' : '暂无可删除碎碎念。'

	if (pageData.data.length === 0) {
		await ctx.reply(emptyText)
		return
	}

	const keyboard = new InlineKeyboard()

	for (const moment of pageData.data) {
		const callback = mode === 'edit' ? `pick_edit_${moment.id}` : `pick_delete_${moment.id}`
		keyboard.text(formatSelectorLabel(moment), callback).row()
	}

	const hasPrev = safePage > 0
	const hasNext = safePage < totalPages - 1

	if (hasPrev || hasNext) {
		if (hasPrev) {
			keyboard.text('⬅️ 上一页', `list_${mode}_${safePage - 1}`)
		}
		if (hasNext) {
			keyboard.text('下一页 ➡️', `list_${mode}_${safePage + 1}`)
		}
		keyboard.row()
	}

	keyboard.text('取消', 'selector_cancel')

	await ctx.reply(
		[
			title,
			`第 ${safePage + 1}/${totalPages} 页`,
		].join('\n\n'),
		{ ...TELEGRAM_HTML_OPTIONS, reply_markup: keyboard },
	)
}

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
	catch (error) {
		console.error('[Telegram Bot] middleware error:', {
			error,
			userId: ctx.from?.id,
			updateType: Object.keys(ctx.update)[0],
		})
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
		if (
			FLOW_INLINE_ACTIONS.has(ctx.callbackQuery.data)
			|| ctx.callbackQuery.data.startsWith('flow_publish_')
			|| ctx.callbackQuery.data.startsWith('flow_edit_')
		) {
			return next()
		}

		await ctx.answerCallbackQuery({ text: '当前有未完成流程，请先完成或使用 /cancel。', show_alert: true })
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
		await ctx.reply('✅ 已取消。')
		return
	}

	if (ALLOWED_FLOW_COMMANDS.has(baseCommand)) {
		return next()
	}

	await ctx.reply('⚠️ 当前有未完成流程，请先完成或取消。')
})

bot.use(createConversation(createMomentConversation, 'createMoment'))
bot.use(createConversation(editMomentConversation, 'editMoment'))

bot.catch(async (err) => {
	console.error('[Telegram Bot] unhandled error:', {
		error: err.error,
		userId: err.ctx.from?.id,
		updateType: Object.keys(err.ctx.update)[0],
	})

	if (err.ctx.callbackQuery) {
		await err.ctx
			.answerCallbackQuery({ text: ERROR_MESSAGES.GENERAL_ERROR, show_alert: true })
			.catch(() => undefined)
	}
})

bot.command('start', async (ctx) => {
	const startKeyboard = new InlineKeyboard()
		.text('📝 发布', 'start_publish')
		.text('✏️ 编辑', 'start_edit')
		.row()
		.text('🗑️ 删除', 'start_delete')
		.text('❓ 帮助', 'start_help')

	await ctx.reply(
		[
			'<b>✨ Nafsi 的碎碎念</b>',
			'',
			'发布、编辑、删除碎碎念，请选择操作：',
		].join('\n'),
		{
			...TELEGRAM_HTML_OPTIONS,
			reply_markup: startKeyboard,
		},
	)
})

bot.command('publish', async (ctx) => {
	await ctx.conversation.enter('createMoment')
})

bot.command('edit', async (ctx) => {
	const momentId = ctx.match?.toString().trim()

	if (!momentId) {
		await renderMomentSelector(ctx, 'edit', 0)
		return
	}

	const moment = await fetchMomentOrReplyNotFound(ctx, momentId)
	if (!moment) {
		return
	}

	await ctx.conversation.enter('editMoment', moment)
})

bot.command('delete', async (ctx) => {
	const momentId = ctx.match?.toString().trim()

	if (!momentId) {
		await renderMomentSelector(ctx, 'delete', 0)
		return
	}

	await handleDeleteCommand(ctx)
})

bot.command('cancel', async (ctx) => {
	await ctx.reply('✅ 已取消。')
})

bot.on('callback_query:data', async (ctx) => {
	const data = ctx.callbackQuery.data

	if (data.startsWith('pick_edit_')) {
		const momentId = data.replace('pick_edit_', '')
		await ctx.answerCallbackQuery()
		const moment = await fetchMomentOrReplyNotFound(ctx, momentId)
		if (!moment) {
			return
		}
		await ctx.conversation.enter('editMoment', moment)
		return
	}

	if (data.startsWith('pick_delete_')) {
		const momentId = data.replace('pick_delete_', '')
		await ctx.answerCallbackQuery()
		await promptDeleteMoment(ctx, momentId)
		return
	}

	if (data.startsWith('list_edit_')) {
		const page = Number(data.replace('list_edit_', ''))
		await ctx.answerCallbackQuery()
		if (!Number.isInteger(page) || page < 0) {
			await ctx.reply('页码无效。')
			return
		}
		await renderMomentSelector(ctx, 'edit', page)
		return
	}

	if (data.startsWith('list_delete_')) {
		const page = Number(data.replace('list_delete_', ''))
		await ctx.answerCallbackQuery()
		if (!Number.isInteger(page) || page < 0) {
			await ctx.reply('页码无效。')
			return
		}
		await renderMomentSelector(ctx, 'delete', page)
		return
	}

	if (data === 'selector_cancel') {
		await ctx.answerCallbackQuery()
		await ctx.reply('✅ 已取消。')
		return
	}

	if (data.startsWith('delete_') || data.startsWith('confirm_delete_') || data === 'cancel_delete') {
		await handleDeleteCallback(ctx)
		return
	}

	if (START_CALLBACK_ACTIONS.has(data)) {
		await ctx.answerCallbackQuery()

		if (data === 'start_publish') {
			await ctx.conversation.enter('createMoment')
			return
		}

		if (data === 'start_edit') {
			await renderMomentSelector(ctx, 'edit', 0)
			return
		}

		if (data === 'start_delete') {
			await renderMomentSelector(ctx, 'delete', 0)
			return
		}

		if (data === 'start_help') {
			await ctx.reply(
				[
					'<b>📖 可用命令</b>',
					'',
					'/publish — 发布新碎碎念',
					'/edit — 编辑碎碎念',
					'/delete — 删除碎碎念',
					'/cancel — 取消当前操作',
				].join('\n'),
				TELEGRAM_HTML_OPTIONS,
			)
			return
		}
	}

	if (
		CONVERSATION_CALLBACK_ACTIONS.has(data)
		|| data.startsWith('flow_publish_')
		|| data.startsWith('flow_edit_')
	) {
		await ctx.answerCallbackQuery()
		return
	}

	await ctx.answerCallbackQuery('未知操作。')
})

bot.on('message', async (ctx) => {
	if (ctx.message?.text) {
		return
	}

	await ctx.reply('暂不支持该消息类型，请使用命令操作。发送 /start 查看帮助。')
})
