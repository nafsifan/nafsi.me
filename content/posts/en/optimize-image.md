---
title: "Image Optimization with Thumbhash and Sharp"
slug: "optimize-image"
date: "2025-12-15"
description: "Generate image placeholders using Thumbhash and Sharp to eliminate layout shifts and optimize web images."
category: "瞎折腾"
tags: ["Next.js", "Image Optimization", "Thumbhash", "Sharp"]
summary: "When web pages load, abruptly appearing images often push content around and trigger annoying layout jumps. Here is how I built a custom Rehype plugin using Sharp and the ultra-lightweight Thumbhash to automatically extract image dimensions and inject blurred placeholders during the build phase, completely eliminating Cumulative Layout Shift (CLS)."
---

## Introduction

When a web page renders, images might still be in flight. Without explicit width and height dimensions, newly loaded images abruptly displace adjacent elements once fetched, leading to **Cumulative Layout Shift (CLS)**.

The solution: display a lightweight placeholder before each image finishes loading to reserve its space and prevent layout shifts.

## Tech Stack

### Thumbhash: Placeholder Generation

Thumbhash is a compact image placeholder algorithm. Compared to BlurHash, it offers:

- **Smaller Footprint**: Only around 25 bytes.
- **Richer Detail**: Encodes more detailed color nuances within the same footprint.
- **Built-in Aspect Ratio**: Naturally encodes image dimension ratios.

