'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface TocEntry {
	title: string
	url: string
	items: TocEntry[]
}

interface PostTocProps {
	toc: TocEntry[]
}

const extractId = (url: string) => url.replace('#', '')

export function PostToc({ toc }: PostTocProps) {
	const [activeId, setActiveId] = useState('')

	useEffect(() => {
		const flattenIds: string[] = []
		const collect = (entries: TocEntry[]) => {
			entries.forEach((item) => {
				flattenIds.push(extractId(item.url))
				if (item.items && item.items.length > 0) {
					collect(item.items)
				}
			})
		}
		collect(toc)

		if (flattenIds.length === 0) {
			return
		}

		const handleScroll = () => {
			if (window.scrollY < 120 && flattenIds.length > 0) {
				setActiveId(flattenIds[0])
			}
		}

		window.addEventListener('scroll', handleScroll, { passive: true })

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id)
					}
				})
			},
			{
				rootMargin: '0px 0px -70% 0px',
			},
		)

		const elements = flattenIds
			.map(id => document.getElementById(id))
			.filter(Boolean) as HTMLElement[]

		elements.forEach(el => observer.observe(el))

		return () => {
			window.removeEventListener('scroll', handleScroll)
			elements.forEach(el => observer.unobserve(el))
		}
	}, [toc])

	if (!toc || toc.length === 0) {
		return null
	}

	const renderItems = (items: TocEntry[], depth = 0) => {
		return items.map((item) => {
			const id = extractId(item.url)
			const isActive = activeId === id

			return (
				<li key={item.url} className="list-none">
					<a
						href={item.url}
						onClick={(e) => {
							e.preventDefault()
							const target = document.getElementById(id)
							if (target) {
								target.scrollIntoView({
									behavior: 'smooth',
									block: 'start',
								})
							}
						}}
						className={cn(
							'relative block truncate py-1 text-xs transition-colors duration-200',
							depth === 0 ? 'pl-3.5' : 'pl-6 text-[11.5px]',
							isActive
								? 'font-medium text-(--accent-strong)'
								: 'text-(--text-quaternary) hover:text-(--text-primary)',
						)}
					>
						{isActive && (
							<span
								className="absolute top-1 -left-[1px] h-4 w-0.5 rounded-full bg-(--accent-strong) shadow-xs transition-all duration-200"
								aria-hidden="true"
							/>
						)}
						{item.title}
					</a>

					{item.items && item.items.length > 0 && (
						<ul className="mt-0.5 space-y-0.5">
							{renderItems(item.items, depth + 1)}
						</ul>
					)}
				</li>
			)
		})
	}

	return (
		<aside className="absolute top-0 left-full ml-12 hidden h-full xl:block">
			<nav className="sticky top-24 max-h-[calc(100vh-8rem)] w-56 overflow-y-auto pr-2">
				<div className="relative border-l border-(--border-subtle)/35 py-1">
					<ul className="space-y-1">
						{renderItems(toc)}
					</ul>
				</div>
			</nav>
		</aside>
	)
}
