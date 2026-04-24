'use client'

import type { ComponentType } from 'react'
import { Fragment, useMemo } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { MDXImage } from '@/components/MDXImage'
import { useCodeCopy } from '@/hooks/useCodeCopy'

interface MDXContentProps {
	code: string
	components?: Record<string, ComponentType<any>>
	className?: string
}

function useMDXComponent(code: string) {
	return useMemo(() => {
		// eslint-disable-next-line no-new-func
		const mdxFactory = new Function(code)
		const { default: MDXComponent } = mdxFactory({ Fragment, jsx, jsxs })
		return MDXComponent
	}, [code])
}

const defaultComponents: Record<string, ComponentType<any>> = {
	img: MDXImage,
}

export function MDXContent({ code, components, className }: MDXContentProps) {
	useCodeCopy()

	const Component = useMDXComponent(code)

	return (
		<div className={className}>
			<Component components={{ ...defaultComponents, ...components }} />
		</div>
	)
}
