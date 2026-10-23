/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import 'dotenv/config'

// 关闭非致命的第三方模型兼容性警告输出
;(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false

const apiKey = process.env.AI_API_KEY
const baseURL = process.env.AI_BASE_URL
const modelName = process.env.AI_MODEL

if (!apiKey || !modelName) {
	console.error('❌ 请在 .env 中正确配置 AI_API_KEY 和 AI_MODEL')
	process.exit(1)
}

const anthropic = createAnthropic({
	apiKey,
	baseURL: baseURL ? baseURL.replace(/\/+$/, '') : undefined,
})

const model = anthropic(modelName)
const zhDir = path.join(process.cwd(), 'content/posts/zh-CN')
const enDir = path.join(process.cwd(), 'content/posts/en')

if (!fs.existsSync(enDir)) {
	fs.mkdirSync(enDir, { recursive: true })
}

function parsePost(content: string) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
	if (!match)
		throw new Error('无效的 Markdown Frontmatter 结构')

	const frontmatter = match[1]
	const body = match[2]
	return { frontmatter, body }
}

function updateFrontmatterField(content: string, field: string, value: string): string {
	const { frontmatter, body } = parsePost(content)
	const lines = frontmatter.split('\n')
	const fieldPrefix = `${field}:`
	const targetIndex = lines.findIndex(line => line.trim().startsWith(fieldPrefix))

	const formattedLines = value.includes('\n')
		? [`${field}: |`, ...value.split('\n').map(line => `  ${line}`)]
		: [`${field}: ${JSON.stringify(value)}`]

	if (targetIndex !== -1) {
		let deleteCount = 1
		while (
			targetIndex + deleteCount < lines.length
			&& (lines[targetIndex + deleteCount].startsWith('  ') || lines[targetIndex + deleteCount].startsWith('\t'))
		) {
			deleteCount++
		}
		lines.splice(targetIndex, deleteCount, ...formattedLines)
	}
	else {
		lines.push(...formattedLines)
	}

	return `---\n${lines.join('\n').trim()}\n---\n\n${body.trim()}\n`
}

async function generateSummary(slug: string) {
	const filePath = path.join(zhDir, `${slug}.md`)
	if (!fs.existsSync(filePath)) {
		console.error(`❌ 未找到文章: ${filePath}`)
		return
	}

	const content = fs.readFileSync(filePath, 'utf-8')
	const { body } = parsePost(content)

	console.log(`✨ 正在为 [${slug}] 生成自然语言 AI 摘要...`)

	const prompt = `
你是一个博客阅读助手。请用自然、亲切、通俗的人话，为这篇博客写一段简短的“文章导读”（约 80~130 字）。

写作准则：
1. 以第一人称（“我”）或中性直陈视角展开，像博主在正文开头自然地跟读者打招呼交代这篇内容；
2. 严禁出现“作者在文中分享了”、“博主探讨了”、“本文详细介绍了”、“总的来说”等机械第三方客套套话；
3. 适合任何题材（技术折腾、日常随笔、个人思考等），直述要点或经历；
4. 输出 1~2 句连贯纯文本，严禁列条目（不要输出 - 列表）。

文章全文：
${body.trim()}
`

	const { text } = await generateText({
		model,
		prompt,
	})

	const summary = text.trim()
	const updatedContent = updateFrontmatterField(content, 'summary', summary)
	fs.writeFileSync(filePath, updatedContent, 'utf-8')

	console.log(`✅ [${slug}] AI 摘要已成功写入 Frontmatter：\n\n${summary}\n`)
	return summary
}

async function translatePost(slug: string) {
	const sourcePath = path.join(zhDir, `${slug}.md`)
	const targetPath = path.join(enDir, `${slug}.md`)

	if (!fs.existsSync(sourcePath)) {
		console.error(`❌ 未找到原文章: ${sourcePath}`)
		return
	}

	console.log(`🌐 正在将 [${slug}] 翻译为英文版本并存入 en/ 目录...`)
	const raw = fs.readFileSync(sourcePath, 'utf-8')

	const prompt = `
请将以下 Markdown 博客文章翻译为地道、自然的英文版本。

严格遵守以下要求：
1. 必须完整保留最开头的 YAML Frontmatter 格式（--- 到 --- 部分）；
2. Frontmatter 翻译规范：
   - 翻译 "title"、"description" 为英文；
   - 将 "tags" 数组中的中文标签翻译为简练地道的英文（英文专有名词保持不变）；
   - 若已有 "summary"，将其自然通顺地翻译为英文；
   - 严禁修改 "slug"、"date" 和 "category" 标识；
3. 正文翻译规范：
   - 保持所有 Markdown 标记、层级标题、图片链接、外部链接完整不变；
   - 严格保留所有 MDX/JSX 自定义组件标签及属性原样不变（仅翻译组件内部可读文案）；
   - 语言自然流畅，符合现代技术与生活博客阅读习惯，拒绝生硬字对字直译；
4. 代码块规范：
   - 代码块（\`\`\`... \`\`\`）和行内代码（\`...\`）中的代码逻辑、变量名、函数名、关键字与依赖包名严禁变动；
   - 但代码内部的注释文本（如 // 注释、/* 注释 */、# 注释）请翻译为清晰的英文注释；
5. 直接输出完整 Markdown 内容，不要包裹任何多余的开场白或解释。

待翻译文章原文：
${raw}
`

	const { text } = await generateText({
		model,
		prompt,
	})

	let output = text.trim()
	if (output.startsWith('```markdown'))
		output = output.slice(11)
	else if (output.startsWith('```'))
		output = output.slice(3)
	if (output.endsWith('```'))
		output = output.slice(0, -3)

	fs.writeFileSync(targetPath, `${output.trim()}\n`, 'utf-8')
	console.log(`✅ [${slug}] 英文版本已生成: ${targetPath}`)
}

async function main() {
	const [action, targetSlug] = process.argv.slice(2)

	if (!action) {
		console.log(`
使用方式:
  pnpm ai summary [slug]    # 生成指定文章或所有未有摘要文章的 AI 摘要
  pnpm ai translate [slug]  # 翻译指定文章或所有未翻译文章至 en/ 目录
  pnpm ai all <slug>        # 同时生成摘要并完成英文版翻译
		`)
		return
	}

	if (action === 'summary') {
		if (targetSlug) {
			await generateSummary(targetSlug)
		}
		else {
			const files = fs.readdirSync(zhDir).filter(f => f.endsWith('.md'))
			for (const file of files) {
				const slug = file.replace(/\.md$/, '')
				const content = fs.readFileSync(path.join(zhDir, file), 'utf-8')
				if (!content.includes('summary:')) {
					await generateSummary(slug)
				}
			}
		}
	}
	else if (action === 'translate') {
		if (targetSlug) {
			await translatePost(targetSlug)
		}
		else {
			const files = fs.readdirSync(zhDir).filter(f => f.endsWith('.md'))
			for (const file of files) {
				const slug = file.replace(/\.md$/, '')
				const enPath = path.join(enDir, `${slug}.md`)
				if (!fs.existsSync(enPath)) {
					await translatePost(slug)
				}
			}
		}
	}
	else if (action === 'all') {
		if (!targetSlug) {
			console.error('❌ 请提供目标文章 slug，例如: pnpm ai all optimize-image')
			process.exit(1)
		}
		await generateSummary(targetSlug)
		await translatePost(targetSlug)
	}
	else {
		console.error(`❌ 未知操作: ${action}`)
	}
}

main().catch((err) => {
	console.error('❌ 脚本异常:', err)
	process.exit(1)
})
