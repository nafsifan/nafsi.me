import { useEffect } from 'react'

/**
 * Hook to enable copy-to-clipboard functionality for code blocks
 * Automatically handles copy button clicks within .markdown context
 */
export function useCodeCopy() {
	useEffect(() => {
		if (typeof window === 'undefined') return

		const handleClick = async (event: MouseEvent) => {
			const target = event.target as HTMLElement
			const button = target.closest('.copy') as HTMLButtonElement | null
			if (!button) return

			// Only handle buttons within .markdown context
			if (!button.closest('.markdown')) return

			const codeBlock = button.previousElementSibling
			const text = codeBlock?.textContent ?? ''
			if (!text) return

			try {
				await navigator.clipboard.writeText(text)
				button.classList.add('copied')
				button.title = 'Copied!'
				setTimeout(() => {
					button.classList.remove('copied')
					button.title = 'Copy to clipboard'
				}, 3000)
			}
			catch (error) {
				console.error('Copy failed', error)
			}
		}

		document.addEventListener('click', handleClick)
		return () => {
			document.removeEventListener('click', handleClick)
		}
	}, [])
}
