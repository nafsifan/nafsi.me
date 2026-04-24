import RSS from 'rss'
import { posts } from '#site/content'

export const runtime = 'nodejs'

const SITE_URL = 'https://nafsi.me'
const FEED_URL = `${SITE_URL}/feed`
const FEED_TITLE = 'Nafsi'
const FEED_DESCRIPTION = 'Keep Running...'

export const GET = async () => {
	const publishedPosts = posts
		.filter(post => !post.draft)
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

	const feed = new RSS({
		title: FEED_TITLE,
		description: FEED_DESCRIPTION,
		site_url: SITE_URL,
		feed_url: FEED_URL,
		language: 'zh-CN',
		ttl: 60,
	})

	publishedPosts.forEach((post) => {
		const url = `${SITE_URL}${post.permalink}`

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
