'use client'

import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export default function ToggleThemeButton() {
	const t = useTranslations('aria label')
	const { theme, setTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	const toggleTheme = () => {
		setTheme(theme === 'dark' ? 'light' : 'dark')
	}

	return (
		<button
			onClick={toggleTheme}
			className="flex cursor-pointer items-center justify-center rounded-md bg-transparent p-1 text-(--text-secondary) transition-colors duration-300 hover:bg-(--accent-soft)/30 hover:text-(--accent-strong) focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary) focus-visible:outline-none"
			aria-label={t('themeToggle')}
		>
			{mounted
				&& (
					<i
						className={cn('text-lg', theme === 'light'
							? 'i-mingcute-sun-line text-yellow-500'
							: 'i-mingcute-moon-stars-fill text-(--accent-strong)')}
						aria-hidden
					/>
				)}
		</button>
	)
}
