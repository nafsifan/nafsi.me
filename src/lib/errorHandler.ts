import type { ErrorResponse } from '@/types/moment'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@/generated/prisma'

/**
 * Centralized API error handler
 * Converts various error types to standardized HTTP responses
 */
export function handleApiError(error: unknown, context: string): NextResponse<ErrorResponse> {
	console.error(`[${context}] Error:`, error)

	// Authentication errors
	if (error instanceof Error) {
		if (error.message === 'Unauthorized') {
			return NextResponse.json<ErrorResponse>(
				{ error: 'Unauthorized', message: 'Valid API key required' },
				{ status: 401 },
			)
		}

		if (error.message === 'Forbidden') {
			return NextResponse.json<ErrorResponse>(
				{ error: 'Forbidden', message: 'Access denied' },
				{ status: 403 },
			)
		}
	}

	// Validation errors
	if (error instanceof ZodError) {
		return NextResponse.json<ErrorResponse>(
			{
				error: 'Validation failed',
				message: error.issues[0]?.message,
				details: error.issues,
			},
			{ status: 400 },
		)
	}

	// Prisma errors
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		// Record not found
		if (error.code === 'P2025') {
			return NextResponse.json<ErrorResponse>(
				{ error: 'Resource not found' },
				{ status: 404 },
			)
		}

		// Unique constraint violation
		if (error.code === 'P2002') {
			return NextResponse.json<ErrorResponse>(
				{ error: 'Resource already exists' },
				{ status: 409 },
			)
		}
	}

	// Default server error
	return NextResponse.json<ErrorResponse>(
		{ error: 'Internal server error' },
		{ status: 500 },
	)
}
