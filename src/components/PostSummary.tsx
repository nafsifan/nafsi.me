'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface PostSummaryProps {
	summary?: string
	locale?: 'zh-CN' | 'en'
	className?: string
}

export function PostSummary({
	summary,
	locale = 'zh-CN',
	className,
}: PostSummaryProps) {
	const contentRef = useRef<HTMLParagraphElement>(null)
	const [isOverflow, setIsOverflow] = useState(false)
	const [isExpanded, setIsExpanded] = useState(false)
	const [fullHeight, setFullHeight] = useState(0)
	const [threshold, setThreshold] = useState(105)

	useEffect(() => {
		const checkHeight = () => {
			if (!contentRef.current)
				return

			const isMobile = window.innerWidth < 640
			// 移动端约 3 行（76px），桌面端约 4~5 行（105px）
			const currentThreshold = isMobile ? 76 : 105
			const measuredHeight = contentRef.current.scrollHeight

			setThreshold(currentThreshold)
			setFullHeight(measuredHeight)
			// 超出阈值一定余量（12px）时才激活折叠，避免微小误差打扰
			setIsOverflow(measuredHeight > currentThreshold + 12)
		}

		checkHeight()
		window.addEventListener('resize', checkHeight)
		return () => window.removeEventListener('resize', checkHeight)
	}, [summary])

	if (!summary)
		return null

	const label = locale === 'en' ? 'AI Summary' : 'AI 摘要'
	const toggleText = isExpanded
		? (locale === 'en' ? 'Collapse' : '收起')
		: (locale === 'en' ? 'Read more' : '展开全文')

	return (
		<div
			className={cn(
				'group relative mt-4 overflow-hidden rounded-xl p-px transition-all duration-300',
				className,
			)}
		>
			{/*
			  克制内敛的单色系斜切面定光边框：
			  - 130° 斜切面：左上角主边凝聚澄净天体蓝（0.38），清晰对齐左边缘；
			  - 中间平缓沉入暗夜基调（--border-subtle）；
			  - 右侧以柔和微弱暗光（0.18）回弹支撑，不虚塌也不抢戏
			*/}
			<div
				className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(77,150,255,0.38)_0%,rgba(77,150,255,0.22)_25%,rgba(48,54,61,0.25)_55%,rgba(77,150,255,0.18)_82%,rgba(77,150,255,0.12)_100%)] transition-opacity duration-300 group-hover:opacity-100"
			/>

			{/* 卡片内层衬底：深邃纯净的磨砂质感 */}
			<div className="relative overflow-hidden rounded-[calc(var(--radius-xl)-1px)] bg-(--bg-primary)/95 px-4 py-3 backdrop-blur-md sm:px-4.5 sm:py-3.5">
				{/* 顶部单像素内敛切线 */}
				<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-(--accent-strong)/25 via-(--accent-soft)/10 to-transparent" />

				{/* 头部：纯粹凝聚的单色标识 */}
				<div className="relative mb-2 flex items-center justify-between font-semibold text-(--accent-strong)">
					<div className="flex items-center gap-1.5">
						<i className="i-mingcute-sparkles-fill text-sm sm:text-base" />
						<span className="text-xs tracking-wide sm:text-sm">
							{label}
						</span>
					</div>

					{/* 仅在超长时，右上角同步提供快速切换指示 */}
					{isOverflow && (
						<button
							type="button"
							onClick={() => setIsExpanded(!isExpanded)}
							className="flex cursor-pointer items-center gap-1 text-[11px] font-normal text-(--text-tertiary) transition-colors hover:text-(--accent-strong)"
							aria-expanded={isExpanded}
						>
							<span>{toggleText}</span>
							<i
								className={cn(
									'i-mingcute-down-line text-xs transition-transform duration-300',
									isExpanded ? 'rotate-180' : 'rotate-0',
								)}
								aria-hidden="true"
							/>
						</button>
					)}
				</div>

				{/*
				  正文自适应动画容器：
				  - 超长且未展开时：底部渐变羽化平滑截断，并伴随高度丝滑拉伸
				  - 不超长时：100% 完整展示，零多余遮挡
				*/}
				<div
					style={{
						maxHeight: isOverflow
							? (isExpanded ? `${fullHeight}px` : `${threshold}px`)
							: undefined,
					}}
					className={cn(
						'relative overflow-hidden transition-[max-height] duration-350 ease-out',
						isOverflow && !isExpanded && '[mask-image:linear-gradient(to_bottom,rgba(0,0,0,1)_55%,transparent_100%)]',
					)}
				>
					<p
						ref={contentRef}
						className="relative text-sm leading-relaxed text-(--text-secondary) selection:bg-(--accent-soft)"
					>
						{summary}
					</p>
				</div>
			</div>
		</div>
	)
}
