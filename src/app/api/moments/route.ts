import type { MomentListResponse, MomentResponse } from '@/types/moment'
import process from 'node:process'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errorHandler'
import { createMomentSchema, getMomentsQuerySchema } from '@/lib/moments.schema'
import { MomentService } from '@/lib/moments.service'

const ALLOWED_DOMAINS = ['nafsi.me', 'localhost:3000', '127.0.0.1']

/**
 * GET /api/moments
 * Retrieves paginated moments list with optional tag filtering
 *
 * Authentication: Domain whitelist only (nafsi.me, localhost)
 */
export async function GET(request: Request) {
	try {
		// Check domain whitelist using host header
		const host = request.headers.get('host')

		if (host && !ALLOWED_DOMAINS.includes(host)) {
			throw new Error('Forbidden')
		}

		const { searchParams } = new URL(request.url)

		const query = getMomentsQuerySchema.parse({
			limit: searchParams.get('limit') || undefined,
			offset: searchParams.get('offset') || undefined,
			tag: searchParams.get('tag') || undefined,
		})

		const result = await MomentService.findAll(query)

		return NextResponse.json<MomentListResponse>(result)
	}
	catch (error) {
		return handleApiError(error, 'GET /api/moments')
	}
}

/**
 * POST /api/moments
 * Creates a new moment
 *
 * Authentication: Requires Authorization header
 * Format: Authorization: Bearer <MOMENTS_API_KEY>
 */
export async function POST(request: Request) {
	try {
		// Check Authorization header
		const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			throw new Error('Unauthorized')
		}

		const token = authHeader.substring(7) // Remove "Bearer " prefix

		if (!token || token !== process.env.MOMENTS_API_KEY) {
			throw new Error('Unauthorized')
		}

		const body = await request.json()
		const data = createMomentSchema.parse(body)

		const moment = await MomentService.create(data)
		return NextResponse.json<MomentResponse>({ data: moment }, { status: 201 })
	}
	catch (error) {
		return handleApiError(error, 'POST /api/moments')
	}
}
