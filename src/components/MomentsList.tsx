'use client'

import type { Moment, MomentListResponse } from '@/types/moment'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import MomentCard from '@/components/MomentCard'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { cn } from '@/lib/utils'

type ErrorKey = 'unauthorized' | 'requestFailed' | 'unknown'

const LIMIT = 5

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
			<div className="mt-8 space-y-6">
				{moments.map(moment => (
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
							<i className="i-mingcute-loading-fill animate-spin text-lg text-(--accent)" />
							<span>{t('loading')}</span>
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
