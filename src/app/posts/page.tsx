import type { Metadata } from 'next'
import dayjs from 'dayjs'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { posts } from '#site/content'
import PageTitle from '@/components/layouts/pageTitle'
import { getUserLocale } from '@/i18n/request'
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

export default async function Posts() {
	const t = await getTranslations('posts')
	const locale = await getUserLocale()

	const uniquePostsMap = new Map<string, typeof posts[number]>()
	for (const post of posts) {
		const existing = uniquePostsMap.get(post.slug)
		if (!existing) {
			uniquePostsMap.set(post.slug, post)
		}
		else if (post.locale === locale) {
			uniquePostsMap.set(post.slug, post)
		}
	}

	const sortedPosts = Array.from(uniquePostsMap.values()).sort((a, b) =>
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
		<div className="animate-fade-in-up">
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
							<div key={post.slug} className="interactive-row group flex items-baseline justify-between py-1 text-base text-(--text-secondary)">
								<Link
									href={`/posts/${post.slug}`}
									className="cursor-pointer font-semibold text-(--text-primary) transition-colors duration-200 group-hover:text-(--accent-strong)"
								>
									{post.title}
								</Link>
								<time className="ml-4 shrink-0 font-mono text-xs text-(--text-quaternary) tabular-nums">
									{ dayjs(String(post.date)).format('YYYY/MM/DD') }
								</time>
							</div>
						))}
					</div>
				</div>
			))}

		</div>
	)
}
