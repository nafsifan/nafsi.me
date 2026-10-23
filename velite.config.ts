import {
	transformerMetaHighlight,
	transformerNotationDiff,
	transformerNotationFocus,
	transformerNotationHighlight,
} from '@shikijs/transformers'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import rehypeUnwrapImages from 'rehype-unwrap-images'
import remarkGfm from 'remark-gfm'
import { defineConfig, s } from 'velite'
import { rehypeThumbhashPlaceholder } from '@/lib/rehypeThumbhash'
import { transformerCopyButton } from '@/lib/transformerCopyButton'

export default defineConfig({
	root: 'content',
	output: {
		data: '.velite',
		assets: 'public/static',
		base: '/static/',
		name: '[name]-[hash:6].[ext]',
		clean: true,
	},
	collections: {
		posts: {
			name: 'posts',
			pattern: 'posts/**/*.{md,mdx}',
			schema: s
				.object({
					title: s.string().max(100),
					description: s.string().max(200).optional(),
					summary: s.string().optional(),
					date: s.isodate(),
					category: s.string().max(30),
					tags: s.array(s.string()).default([]),
					slug: s.string(),
					locale: s.enum(['zh-CN', 'en']).default('zh-CN'),
					draft: s.boolean().default(false),
					content: s.mdx(),
					toc: s.toc(),
					path: s.path(),
				})
				.transform(data => ({
					...data,
					locale: (data.path.includes('/en/') ? 'en' : 'zh-CN') as 'zh-CN' | 'en',
					permalink: `/posts/${data.slug}`,
				})),
		},
		friends: {
			name: 'friends',
			pattern: 'friends/index.md',
			schema: s
				.object({
					title: s.string(),
					date: s.isodate(),
					links: s.array(
						s.object({
							title: s.string(),
							description: s.string(),
							website: s.string().optional(),
							image: s.string(),
						}),
					),
				}),
		},
	},
	mdx: {
		remarkPlugins: [remarkGfm],
		rehypePlugins: [
			rehypeSlug,
			[rehypeAutolinkHeadings, {
				properties: { className: ['anchor'] },
				behavior: 'wrap',
			}],
			[
				rehypePrettyCode,
				{
					theme: {
						dark: 'dracula-soft',
						light: 'github-light',
					},
					keepBackground: false,
					transformers: [
						transformerNotationDiff(),
						transformerNotationHighlight(),
						transformerNotationFocus(),
						transformerMetaHighlight(),
						transformerCopyButton(),
					],
				},
			],
			rehypeUnwrapImages,
			rehypeThumbhashPlaceholder,
		],
	},
})
