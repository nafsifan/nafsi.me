import type { Metadata } from 'next'
import dayjs from 'dayjs'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { posts } from '#site/content'
import { MDXContent } from '@/components/MDXContent'
import { PostToc } from '@/components/PostToc'
import IconBadge from '@/components/ui/IconBadge'
import { siteConfig } from '@/lib/site'

interface PostPageProps {
	params: Promise<{
		slug: string
	}>
}

export async function generateStaticParams() {
	return posts.map(post => ({
		slug: post.slug,
	}))
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
	const { slug } = await params
	const post = posts.find(p => p.slug === slug)

	if (!post) {
		return {
			title: 'Not found',
			description: siteConfig.description,
		}
	}

	const description = post.description ?? siteConfig.description
	const url = `${siteConfig.url}/posts/${post.slug}`
	const publishedTime = new Date(post.date).toISOString()

	return {
		title: post.title,
		description,
		keywords: post.category,
		alternates: {
			canonical: `/posts/${post.slug}`,
		},
		openGraph: {
			title: post.title,
			description,
			url,
			siteName: siteConfig.title,
			locale: siteConfig.locale,
			type: 'article',
			publishedTime,
			modifiedTime: publishedTime,
			tags: post.category,
			images: [
				{
					url: siteConfig.ogImage.url,
					width: siteConfig.ogImage.width,
					height: siteConfig.ogImage.height,
					alt: post.title,
				},
			],
		},
		twitter: {
			card: 'summary_large_image',
			title: post.title,
			description,
			images: [siteConfig.ogImage.url],
		},
	}
}

export default async function PostPage({ params }: PostPageProps) {
	const { slug } = await params
	const post = posts.find(p => p.slug === slug)

	if (!post) {
		notFound()
	}

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		'headline': post.title,
		'description': post.description ?? siteConfig.description,
		'datePublished': new Date(post.date).toISOString(),
		'dateModified': new Date(post.date).toISOString(),
		'url': `${siteConfig.url}/posts/${post.slug}`,
		'mainEntityOfPage': {
			'@type': 'WebPage',
			'@id': `${siteConfig.url}/posts/${post.slug}`,
		},
		'image': siteConfig.ogImage.url,
		'author': {
			'@type': 'Person',
			'name': siteConfig.author.name,
			'url': siteConfig.author.url,
		},
		'publisher': {
			'@type': 'Person',
			'name': siteConfig.author.name,
			'url': siteConfig.author.url,
		},
		'articleSection': post.category,
		'keywords': (post.tags ?? []).join(', '),
	}

	return (
		<>
			<Link href="/posts" className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-(--text-tertiary) transition-colors duration-200 hover:text-(--text-primary)">
				<i className="i-mingcute-back-fill text-base" />
				<span>Back</span>
			</Link>
			<article className="relative">
				<section className="mb-8">
					<h1 className="mb-4 text-xl leading-tight font-bold text-(--text-primary) sm:text-2xl">
						{post.title}
					</h1>
					<div className="flex flex-wrap items-center gap-3 text-sm text-(--text-tertiary)">
						<time className="flex items-center font-medium">
							{dayjs(post.date).format('YYYY/MM/DD')}
						</time>
						<span className="text-(--border-subtle)">/</span>
						<div className="flex flex-wrap items-center gap-2">
							<IconBadge
								key={post.category}
								text={post.category}
								variant="category"
							/>
						</div>
					</div>
				</section>

				<section className="relative">
					<MDXContent code={post.content} className="markdown" />
					<PostToc toc={post.toc} />
				</section>

				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>

			</article>
		</>
	)
}
