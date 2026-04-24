'use client'

import { ProgressProvider } from '@bprogress/next/app'
import { ThemeProvider } from 'next-themes'
import '@/styles/globals.css'

const Providers = ({ children }: { children: React.ReactNode }) => {
	return (
		<ThemeProvider
			enableSystem={false}
			defaultTheme="dark"
			disableTransitionOnChange
		>
			<ProgressProvider
				options={{ showSpinner: false }}
				disableStyle
				shallowRouting
			>
				{children}
			</ProgressProvider>
		</ThemeProvider>
	)
}

export default Providers
