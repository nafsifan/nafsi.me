import type { Root } from 'hast'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { visit } from 'unist-util-visit'
import { generateThumbhash, loadImageBuffer } from './thumbhashUtils'

const CACHE_DIR = '.next/cache/thumbhash'

interface ThumbhashCache {
	[hash: string]: {
		width: number
		height: number
		blurDataURL: string
	}
}

export function rehypeThumbhashPlaceholder() {
	return async (tree: Root) => {
		const tasks: Promise<void>[] = []
		const cache = await loadCache()

		visit(tree, 'element', (node) => {
			if (node.tagName !== 'img') return
			const rawSrc = typeof node.properties?.src === 'string' ? node.properties.src : null
			if (!rawSrc) return

			tasks.push((async () => {
				const meta = await getPlaceholderMeta(rawSrc, cache)
				if (!meta) return

				const isGif = rawSrc.toLowerCase().endsWith('.gif')
				node.properties = {
					...(node.properties ?? {}),
					width: node.properties?.width ?? meta.width,
					height: node.properties?.height ?? meta.height,
					...(isGif ? {} : { blurDataURL: meta.blurDataURL }),
				}

				// Update cache
				if (meta.hash && !meta.fromCache) {
					cache[meta.hash] = {
						width: meta.width,
						height: meta.height,
						blurDataURL: meta.blurDataURL,
					}
				}
			})())
		})

		await Promise.all(tasks)
		await saveCache(cache)
	}
}

async function getPlaceholderMeta(src: string, cache: ThumbhashCache) {
	try {
		const buffer = await loadImageBuffer(src)

		// Check cache by image content hash
		const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
		if (cache[hash]) {
			return { ...cache[hash], hash, fromCache: true }
		}

		// Use shared thumbhash generation function
		const result = await generateThumbhash(buffer)

		return {
			width: result.width,
			height: result.height,
			blurDataURL: result.blurDataURL,
			hash,
			fromCache: false,
		}
	}
	catch (error) {
		console.warn(`[rehype-thumbhash] Failed to generate placeholder for ${src}:`, error)
		return undefined
	}
}

async function loadCache(): Promise<ThumbhashCache> {
	const cachePath = path.join(process.cwd(), CACHE_DIR, 'metadata.json')
	try {
		const content = await fs.readFile(cachePath, 'utf-8')
		return JSON.parse(content)
	}
	catch {
		return {}
	}
}

async function saveCache(cache: ThumbhashCache): Promise<void> {
	const cacheDir = path.join(process.cwd(), CACHE_DIR)
	await fs.mkdir(cacheDir, { recursive: true })
	await fs.writeFile(
		path.join(cacheDir, 'metadata.json'),
		JSON.stringify(cache, null, 2),
	)
}
