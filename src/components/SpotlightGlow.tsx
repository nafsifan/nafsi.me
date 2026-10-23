'use client'

import { motion, useMotionValue, useSpring } from 'motion/react'
import { useEffect, useState } from 'react'

const SPRING_CONFIG = {
	damping: 28,
	stiffness: 180,
	mass: 0.6,
}

export default function SpotlightGlow() {
	const [isSupported, setIsSupported] = useState(false)

	const mouseX = useMotionValue(-1000)
	const mouseY = useMotionValue(-1000)

	// 使用真实的物理弹簧阻尼，具备真实的物理质量与惯性缓冲
	const springX = useSpring(mouseX, SPRING_CONFIG)
	const springY = useSpring(mouseY, SPRING_CONFIG)

	// 控制进出场与离开窗口时的自然渐隐渐现
	const opacity = useMotionValue(0)
	const springOpacity = useSpring(opacity, { damping: 20, stiffness: 200 })

	useEffect(() => {
		// 仅在支持高精度鼠标指针的 PC 设备上激活
		if (!window.matchMedia('(pointer: fine)').matches) {
			return
		}
		setIsSupported(true)

		const handlePointerMove = (e: PointerEvent) => {
			mouseX.set(e.clientX - 325)
			mouseY.set(e.clientY - 325)
			opacity.set(1)
		}

		const handlePointerLeave = () => {
			opacity.set(0)
		}

		window.addEventListener('pointermove', handlePointerMove, { passive: true })
		document.documentElement.addEventListener('pointerleave', handlePointerLeave)

		return () => {
			window.removeEventListener('pointermove', handlePointerMove)
			document.documentElement.removeEventListener('pointerleave', handlePointerLeave)
		}
	}, [mouseX, mouseY, opacity])

	if (!isSupported) {
		return null
	}

	return (
		<motion.div
			aria-hidden="true"
			className="spotlight-glow pointer-events-none fixed top-0 left-0 z-0 size-[650px] rounded-full"
			style={{
				x: springX,
				y: springY,
				opacity: springOpacity,
			}}
		/>
	)
}
