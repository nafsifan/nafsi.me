'use client'

import type { ComponentProps } from 'react'
import Image from 'next/image'
import { useState } from 'react'
import { useImageZoom } from '@/hooks/useImageZoom'
import { cn } from '@/lib/utils'

interface MDXImageProps extends Omit<ComponentProps<typeof Image>, 'src' | 'alt' | 'placeholder'> {
	src?: string
	alt?: string
	blurDataURL?: string
	width?: number
	height?: number
	wrapperClassName?: string
}

export function MDXImage({
	src,
	alt = '',
	className = '',
	width,
	height,
	blurDataURL,
	wrapperClassName,
	...rest
}: MDXImageProps) {
	const [isLoaded, setIsLoaded] = useState(false)
	const imageRef = useImageZoom<HTMLImageElement>()

	if (!src || !width || !height) return null

	return (
		<div
			className={cn(
				'relative mx-auto my-6 block transform-gpu cursor-zoom-in overflow-hidden rounded-lg shadow-sm',
				wrapperClassName,
			)}
		>
			{blurDataURL && !isLoaded && (
				<div
					className="absolute inset-0 opacity-100 dark:opacity-70 dark:hover:opacity-100"
					style={{
						backgroundImage: `url(${blurDataURL})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
					}}
				/>
			)}

			<Image
				ref={imageRef}
				src={src}
				alt={alt}
				width={width}
				height={height}
				loading="lazy"
				className={cn(
					'relative size-full rounded-lg object-cover transition-[transform,opacity,filter] duration-300 ease-[cubic-bezier(0.2,0,0.2,1),ease-in-out,ease-in-out] dark:hover:opacity-100',
					'[&.medium-zoom-image--opened]:blur-0 [&.medium-zoom-image--opened]:opacity-100',
					isLoaded ? 'blur-0 opacity-100 dark:opacity-70' : 'opacity-0 blur-lg',
					className,
				)}
				onLoad={() => {
					requestAnimationFrame(() => {
						setIsLoaded(true)
					})
				}}
				{...rest}
			/>
		</div>
	)
}
