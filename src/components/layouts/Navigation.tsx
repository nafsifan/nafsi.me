import type { ComponentProps } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { cn } from '@/lib/utils'
interface NavigationProps {
	isOpenMenu: boolean
	onNavClick: () => void
}

function NavigationItem(props: ComponentProps<typeof Link> & { onClick?: () => void }) {
	return (
		<Link
			{...props}
			className={cn(
				'block cursor-pointer rounded-md px-2.5 py-1.5 font-semibold text-(--text-secondary)',
				'transition-colors duration-300',
				'hover:bg-(--accent-soft) hover:text-(--accent-strong)',
				'focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary) focus-visible:outline-none',
				'sm:ml-2 sm:py-2 sm:first:ml-0',
			)}
		>
			{props.children}
		</Link>
	)
}

export default function Navigation({ isOpenMenu, onNavClick }: NavigationProps) {
	const t = useTranslations('navigation')
	const aria = useTranslations('aria label')

	const navigationItems = [
		{ href: '/posts', label: t('posts') },
		{ href: '/moments', label: t('moments') },
		{ href: '/friends', label: t('friends') },
		{ href: '/', label: t('about') },
	]

	const handleNavContainerClick = (e: React.MouseEvent) => {
		e.stopPropagation()
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			onNavClick()
		}
	}

	return (
		<nav
			className={cn(
				'overflow-hidden transition-all duration-200 ease-in-out',
				'sm:flex sm:max-h-96 sm:items-center sm:p-0 sm:opacity-100',
				isOpenMenu ? 'max-h-96 pt-2' : 'max-h-0 pt-0',
			)}
			aria-label={aria('navMenu')}
		>
			<div
				className="flex-row items-center justify-center sm:flex"
				role="menubar"
				tabIndex={0}
				onClick={handleNavContainerClick}
				onKeyDown={handleKeyDown}
			>
				{navigationItems.map(item => (
					<NavigationItem
						key={item.href}
						href={item.href}
						onClick={onNavClick}
						role="menuitem"
						aria-label={aria('navItem', { label: item.label })}
					>
						{item.label}
					</NavigationItem>
				))}
			</div>
		</nav>
	)
}