Reference: [Official Thumbhash](https://evanw.github.io/thumbhash/)

### Sharp: Image Processing

Sharp is a high-performance image processing library powered by libvips:

- **High Performance**: Built natively in C++, delivering exceptional processing speeds.
- **Format Support**: Handles JPEG, PNG, WebP, GIF, and more.
- **Metadata Extraction**: Simultaneously reads width/height attributes while processing image data.

## Implementation: Custom Rehype Plugin

### Why a Plugin?

This blog is built with Velite, which compiles Markdown into MDX during the build phase. Writing a custom Rehype plugin allows us to intercept `<img>` nodes in the AST and process images at build time.

### Plugin Core Logic

```typescript title="src/lib/rehypeThumbhash.ts"
import type { Root } from 'hast'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { rgbaToThumbHash, thumbHashToDataURL } from 'thumbhash'
import { visit } from 'unist-util-visit'

const MAX_THUMB_SIZE = 64
const CACHE_DIR = '.next/cache/thumbhash'

export function rehypeThumbhashPlaceholder() {
  return async (tree: Root) => {
    const tasks: Promise<void>[] = []
    const cache = await loadCache()

    // Traverse the AST to find all <img> nodes
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return
      const rawSrc = typeof node.properties?.src === 'string' ? node.properties.src : null
      if (!rawSrc) return

      tasks.push((async () => {
        const meta = await getPlaceholderMeta(rawSrc, cache)
        if (!meta) return

        // Skip animated GIFs
        const isGif = rawSrc.toLowerCase().endsWith('.gif')

        // Inject metadata into the img node
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
```

### Image Processing Functions

```typescript title="src/lib/rehypeThumbhash.ts"
async function getPlaceholderMeta(src: string, cache: ThumbhashCache) {
  const normalizedSrc = src.replaceAll('%20', ' ')
  try {
    const buffer = await loadImageBuffer(normalizedSrc)

    // Use content hash as the cache key
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
    if (cache[hash]) {
      return { ...cache[hash], hash, fromCache: true }
    }

    // 1. Extract original image dimensions
    const image = sharp(buffer)
    const meta = await image.metadata()

    if (!meta.width || !meta.height) {
      throw new Error(`Failed to get image dimensions: ${normalizedSrc}`)
    }

    // 2. Resize down to 64x64 for Thumbhash
    const { data, info } = await image
      .resize({
        width: MAX_THUMB_SIZE,
        height: MAX_THUMB_SIZE,
        fit: 'inside',              // Preserve aspect ratio
        withoutEnlargement: true,   // Do not upscale small images
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // 3. Generate Thumbhash
    const thumbHash = rgbaToThumbHash(info.width, info.height, data)
    const blurDataURL = thumbHashToDataURL(thumbHash)

    return {
      width: meta.width,      // Return original dimensions for layout sizing
      height: meta.height,
      blurDataURL,
      hash,
      fromCache: false,
    }
  }
  catch (error) {
    console.warn(`[rehype-thumbhash] Processing failed: ${normalizedSrc}`, error)
    return undefined
  }
}

async function loadImageBuffer(src: string) {
  // Support remote images
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src)
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${src}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  // Read local images from the public/ directory
  const normalized = src.startsWith('/') ? src.slice(1) : src
  return fs.readFile(path.join(process.cwd(), 'public', normalized))
}

async function loadCache(): Promise<ThumbhashCache> {
  const cachePath = path.join(process.cwd(), CACHE_DIR, 'metadata.json')
  try {
    return JSON.parse(await fs.readFile(cachePath, 'utf-8'))
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
```

**Key Takeaways**:

1. **Original vs. Thumbnail Dimensions**: The function returns `meta.width/height` (original dimensions) rather than `info.width/height` (64px), as the frontend requires the true aspect ratio to reserve the layout space.
2. **Parallel Processing**: Employs `Promise.all()` to process multiple images concurrently.
3. **Skipping GIFs**: Omits placeholders for animated GIFs to avoid visual inconsistencies caused by displaying a static first frame.

### Configuring Velite

Register the plugin in `velite.config.ts`:

```typescript title="velite.config.ts"
import { rehypeThumbhashPlaceholder } from './src/lib/rehypeThumbhash'

export default defineConfig({
  mdx: {
    rehypePlugins: [
      rehypeSlug,
      rehypePrettyCode,
      rehypeUnwrapImages,               // Remove wrapping <p> tags
      rehypeThumbhashPlaceholder,       // Generate placeholders
    ],
  },
})
```

## Frontend: Custom Image Component

### Limitations of Next.js Image

While Next.js's native `<Image>` component supports `placeholder="blur"` and `blurDataURL`, it has a few drawbacks:

1. **No Transition Animation**: It snaps abruptly into view once loaded without a soft fade-in.
2. **Fixed Blur Intensity**: It provides no built-in API to tweak blur radius or transition speed.
3. **External Dependencies**: `blurDataURL` strings must be generated manually or through `next-image-loader`.

### Custom Component Implementation

Create `src/components/ui/OptimizeImage.tsx`:

```typescript title="src/components/ui/OptimizeImage.tsx"
'use client'

import type { ComponentProps } from 'react'
import Image from 'next/image'
import { useState } from 'react'
import { useImageZoom } from '@/hooks/useImageZoom'
import { cn } from '@/lib/utils'

interface OptimizeImageProps extends Omit<ComponentProps<typeof Image>, 'src' | 'alt' | 'placeholder'> {
  src?: string
  alt?: string
  blurDataURL?: string
  width?: number
  height?: number
  wrapperClassName?: string
}

export function OptimizeImage({
  src,
  alt = '',
  className = '',
  width,
  height,
  blurDataURL,
  wrapperClassName,
  ...rest
}: OptimizeImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const imageRef = useImageZoom<HTMLImageElement>()

  if (!src || !width || !height) return null

  return (
    <div
      className={cn(
        'relative mx-auto my-6 block transform-gpu cursor-zoom-in overflow-hidden rounded-lg shadow-sm',
        wrapperClassName,
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {/* Placeholder layer */}
      {blurDataURL && !isLoaded && (
        <div
          className="absolute inset-0 opacity-70 hover:opacity-100"
          style={{
            backgroundImage: `url(${blurDataURL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Actual image layer */}
      <Image
        ref={imageRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className={cn(
          'relative size-full rounded-lg object-cover transition-[transform,opacity,filter] duration-300 ease-[cubic-bezier(0.2,0,0.2,1),ease-in-out,ease-in-out] hover:opacity-100',
          '[&.medium-zoom-image--opened]:blur-0 [&.medium-zoom-image--opened]:opacity-100',
          isLoaded ? 'blur-0 opacity-70' : 'opacity-0 blur-lg',
          className,
        )}
        onLoad={() => {
          requestAnimationFrame(() => {
            setIsLoaded(true)
          })
        }}
        {...rest}
      />
    </div>
  )
}
```

**Implementation Highlights**:

1. **Layered Layout**: The placeholder is positioned with `absolute` behind the real image, creating a seamless background overlay.
2. **Aspect Ratio Enforcement**: The wrapping `div` applies CSS `aspect-ratio` to preemptively reserve space and prevent layout shifts.
3. **Transition Animation**:
   - The placeholder renders at `opacity-70` and unmounts once the image is ready.
   - The real image smoothly transitions from `opacity-0 blur-lg` to `opacity-70 blur-0`.
   - `requestAnimationFrame` defers the state update to the next frame to avoid frame drops.
4. **GPU Acceleration**: Utilizes `transform-gpu` to trigger hardware acceleration.

### Registering in MDX

In `src/components/MDXContent.tsx`:

```typescript title="src/components/MDXContent.tsx"
import { OptimizeImage } from '@/components/ui/OptimizeImage'

const defaultComponents: Record<string, ComponentType<any>> = {
  img: OptimizeImage,
}

export function MDXContent({ code, components, className }: MDXContentProps) {
  const Component = useMDXComponent(code)

  return (
    <div className={className}>
      <Component components={{ ...defaultComponents, ...components }} />
    </div>
  )
}
```

## Next.js Build Cache Optimization

### The Problem

Running `pnpm build` originally reprocessed every single image:

```bash
# 10 images × 200ms = 2 seconds
✓ Processing 10 images: 2000ms
```

Waiting several seconds for unchanged images creates unnecessary friction during development.

### Solution: Content-Hash Caching

Using the SHA-256 hash of the image content as the cache key solves this cleanly:

```typescript
const hash = crypto
  .createHash('sha256')
  .update(buffer)
  .digest('hex')
  .slice(0, 16)

if (cache[hash]) {
  return cache[hash]  // Cache hit, skip processing
}
```

### Cache Storage

Cached results are persisted at `.next/cache/thumbhash/metadata.json`:

```json
{
  "a1b2c3d4e5f6g7h8": {
    "width": 1920,
    "height": 1080,
    "blurDataURL": "data:image/png;base64,..."
  }
}
```

The `.next/cache` directory is Next.js's designated cache path. For more details, refer to the [Vercel Build Cache Documentation](https://vercel.com/docs/deployments/troubleshoot-a-build#understanding-build-cache).

## Summary

Combining Thumbhash, Sharp, and a tailored React component accomplishes the following:

1. **Zero CLS**: Image dimensions are extracted at build time, allowing the frontend to reserve precise layout space.
2. **Visual Continuity**: 25-byte placeholders paired with custom smooth fade-in animations eliminate harsh pop-ins.
3. **Faster Builds**: Content-hash caching accelerates incremental builds by up to 99%.
4. **Zero Runtime Overhead**: All computation happens ahead of time during compilation.

Key Architectural Takeaways:
- Rehype plugins can transform AST nodes before pages are rendered.
- Sharp reliably retrieves original dimensions and resizes thumbnails down to 64×64.
- Thumbhash converts small raw byte buffers into compact data URLs.
- React state management paired with CSS transitions provides polished loading animations.
- SHA-256 content hashing delivers a simple, reliable persistent cache.

## References

- [Thumbhash Repository](https://github.com/evanw/thumbhash)
- [Sharp Image Processing Library](https://sharp.pixelplumbing.com/)
- [Next.js Image Component Documentation](https://nextjs.org/docs/app/api-reference/components/image)
- [Vercel Build Cache](https://vercel.com/docs/deployments/troubleshoot-a-build#understanding-build-cache)
- [Blog Image Optimization Guide](https://buycoffee.top/blog/tech/image-optimization)
