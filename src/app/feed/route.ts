import RSS from 'rss'
import { posts } from '#site/content'
import { siteConfig } from '@/lib/site'

export const runtime = 'nodejs'

const FEED_URL = `${siteConfig.url}/feed`
const FEED_DESCRIPTION = 'Keep Running...'

export const GET = () => {
	const uniquePosts = Array.from(
		posts
			.filter(post => !post.draft)
			.reduce((map, post) => {
				const existing = map.get(post.slug)
				if (!existing || post.locale === 'zh-CN') {
					map.set(post.slug, post)
				}
				return map
			}, new Map<string, typeof posts[number]>())
			.values(),
	).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

	const feed = new RSS({
		title: siteConfig.title,
		description: FEED_DESCRIPTION,
		site_url: siteConfig.url,
		feed_url: FEED_URL,
		language: 'zh-CN',
		ttl: 60,
	})

	uniquePosts.forEach((post) => {
		const url = `${siteConfig.url}${post.permalink}`

		feed.item({
			title: post.title,
			description: post.description ?? '',
			url,
			guid: url,
			date: new Date(post.date),
			categories: post.category.split(','),
			custom_elements: [{
				'content:encoded': {
					_cdata: post.content ?? '',
				},
			}],
		})
	})

	return new Response(feed.xml(), {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=0, s-maxage=600',
		},
	})
}
