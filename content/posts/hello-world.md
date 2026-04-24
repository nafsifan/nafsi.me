---
title: "Hello, World !"
slug: "hello-world"
date: "2025-10-10"
description: "A concise tour of every Markdown feature this blog understands."
category: "Guide"
tags: ["markdown", "guide"]
featured: false
draft: false
---

# Hello, World 👋

Welcome to a single post that showcases the Markdown features supported on this site. Feel free to copy sections into new articles when you need a ready-made pattern.

## Headings & Paragraphs

Markdown gives you six heading levels:

### Level 3 Heading

Regular paragraphs can mix **bold**, _italic_, ~~strikethrough~~, `inline code`, and links like [nafsi.me](https://nafsi.me). Two spaces at the end of a line  
force a manual line break.

> “Clear writing is a sign of clear thinking.” — inspired by many code reviews

## Lists & Tasks

- Unordered lists keep things casual.
- Nest items for structure:
  - Second level item
    - Third level item

1. Ordered lists stay precise.
2. They are great for step-by-step guides.

- [x] Completed tasks
- [ ] Pending ideas

## Callouts & Details

> **Note:** Use blockquotes for lightweight callouts, tips, or warnings.

<details>
<summary>Expandable details</summary>

This block renders only when expanded. You can embed **Markdown**, `code`, or even lists inside.

</details>

## Code Blocks

```typescript title="greet.ts" {2}
export function greet(name: string) {
	console.log(`Hello, ${name}!`) // highlighted line
}
```

```bash
pnpm install
pnpm dev
```

### Diff Code Block

```javascript title="cart.ts"
function calculateTotal(items) {
	let total = 0; // [!code ++]
	for (let i = 0; i < items.length; i++) { // [!code ++]
		total += items[i].price; // [!code ++]
	} // [!code ++]
	const total = items.reduce((sum, item) => { // [!code --]
		return sum + item.price; // [!code --]
	}, 0); // [!code --]

	return total;
}
```

## Tables & Media

Use tables to compare features at a glance.

| Feature   | Markdown Syntax | Best For                     |
|-----------|-----------------|------------------------------|
| Headings  | `# Title`       | Structuring long-form posts  |
| Code block| ```tsx … ```    | Sharing snippets or configs  |
| Task list | `- [ ]`         | Tracking work-in-progress    |

Column alignment is controlled with colons in the separator row:

| Left Aligned | Centered | Right Aligned |
| :------------ | :------: | ------------: |
| `:--`         | `:--:`   | `--:`          |
| Default text  | Balanced | Totals (42)    |

## Image

![Avatar illustration](/avatar.jpeg)
