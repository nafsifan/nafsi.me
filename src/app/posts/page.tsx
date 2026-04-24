import type { Metadata } from 'next'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import React from 'react'
import { posts } from '#site/content'
import PageTitle from '@/components/layouts/pageTitle'
import { siteConfig } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('posts.meta')

	return {
		title: t('title'),
		description: t('description'),
		alternates: {
			canonical: '/posts',
		},
		openGraph: {
			title: `${t('title')} - Nafsi`,
			description: t('description'),
			url: `${siteConfig.url}/posts`,
		},
		twitter: {
			title: `${t('title')} - Nafsi`,
			description: t('description'),
		},
	}
}

export default function Posts() {
	const t = useTranslations('posts')

	const sortedPosts = posts.sort((a, b) =>
		new Date(b.date).getTime() - new Date(a.date).getTime(),
	)

	const groupedPosts = sortedPosts.reduce((groups, post) => {
		const year = new Date(post.date).getFullYear().toString()
		if (!groups[year]) {
			groups[year] = []
		}
		groups[year].push(post)
		return groups
	}, {} as Record<string, typeof posts>)

	const years = Object.keys(groupedPosts).sort((a, b) => Number.parseInt(b) - Number.parseInt(a))

	return (
		<>
			<PageTitle title={t('title')} />

			{years.map(year => (
				<div key={year}>
					<div className="pointer-events-none relative h-16 select-none">
						<span
							className="absolute top-0 left-0 text-9xl leading-none font-black text-(--accent) italic opacity-[0.06] select-none"
						>
							{year}
						</span>
					</div>

					<div className="relative -mt-4 space-y-4">
						{groupedPosts[year].map(post => (
							<div key={post.slug} className="flex items-baseline justify-between text-base text-(--text-secondary)">
								<Link
									href={`/posts/${post.slug}`}
									className="cursor-pointer font-semibold text-(--text-primary) transition-colors duration-300 hover:text-(--accent-strong)"
								>
									{post.title}
								</Link>
								<time className="ml-4 shrink-0 text-(--text-tertiary)">
									{ dayjs(String(post.date)).format('YYYY/MM/DD') }
								</time>
							</div>
						))}
					</div>
				</div>
			))}

		</>
	)
}
