import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import PageTitle from '@/components/layouts/pageTitle'
import MomentsList from '@/components/MomentsList'
import { siteConfig } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('moments.meta')

	return {
		title: t('title'),
		description: t('description'),
		alternates: {
			canonical: '/moments',
		},
		openGraph: {
			title: `${t('title')} - Nafsi`,
			description: t('description'),
			url: `${siteConfig.url}/moments`,
			type: 'website',
		},
		twitter: {
			title: `${t('title')} - Nafsi`,
			description: t('description'),
		},
	}
}

export default function Moments() {
	const t = useTranslations('moments')

	return (
		<>
			<PageTitle title={t('title')} />
			<MomentsList />
		</>
	)
}
