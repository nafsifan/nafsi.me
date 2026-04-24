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
		<div className="rounded-xl border border-(--border-subtle)/30 bg-linear-to-br from-(--surface-card) to-(--surface-muted)/50 p-4 shadow-md transition-all duration-300 hover:shadow-lg">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Image
						src="/avatar.jpeg"
						alt="Nafsi"
						width={24}
						height={24}
						className="rounded-full bg-(--surface-muted)"
					/>
					<h2 className="font-bold text-(--text-primary)">
						Nafsi
					</h2>
				</div>
				<time className="flex items-center text-sm text-(--text-tertiary)">
					{relativeTimeLabel}
				</time>
			</div>
			<div className="my-3 h-px w-full bg-(--border-subtle)/50" aria-hidden="true" />

			<div className="pb-4">
				<p className="overflow-hidden wrap-break-word whitespace-pre-wrap text-(--text-secondary)">
					{item.content}
				</p>

				{item.images && item.images.length > 0 && (
					<GalleryImage
						images={item.images}
						alt={t('image alt')}
					/>
				)}
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-3">
				{item.tags && item.tags.length > 0 && item.tags.map(tag => (
					<IconBadge
						key={item.id + tag}
						text={`#${tag}`}
						variant="tag"
					/>
				))}
			</div>
		</div>
	)
}
