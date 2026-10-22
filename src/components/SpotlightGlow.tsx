'use client'

import { useEffect, useRef } from 'react'

export default function SpotlightGlow() {
	const spotRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		// 仅在支持高精度鼠标指针的设备上启用
		if (!window.matchMedia('(pointer: fine)').matches) {
			return
		}

		let frameId: number | null = null
		let targetX = -1000
		let targetY = -1000
		let currentX = -1000
		let currentY = -1000
		let isVisible = false

		const handlePointerMove = (e: PointerEvent) => {
			targetX = e.clientX
			targetY = e.clientY
			if (!isVisible && spotRef.current) {
				isVisible = true
				spotRef.current.style.opacity = '1'
			}
		}

		const handlePointerLeave = () => {
			if (spotRef.current) {
				isVisible = false
				spotRef.current.style.opacity = '0'
			}
		}

		// 使用阻尼插值让光晕移动更加柔和细腻
		const render = () => {
			currentX += (targetX - currentX) * 0.15
			currentY += (targetY - currentY) * 0.15

			if (spotRef.current) {
				spotRef.current.style.transform = `translate3d(${currentX - 300}px, ${currentY - 300}px, 0)`
			}
			frameId = requestAnimationFrame(render)
		}

		window.addEventListener('pointermove', handlePointerMove, { passive: true })
		document.documentElement.addEventListener('pointerleave', handlePointerLeave)
		frameId = requestAnimationFrame(render)

		return () => {
			window.removeEventListener('pointermove', handlePointerMove)
			document.documentElement.removeEventListener('pointerleave', handlePointerLeave)
			if (frameId) {
				cancelAnimationFrame(frameId)
			}
		}
	}, [])

	return (
		<div
			ref={spotRef}
			aria-hidden="true"
			className="spotlight-glow pointer-events-none fixed top-0 left-0 z-0 size-[600px] rounded-full opacity-0 transition-opacity duration-500 will-change-transform"
		/>
	)
}
