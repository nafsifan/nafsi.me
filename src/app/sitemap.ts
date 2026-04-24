import type { MetadataRoute } from 'next'
import { posts } from '#site/content'
import { siteConfig } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
	const staticRoutes: MetadataRoute.Sitemap = [
		{ url: `${siteConfig.url}/`, lastModified: new Date() },
		{ url: `${siteConfig.url}/posts`, lastModified: new Date() },
		{ url: `${siteConfig.url}/friends`, lastModified: new Date() },
		{ url: `${siteConfig.url}/moments`, lastModified: new Date() },
	]

	const postRoutes: MetadataRoute.Sitemap = posts
		.filter(post => !post.draft)
		.map(post => ({
			url: `${siteConfig.url}${post.permalink}`,
			lastModified: post.date,
		}))

	return [...staticRoutes, ...postRoutes]
}
