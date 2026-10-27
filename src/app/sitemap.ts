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

	// 按文章 slug 去重，避免多语言文件产生重复 URL
	const uniquePosts = Array.from(
		posts
			.filter(post => !post.draft)
			.reduce((map, post) => {
				const existing = map.get(post.permalink)
				if (!existing || new Date(post.date) > new Date(existing.date)) {
					map.set(post.permalink, post)
				}
				return map
			}, new Map<string, typeof posts[number]>())
			.values(),
	)

	const postRoutes: MetadataRoute.Sitemap = uniquePosts.map(post => ({
		url: `${siteConfig.url}${post.permalink}`,
		lastModified: post.date,
		changeFrequency: 'weekly',
		priority: 0.6,
	}))

	return [...staticRoutes, ...postRoutes]
}
