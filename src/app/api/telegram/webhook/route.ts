import process from 'node:process'
import { webhookCallback } from 'grammy'
import { bot } from '@/telegram/bot'

const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET_KEY

if (!webhookSecret) {
	throw new Error('TELEGRAM_WEBHOOK_SECRET_KEY is required for webhook security')
}

const handleUpdate = webhookCallback(bot, 'std/http', { secretToken: webhookSecret })

export async function POST(request: Request) {
	try {
		return await handleUpdate(request)
	}
	catch (error) {
		console.error('[Webhook] Error processing update:', error)
		return new Response('OK', { status: 200 })
	}
}

export async function GET() {
	return Response.json({
		status: 'ok',
		bot: 'moments-manager',
		timestamp: new Date().toISOString(),
	})
}
