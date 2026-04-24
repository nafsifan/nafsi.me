import type { Zoom } from 'medium-zoom'
import mediumZoom from 'medium-zoom'
import { useEffect, useRef } from 'react'

export function useImageZoom<T extends HTMLImageElement>({
	enabled = true,
}: { enabled?: boolean } = {}) {
	const imageRef = useRef<T>(null)
	const zoomRef = useRef<Zoom | null>(null)

	useEffect(() => {
		if (!imageRef.current || !enabled) return

		zoomRef.current = mediumZoom(imageRef.current, {
			margin: 24,
		})

		return () => {
			zoomRef.current?.detach()
			zoomRef.current = null
		}
	}, [enabled])

	return imageRef
}
