---
title: "基于 Thumbhash + Sharp 进行图片优化"
slug: "optimize-image"
date: "2025-12-15"
description: "使用 Thumbhash + Sharp 生成图片占位符，解决布局偏移问题，实现图片优化。"
category: "瞎折腾"
tags: ["Next.js", "图片优化", "Thumbhash", "Sharp"]
---

## 前言

当页面加载完成时，图片尚未加载完成，并且没有宽度与高度的信息，导致图片加载完成时会撑开页面，造成**累计布局偏移（CLS）**。

解决思路：在图片加载前显示占位符，预先占据空间，防止布局跳动。

## 技术选型

### Thumbhash：占位符生成

Thumbhash 是一个轻量级图片占位符算法，相比 BlurHash：

- **更小体积**：仅 25 bytes
- **更多细节**：在相同空间内编码更丰富的颜色信息
- **内置宽高比**：自带图片尺寸信息

参考：[Thumbhash 官方](https://evanw.github.io/thumbhash/)

### Sharp：图片处理

Sharp 是基于 libvips 的高性能图片处理库：

- **高性能**：C++ 底层实现，处理速度快
- **功能完整**：支持多种格式（JPEG、PNG、WebP、GIF 等）
- **元数据提取**：可同时获取宽高信息和处理图片

## 实现：自定义 Rehype 插件

### 为什么需要插件？

博客使用 Velite 构建，它在编译时将 Markdown 转换为 MDX。通过 Rehype 插件可以在构建时拦截 `<img>` 标签，提前处理图片。

### 插件核心逻辑

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

    // 遍历 AST，找到所有 <img> 节点
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return
      const rawSrc = typeof node.properties?.src === 'string' ? node.properties.src : null
      if (!rawSrc) return

      tasks.push((async () => {
        const meta = await getPlaceholderMeta(rawSrc, cache)
        if (!meta) return

        // 跳过 GIF 动图
        const isGif = rawSrc.toLowerCase().endsWith('.gif')

        // 注入元数据到 img 节点
        node.properties = {
          ...(node.properties ?? {}),
          width: node.properties?.width ?? meta.width,
          height: node.properties?.height ?? meta.height,
          ...(isGif ? {} : { blurDataURL: meta.blurDataURL }),
        }

        // 更新缓存
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

### 图片处理函数

```typescript title="src/lib/rehypeThumbhash.ts"
async function getPlaceholderMeta(src: string, cache: ThumbhashCache) {
  const normalizedSrc = src.replaceAll('%20', ' ')
  try {
    const buffer = await loadImageBuffer(normalizedSrc)

    // 使用内容哈希作为缓存键
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
    if (cache[hash]) {
      return { ...cache[hash], hash, fromCache: true }
    }

    // 1. 提取原始图片尺寸
    const image = sharp(buffer)
    const meta = await image.metadata()

    if (!meta.width || !meta.height) {
      throw new Error(`无法获取图片尺寸: ${normalizedSrc}`)
    }

    // 2. 缩放到 64×64 用于 Thumbhash
    const { data, info } = await image
      .resize({
        width: MAX_THUMB_SIZE,
        height: MAX_THUMB_SIZE,
        fit: 'inside',              // 保持宽高比
        withoutEnlargement: true,   // 小图不放大
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // 3. 生成 Thumbhash
    const thumbHash = rgbaToThumbHash(info.width, info.height, data)
    const blurDataURL = thumbHashToDataURL(thumbHash)

    return {
      width: meta.width,      // 返回原始尺寸用于布局
      height: meta.height,
      blurDataURL,
      hash,
      fromCache: false,
    }
  }
  catch (error) {
    console.warn(`[rehype-thumbhash] 处理失败: ${normalizedSrc}`, error)
    return undefined
  }
}

async function loadImageBuffer(src: string) {
  // 支持远程图片
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src)
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${src}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  // 本地图片从 public/ 目录读取
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

**关键点**：

1. **原始尺寸 vs 缩略图尺寸**：返回 `meta.width/height`（原始尺寸），而不是 `info.width/height`（64px），前端需要真实尺寸设置 `aspect-ratio`
2. **并行处理**：使用 `Promise.all()` 同时处理多张图片
3. **跳过 GIF**：动图不生成占位符，避免第一帧造成视觉不连续

### 配置 Velite

在 `velite.config.ts` 中注册插件：

```typescript title="velite.config.ts"
import { rehypeThumbhashPlaceholder } from './src/lib/rehypeThumbhash'

export default defineConfig({
  mdx: {
    rehypePlugins: [
      rehypeSlug,
      rehypePrettyCode,
      rehypeUnwrapImages,               // 移除 <p> 包裹
      rehypeThumbhashPlaceholder,       // 生成占位符
    ],
  },
})
```

## 前端：自定义 Image 组件

### Next.js Image 的局限

Next.js 的 `<Image>` 组件支持 `placeholder="blur"` 和 `blurDataURL`，但存在问题：

1. **缺少过渡动画**：图片加载完成后直接切换，没有淡入效果
2. **占位符模糊度固定**：无法自定义模糊程度和过渡时长
3. **需要外部工具**：`blurDataURL` 需要手动生成或使用 `next-image-loader`

### 自定义组件实现

创建 `src/components/ui/OptimizeImage.tsx`：

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
      {/* 占位符层 */}
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

      {/* 真实图片层 */}
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

**实现要点**：

1. **层叠布局**：占位符用 `absolute` 定位，与真实图片层叠显示
2. **aspect-ratio**：外层 `div` 设置宽高比，防止 CLS
3. **过渡动画**：
   - 占位符：`opacity-70`，加载完成后消失
   - 真实图片：从 `opacity-0 blur-lg` 过渡到 `opacity-70 blur-0`
   - 使用 `requestAnimationFrame` 确保在下一帧更新状态，避免卡顿
4. **性能优化**：`transform-gpu` 启用 GPU 加速

### 注册到 MDX

在 `src/components/MDXContent.tsx` 中：

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

## NextJS 构建缓存优化

### 问题

每次 `pnpm build` 都要重新处理所有图片：

```bash
# 10 张图片 × 200ms = 2 秒
✓ Processing 10 images: 2000ms
```

即使图片没变，也要等待 2 秒，影响开发体验。

### 解决方案：内容哈希缓存

使用图片内容的 SHA-256 哈希作为缓存键：

```typescript
const hash = crypto
  .createHash('sha256')
  .update(buffer)
  .digest('hex')
  .slice(0, 16)

if (cache[hash]) {
  return cache[hash]  // 命中缓存，跳过处理
}
```

### 缓存存储

缓存保存在 `.next/cache/thumbhash/metadata.json`：

```json
{
  "a1b2c3d4e5f6g7h8": {
    "width": 1920,
    "height": 1080,
    "blurDataURL": "data:image/png;base64,..."
  }
}
```

`.next/cache` 目录是 NextJS 的缓存目录，详细可查看: [Vercel 构建缓存](https://vercel.com/docs/deployments/troubleshoot-a-build#understanding-build-cache)

## 总结

通过 Thumbhash + Sharp + 自定义组件，实现了：

1. **解决 CLS**：构建时提取宽高，前端预留空间
2. **视觉连续**：25 bytes 占位符，自定义淡入动画
3. **开发效率**：内容哈希缓存，增量构建提速 99%
4. **运行时零开销**：所有处理在构建时完成

关键技术点：
- Rehype 插件在 AST 层拦截图片节点
- Sharp 提取原始尺寸 + 生成 64×64 缩略图
- Thumbhash 算法生成 Data URL
- React 状态管理 + CSS 过渡实现加载动画
- SHA-256 内容哈希实现智能缓存

## 参考

- [Thumbhash 官方仓库](https://github.com/evanw/thumbhash)
- [Sharp 图片处理库](https://sharp.pixelplumbing.com/)
- [Next.js Image 组件文档](https://nextjs.org/docs/app/api-reference/components/image)
- [Vercel 缓存](https://vercel.com/docs/deployments/troubleshoot-a-build#understanding-build-cache)
- [博客图片优化](https://buycoffee.top/blog/tech/image-optimization)