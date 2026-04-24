'use client'

import type { ImageMeta } from '@/types/moment'
import Image from 'next/image'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface GalleryImageProps {
	images: ImageMeta[]
	alt?: string
}

function GalleryImageItem({
	image,
	alt,
}: {
	image: ImageMeta
	alt: string
}) {
	const [isLoaded, setIsLoaded] = useState(false)

	return (
		<a
			href={image.url}
			data-pswp-width={image.width}
			data-pswp-height={image.height}
			data-pswp-cropped="true"
			target="_blank"
			rel="noreferrer"
			className={cn(
				'relative block size-64 shrink-0 cursor-zoom-in overflow-hidden rounded-lg shadow-sm',
				'bg-(--surface-card)',
			)}
		>
			{image.blurDataURL && !isLoaded && (
				<div
					className="absolute inset-0 opacity-100 dark:opacity-70 dark:hover:opacity-100"
					style={{
						backgroundImage: `url(${image.blurDataURL})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
					}}
				/>
			)}

			<Image
				src={image.url}
				alt={alt}
				width={image.width}
				height={image.height}
				loading="lazy"
				className={cn(
					'relative size-64 object-cover transition-[transform,opacity,filter] duration-300 ease-[cubic-bezier(0.2,0,0.2,1),ease-in-out,ease-in-out] dark:hover:opacity-100',
					isLoaded ? 'blur-0 opacity-100 dark:opacity-80' : 'opacity-0 blur-lg',
				)}
				onLoad={() => {
					requestAnimationFrame(() => setIsLoaded(true))
				}}
			/>
		</a>
	)
}

export function GalleryImage({
	images,
	alt = '',
}: GalleryImageProps) {
	const galleryRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!galleryRef.current || !images?.length) return

		const lightbox = new PhotoSwipeLightbox({
			gallery: galleryRef.current,
			children: 'a[data-pswp-cropped]',
			padding: { top: 48, bottom: 48, left: 24, right: 24 },
			pswpModule: () => import('photoswipe'),
		})

		lightbox.init()

		return () => {
			lightbox.destroy()
		}
	}, [images])

	if (!images || images.length === 0) return null

	return (
		<div className="mt-3 overflow-x-auto">
			<div ref={galleryRef} className="flex gap-2">
				{images.map(image => (
					<GalleryImageItem
						key={image.url}
						image={image}
						alt={alt}
					/>
				))}
			</div>
		</div>
	)
}
