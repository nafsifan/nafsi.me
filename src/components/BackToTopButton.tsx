'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const SCROLL_THRESHOLD = 320

export default function BackToTopButton() {
	const t = useTranslations('aria label')

	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		const handleScroll = () => {
			setIsVisible(window.scrollY > SCROLL_THRESHOLD)
		}

		handleScroll()

		window.addEventListener('scroll', handleScroll, { passive: true })

		return () => {
			window.removeEventListener('scroll', handleScroll)
		}
	}, [])

	const handleClick = () => {
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-label={t('backToTop')}
			className={cn(
				'fixed right-4 bottom-6 z-40 flex size-11 cursor-pointer items-center justify-center rounded-lg border border-(--border-subtle)',
				'bg-(--surface-card) text-(--text-secondary) shadow-(--shadow-soft) transition-all duration-300',
				'pointer-events-none translate-y-2 opacity-0 hover:bg-(--accent-soft) hover:text-(--accent-strong)',
				'focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary) focus-visible:outline-none',
				isVisible && 'pointer-events-auto translate-y-0 opacity-100',
			)}
		>
			<i className="i-mingcute-arrow-up-line text-xl" aria-hidden="true" />
		</button>
	)
}
