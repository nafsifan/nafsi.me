import type { NextConfig } from 'next'
import process from 'node:process'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
	reactCompiler: true,
	async rewrites() {
		return [
			{
				source: '/rss',
				destination: '/feed',
			},
			{
				source: '/rss.xml',
				destination: '/feed',
			},
			{
				source: '/feed.xml',
				destination: '/feed',
			},
		]
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 's2.loli.net',
			},
			{
				protocol: 'https',
				hostname: 'imgs.nafsi.me',
			},
		],
		// Only allow local IP access in development to prevent SSRF attacks in production
		dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
	},
}

const withNextIntl = createNextIntlPlugin()

export default withNextIntl(nextConfig)
