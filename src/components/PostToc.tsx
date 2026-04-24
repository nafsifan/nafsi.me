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

const collectAllIds = (items: TocEntry[]): string[] => {
	const ids: string[] = []
	const collect = (entries: TocEntry[]) => {
		entries.forEach((item) => {
			ids.push(extractId(item.url))
			if (item.items.length > 0) {
				collect(item.items)
			}
		})
	}
	collect(items)
	return ids
}

export function PostToc({ toc }: PostTocProps) {
	const [activeId, setActiveId] = useState<string>('')

	useEffect(() => {
		const allIds = collectAllIds(toc)

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id)
					}
				})
			},
			{
				rootMargin: '0% 0% -80% 0%',
			},
		)

		const headings = allIds
			.map(id => document.getElementById(id))
			.filter(Boolean) as HTMLElement[]

		headings.forEach(heading => observer.observe(heading))

		return () => {
			headings.forEach(heading => observer.unobserve(heading))
		}
	}, [toc])

	if (!toc || toc.length === 0) {
		return null
	}

	const renderTocItems = (items: TocEntry[], parentNum = '') => {
		return items.map((item, index) => {
			const id = extractId(item.url)
			const isActive = activeId === id
			const currentNum = parentNum ? `${parentNum}.${index + 1}` : `${index + 1}`

			return (
				<li key={item.url} className="list-none">
					<a
						href={item.url}
						className={cn(
							'block truncate py-1 transition-colors duration-200',
							isActive
								? 'font-medium text-(--accent)'
								: 'text-(--text-tertiary) hover:text-(--text-primary)',
						)}
						onClick={(e) => {
							e.preventDefault()
							document.getElementById(id)?.scrollIntoView({
								behavior: 'smooth',
								block: 'start',
							})
						}}
					>
						<span className="mr-1.5 text-(--text-tertiary)">
							{currentNum}
							.
						</span>
						{item.title}
					</a>
					{item.items.length > 0 && (
						<ol className="mt-1 space-y-1 border-l border-(--border-subtle)/70 pl-3">
							{renderTocItems(item.items, currentNum)}
						</ol>
					)}
				</li>
			)
		})
	}

	return (
		<aside className="absolute top-0 left-full ml-12 hidden h-full xl:block">
			<nav className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto">
				<ol className="w-64 space-y-1 text-sm">
					{renderTocItems(toc)}
				</ol>
			</nav>
		</aside>
	)
}
