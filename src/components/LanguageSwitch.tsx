'use client'

import type { Locale } from '@/i18n/config'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { localeCookieName, localeOptions } from '@/i18n/config'
import { cn } from '@/lib/utils'

export default function LanguageSwitch() {
	const t = useTranslations('aria label')
	const [isOpen, setIsOpen] = useState(false)
	const locale = useLocale()
	const router = useRouter()
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!isOpen) {
			return
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleKeyDown)

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen])

	const toggleMenu = () => {
		setIsOpen(prev => !prev)
	}

	const selectLocale = (nextLocale: Locale) => {
		if (nextLocale === locale) {
			setIsOpen(false)
			return
		}

		document.cookie = `${localeCookieName}=${nextLocale}; path=/`
		setIsOpen(false)
		router.refresh()
	}

	const currentLabel = localeOptions.find(option => option.value === locale)?.label ?? locale
	const buttonLabel = t('languageSwitchButton', { current: currentLabel })

	return (
		<div className="relative" ref={menuRef}>
			<button
				type="button"
				onClick={toggleMenu}
				className={cn(
					'flex cursor-pointer items-center justify-center rounded-md p-1 text-(--text-secondary)',
					'transition-colors duration-300',
					'hover:bg-(--accent-soft)/30 hover:text-(--accent-strong)',
					'focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary) focus-visible:outline-none',
				)}
				aria-haspopup="true"
				aria-expanded={isOpen}
				aria-label={buttonLabel}
				title={buttonLabel}
			>
				<i className="i-mingcute-translate-2-fill text-lg" aria-hidden="true" />
			</button>

			{isOpen && (
				<div
					className={cn(
						'absolute right-0 bottom-full z-50 mb-2 min-w-28 overflow-hidden rounded-md border border-(--border-subtle)',
						'bg-(--surface-overlay) shadow-lg backdrop-blur-md',
					)}
					role="menu"
				>
					{localeOptions.map((option) => {
						const isActive = option.value === locale

						return (
							<button
								key={option.value}
								type="button"
								onClick={() => selectLocale(option.value)}
								className={cn(
									'flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs font-semibold transition-colors duration-200',
									isActive
										? 'bg-(--accent-soft) text-(--accent-strong)'
										: 'text-(--text-secondary) hover:bg-(--accent-soft)/60 hover:text-(--accent-strong)',
								)}
								role="menuitem"
							>
								<span>{option.label}</span>
								{isActive && <i className="i-mingcute-check-line text-base" aria-hidden="true" />}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}
