import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { friends } from '#site/content'
import PageTitle from '@/components/layouts/pageTitle'
import { siteConfig } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('friends.meta')

	return {
		title: t('title'),
		description: t('description'),
		alternates: {
			canonical: '/friends',
		},
		openGraph: {
			title: `${t('title')} - Nafsi`,
			description: t('description'),
			url: `${siteConfig.url}/friends`,
			type: 'website',
		},
		twitter: {
			title: `${t('title')} - Nafsi`,
			description: t('description'),
		},
	}
}

export default function Friends() {
	const t = useTranslations('friends')

	const friendsData = friends[0]

	return (
		<>
			<PageTitle title={t('title')} />

			<div className="mt-8 mb-6 grid-flow-row grid-cols-2 gap-x-7 gap-y-5 sm:grid">
				{friendsData.links.map(link => (
					<a
						key={link.title}
						className="group mt-4 flex items-center gap-4 rounded-xl border border-(--border-subtle)/30 bg-linear-to-br from-(--surface-card) to-(--surface-muted)/50 px-4 py-3 shadow-md transition-all duration-300 will-change-transform hover:-translate-y-1 hover:from-(--surface-card) hover:to-(--surface-card) hover:shadow-xl focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary) focus-visible:outline-none sm:mt-0"
						href={link.website || '#'}
						target={link.website ? '_blank' : undefined}
						rel={link.website ? 'noopener noreferrer' : undefined}
					>
						<div>
							<Image
								className="rounded-lg bg-(--surface-muted)"
								src={link.image}
								alt={link.title}
								width={56}
								height={56}
								loading="lazy"
							/>
						</div>
						<div className="flex flex-1 flex-col gap-0.5">
							<h2 className="font-semibold text-(--text-primary) transition-colors duration-300 group-hover:text-(--accent)">
								{link.title}
							</h2>
							<p className="line-clamp-1 text-xs text-(--text-secondary) sm:text-sm">
								{link.description}
							</p>
						</div>
					</a>
				))}
			</div>
		</>
	)
}
