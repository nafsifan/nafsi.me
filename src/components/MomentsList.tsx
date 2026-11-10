'use client'

import type { Moment, MomentListResponse } from '@/types/moment'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import MomentCard from '@/components/MomentCard'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { cn } from '@/lib/utils'

type ErrorKey = 'unauthorized' | 'requestFailed' | 'unknown'

const LIMIT = 5

function MomentCardSkeleton() {
	return (
		<div className="matte-card rounded-2xl p-4.5 sm:p-5" aria-hidden="true">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<div className="size-6 rounded-full bg-(--surface-muted) motion-safe:animate-pulse" />
					<div className="h-3 w-10 rounded-full bg-(--surface-muted) motion-safe:animate-pulse" />
				</div>
				<div className="h-3 w-10 rounded-full bg-(--surface-muted) motion-safe:animate-pulse" />
			</div>
			<div className="mt-3">
				<div className="h-5 w-3/4 rounded-full bg-(--surface-muted) motion-safe:animate-pulse" />
			</div>
			<div className="mt-3 flex gap-2">
				<div className="h-5 w-16 rounded-full bg-(--surface-muted) motion-safe:animate-pulse" />
			</div>
		</div>
	)
}

export default function MomentsList() {
	const t = useTranslations('moments.list')

	const fetchMoments = useCallback(
		async (offset: number, limit: number): Promise<MomentListResponse> => {
			const response = await fetch(`/api/moments?limit=${limit}&offset=${offset}`)

			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					throw new Error('unauthorized')
				}
				throw new Error('request-failed')
			}

			return response.json()
		}, [])

	const {
		items: moments,
		isLoading,
		error,
		hasMore,
		loadMoreRef,
		retry,
	} = useInfiniteScroll<Moment>({
		fetchFn: fetchMoments,
		limit: LIMIT,
		maxRetry: 3,
		rootMargin: '100px',
	})

	const isInitialLoading = moments.length === 0 && hasMore && !error

	const getErrorKey = (error: Error | null): ErrorKey => {
		if (!error)
			return 'unknown'

		if (error.message === 'unauthorized')
			return 'unauthorized'
		if (error.message === 'request-failed')
			return 'requestFailed'

		return 'unknown'
	}

	return (
		<>
			<div className="mt-8 space-y-6" aria-busy={isInitialLoading}>
				{isInitialLoading
					? Array.from({ length: LIMIT }, (_, index) => <MomentCardSkeleton key={index} />)
					: moments.map(moment => (
							<MomentCard key={moment.id} item={moment} />
						))}
			</div>

			{error && (
				<div
					className="mt-4 flex flex-row items-center justify-center gap-x-1 text-sm text-(--text-secondary)"
					role="alert"
				>
					<span>{t(`errors.${getErrorKey(error)}`)}</span>
					{hasMore && (
						<button
							type="button"
							className="cursor-pointer text-sm text-(--accent) no-underline transition-colors duration-200 hover:text-(--accent-strong)"
							onClick={retry}
							disabled={isLoading}
						>
							{t('retry')}
						</button>
					)}
				</div>
			)}

			{hasMore && (
				<div
					ref={loadMoreRef}
					className={cn(
						'mt-6 flex items-center justify-center gap-1 text-sm',
						'text-(--text-tertiary)',
						error ? 'hidden' : undefined,
					)}
					aria-live="polite"
				>
					{isLoading && (
						<>
							<i className={cn('i-mingcute-loading-fill animate-spin text-lg text-(--accent)', moments.length === 0 && 'sr-only')} aria-hidden="true" />
							<span className={moments.length === 0 ? 'sr-only' : undefined}>{t('loading')}</span>
						</>
					)}
				</div>
			)}

			{!hasMore && moments.length > 0 && !error && (
				<div className="mt-2 flex items-center justify-center text-(--text-tertiary)">
					—
				</div>
			)}
		</>
	)
}
