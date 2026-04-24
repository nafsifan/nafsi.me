import { useTranslations } from 'next-intl'
import Link from 'next/link'
import LanguageSwitch from '@/components/LanguageSwitch'
import ToggleThemeButton from '@/components/ToggleThemeButton'

export default function Footer() {
	const t = useTranslations('aria label')

	return (
		<footer className="mb-2 flex w-full items-center justify-center px-4 sm:px-0">
			<div className="flex max-w-xl flex-1 items-center justify-between gap-x-3">
				<p className="block font-bold text-(--text-primary)">
					© 2025 – Nafsi
				</p>
				<div className="flex items-center gap-x-0.5">
					<Link
						href="/feed"
						className="flex items-center justify-center rounded-md p-1 text-(--text-secondary) transition-colors duration-300 hover:bg-(--accent-soft)/40 hover:text-(--accent-strong) focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary) focus-visible:outline-none"
						aria-label={t('footerRss')}
						title={t('footerRss')}
						target="_blank"
					>
						<i className="i-mingcute-rss-2-fill text-lg" aria-hidden="true" />
					</Link>
					<LanguageSwitch />
					<ToggleThemeButton />
				</div>
			</div>
		</footer>
	)
}
