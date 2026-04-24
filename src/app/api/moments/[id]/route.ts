import type { ErrorResponse, MomentResponse } from '@/types/moment'
import process from 'node:process'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errorHandler'
import { updateMomentSchema } from '@/lib/moments.schema'
import { MomentService } from '@/lib/moments.service'

const ALLOWED_DOMAINS = ['nafsi.me', 'localhost:3000', '127.0.0.1']

/**
 * GET /api/moments/:id
 * Retrieves a single moment by ID
 *
 * Authentication: Domain whitelist only
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// Check domain whitelist using host header
		const host = request.headers.get('host')

		if (host && !ALLOWED_DOMAINS.includes(host)) {
			throw new Error('Forbidden')
		}

		const { id } = await params
		const moment = await MomentService.findById(id)

		if (!moment) {
			return NextResponse.json<ErrorResponse>(
				{ error: 'Moment not found' },
				{ status: 404 },
			)
		}

		return NextResponse.json<MomentResponse>({ data: moment })
	}
	catch (error) {
		return handleApiError(error, 'GET /api/moments/:id')
	}
}

/**
 * PUT /api/moments/:id
 * Updates an existing moment
 *
 * Authentication: Requires Authorization header
 * Format: Authorization: Bearer <MOMENTS_API_KEY>
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// Check Authorization header
		const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			throw new Error('Unauthorized')
		}

		const token = authHeader.substring(7)

		if (!token || token !== process.env.MOMENTS_API_KEY) {
			throw new Error('Unauthorized')
		}

		const { id } = await params
		const body = await request.json()
		const data = updateMomentSchema.parse(body)

		const moment = await MomentService.update(id, data)

		return NextResponse.json<MomentResponse>({ data: moment })
	}
	catch (error) {
		return handleApiError(error, 'PUT /api/moments/:id')
	}
}

/**
 * DELETE /api/moments/:id
 * Deletes a moment by ID
 *
 * Authentication: Requires Authorization header
 * Format: Authorization: Bearer <MOMENTS_API_KEY>
 */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// Check Authorization header
		const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			throw new Error('Unauthorized')
		}

		const token = authHeader.substring(7)

		if (!token || token !== process.env.MOMENTS_API_KEY) {
			throw new Error('Unauthorized')
		}

		const { id } = await params

		await MomentService.delete(id)

		return NextResponse.json({ message: 'Moment deleted successfully' })
	}
	catch (error) {
		return handleApiError(error, 'DELETE /api/moments/:id')
	}
}
