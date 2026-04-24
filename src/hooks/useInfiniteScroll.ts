'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface InfiniteScrollResponse<T> {
	data: T[]
	total: number
}

export interface UseInfiniteScrollOptions<T> {
	fetchFn: (offset: number, limit: number) => Promise<InfiniteScrollResponse<T>>
	limit?: number
	maxRetry?: number
	rootMargin?: string
	onError?: (error: Error) => void
}

export interface UseInfiniteScrollReturn<T> {
	items: T[]
	isLoading: boolean
	error: Error | null
	hasMore: boolean
	loadMoreRef: React.RefObject<HTMLDivElement | null>
	retry: () => void
	retryCount: number
}

/**
 * Infinite scroll hook with automatic loading and retry support
 *
 * @example
 * ```tsx
 * const { items, isLoading, loadMoreRef } = useInfiniteScroll({
 *   fetchFn: async (offset, limit) => {
 *     const res = await fetch(`/api/data?offset=${offset}&limit=${limit}`)
 *     return res.json()
 *   },
 * })
 * ```
 */
export function useInfiniteScroll<T>({
	fetchFn,
	limit = 10,
	maxRetry = 3,
	rootMargin = '100px',
	onError,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
	const [items, setItems] = useState<T[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const [hasMore, setHasMore] = useState(true)
	const [retryCount, setRetryCount] = useState(0)

	// Store latest state in ref to avoid loadMore recreation
	const stateRef = useRef({
		offset: 0,
		isLoading: false,
		hasMore: true,
		error: null as Error | null,
		retryCount: 0,
	})
	const loadingRef = useRef(false)

	useEffect(() => {
		stateRef.current.isLoading = isLoading
		stateRef.current.hasMore = hasMore
		stateRef.current.error = error
		stateRef.current.retryCount = retryCount
	}, [isLoading, hasMore, error, retryCount])

	const observerRef = useRef<IntersectionObserver | null>(null)
	const loadMoreRef = useRef<HTMLDivElement>(null)
	const initializedRef = useRef(false)

	const loadMore = useCallback(
		async (options?: { isRetry?: boolean }) => {
			const isRetry = options?.isRetry ?? false
			const state = stateRef.current

			if (loadingRef.current || state.isLoading || !state.hasMore)
				return

			if (state.error && !isRetry)
				return

			if (state.retryCount >= maxRetry && !isRetry)
				return

			if (isRetry)
				setError(null)

			loadingRef.current = true
			stateRef.current.isLoading = true
			setIsLoading(true)

			try {
				const currentOffset = state.offset
				const data = await fetchFn(currentOffset, limit)

				setItems(prev => [...prev, ...data.data])

				const newOffset = currentOffset + data.data.length
				stateRef.current.offset = newOffset
				setRetryCount(0)
				setError(null)

				// Calculate total items loaded
				const totalItems = newOffset
				const reachedEnd = data.data.length === 0 || totalItems >= data.total

				if (reachedEnd) {
					setHasMore(false)
					observerRef.current?.disconnect()
					observerRef.current = null
				}
			}
			catch (err) {
				const error = err instanceof Error ? err : new Error('Unknown error')
				console.error('Failed to load more items:', error)

				setRetryCount(prev => Math.min(prev + 1, maxRetry))
				setError(error)

				onError?.(error)
			}
			finally {
				loadingRef.current = false
				stateRef.current.isLoading = false
				setIsLoading(false)
			}
		},
		[fetchFn, limit, maxRetry, onError],
	)

	useEffect(() => {
		if (initializedRef.current)
			return

		initializedRef.current = true
		loadMore()
	}, [loadMore])

	useEffect(() => {
		const target = loadMoreRef.current

		if (!hasMore || error || !target) {
			observerRef.current?.disconnect()
			observerRef.current = null
			return
		}

		const observer = new IntersectionObserver(
			(entries) => {
				// Prevent duplicate triggers
				if (
					entries[0].isIntersecting
					&& !stateRef.current.isLoading
					&& stateRef.current.hasMore
					&& !stateRef.current.error
				) {
					loadMore()
				}
			},
			{ rootMargin },
		)

		observerRef.current?.disconnect()
		observerRef.current = observer
		observer.observe(target)

		return () => {
			observer.disconnect()
		}
	}, [hasMore, error, loadMore, rootMargin])

	const retry = useCallback(() => {
		loadMore({ isRetry: true })
	}, [loadMore])

	return {
		items,
		isLoading,
		error,
		hasMore,
		loadMoreRef,
		retry,
		retryCount,
	}
}
