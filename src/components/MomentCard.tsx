'use client'

import type { Moment } from '@/types/moment'
import { useFormatter, useTranslations } from 'next-intl'
import Image from 'next/image'
import { useMemo } from 'react'
import { GalleryImage } from '@/components/GalleryImage'
import IconBadge from '@/components/ui/IconBadge'

interface MomentCardProps {
	item: Moment
}

export default function MomentCard({ item }: MomentCardProps) {
	const t = useTranslations('moments.list')
	const formatter = useFormatter()
	const relativeTimeLabel = useMemo(() => {
		return formatter.relativeTime(new Date(item.createdAt), new Date())
	}, [formatter, item.createdAt])

	return (
		<div className="matte-card rounded-2xl p-4.5 sm:p-5">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<Image
						src="/avatar.jpeg"
						alt="Nafsi"
						width={24}
						height={24}
						className="size-6 rounded-full border border-(--border-subtle)/35 shadow-2xs"
					/>
					<h2 className="text-xs font-semibold text-(--text-primary)">
						Nafsi
					</h2>
				</div>
				<time className="flex items-center font-mono text-[11px] text-(--text-quaternary)">
					{relativeTimeLabel}
				</time>
			</div>

			<div className="mt-3">
				<p className="overflow-hidden text-[14px] leading-relaxed wrap-break-word whitespace-pre-wrap text-(--text-primary)/90">
					{item.content}
				</p>

				{item.images && item.images.length > 0 && (
					<div className="mt-3">
						<GalleryImage
							images={item.images}
							alt={t('image alt')}
						/>
					</div>
				)}
			</div>

			{item.tags && item.tags.length > 0 && (
				<div className="mt-3 flex flex-wrap items-center gap-2">
					{item.tags.map(tag => (
						<IconBadge
							key={item.id + tag}
							text={`#${tag}`}
							variant="tag"
						/>
					))}
				</div>
			)}
		</div>
	)
}
