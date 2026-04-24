---
title: "Next.js 接入 Telegram Bot 的不完整指南"
slug: "nextjs-telegram-bot"
date: "2025-11-24"
description: "Next.js 接入 Telegram Bot 功能的折腾笔记"
category: "瞎折腾"
tags: ['moments','telegram-bot', 'grammy' ,'Cloudflare R2','Cloudflare D1']
---

## 前言

想法源于网站的 [Moments](https://nafsi.me/moments) 页面 ，因为设计 Moment 的初衷就是为了时刻发布和记录有趣的事情和想法。

但是这就要寻求一个便捷能快速发布，以及支持全端，某时某刻某地我就可以发布想法的方案。

所以就有了接入 Telegram Bot 的这个想法，不需要额外的后端服务和页面，就能实现快速的发布，编辑，删除。

Moments 使用的相关技术栈：

- grammy.js - Telegram Bot 的核心，提供了 Bot 对话流管理，Webhook 接收消息，以及消息转发等能力。
- Cloudflare D1 - 用于存储 Moments 的数据。
- Cloudflare R2 - 用于存储 Telegram Bot 的图片，以及图片自动上传。

本文将实现一个最小 Demo 在 Next.js 中接入 Telegram Bot :)

## 实现步骤

### 创建 Telegram Bot

1. 前往 Telegram 的 [@BotFather](https://t.me/botfather) 对话，使用 `/newbot` 命令后，按照提示输入ID、名称进行创建 Bot

2. 创建完成后你会得到这样一段对话，下面将会用到这个 Token

```bash {4}
Done! Congratulations on your new bot. You will find it at t.me/<botusername>. You can now add a description, about section and profile picture for your bot, see /help for a list of commands. By the way, when you've finished creating your cool bot, ping our Bot Support if you want a better username for it. Just make sure the bot is fully operational before you do this.

Use this token to access the HTTP API:
8249757183:AAH2-jYYA_PppSpqyODg3lJC3iMU3E_f7Rg
Keep your token secure and store it safely, it can be used by anyone to control your bot.

For a description of the Bot API, see this page: https://core.telegram.org/bots/api
```

更多可以参考 [Telegram Bot 开发指南](https://core.telegram.org/bots) 了解相关帮助。

### 安装 Grammy.js

> 什么是 grammY？
> 
> 是一个用于创建 Telegram Bot 的框架。它可以从 TypeScript 和 JavaScript 中使用，在 Node.js、 Deno 和浏览器中运行。 - [grammy.js](https://grammy.dev/)

```bash {4}
pnpm add grammy
```

### 配置环境变量

在项目根目录创建或更新 `.env.local`

```bash
TELEGRAM_BOT_TOKEN=8249757183:AAH2-jYYA_PppSpqyODg3lJC3iMU3E_f7Rg // 从 BotFather 获取的 Bot Token
TELEGRAM_WEBHOOK_SECRET_KEY=<自定义随机字符串>
TELEGRAM_ALLOWED_CHAT_ID=123456789
```

### 实现最小 Demo 实例

#### 初始化

```ts title="src/telegram/bot.ts"
import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new Bot(token);
```

新建一个 Bot 对象，传入 Bot Token，初始化 Bot 对象。

#### 绑定指令

```ts title="src/telegram/bot.ts"
import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new Bot(token);

bot.command("ping", async (ctx) => { // [!code ++]
    await ctx.reply("Telegram Bot 连通性检测成功"); // [!code ++]
}); // [!code ++]
```

只到这里是不够的，还需要配置 Webhook API，以便 Telegram 可以推送消息给我们，然后我们根据消息内容进行处理和返回。

### 配置 Telegram Webhook API

#### 什么是 Webhook ？

Webhook 是 Telegram 推送消息给我们的方式。每次用户发送消息到 Bot，Telegram 就会把更新内容转发到我们指定的 HTTPS Endpoint。Next.js App Router 下使用 Route Handler 即可完成这一层 API。

在 grammY 官方的[部署方式指南](https://grammy.dev/zh/guide/deployment-types)中，主要介绍了两种部署方式：

- **长轮询（Long Polling）**：本地开发或临时脚本的首选，无需公网域名，但需要常驻进程主动拉取消息。
- **Webhook**：本文采用的方式，引用官方的解释 “Webhook 比长轮询的主要优势在于它们更**便宜**”。

##### Webhook 配置

这里就可以用到之前 .env.local 中的 `TELEGRAM_WEBHOOK_SECRET_KEY` 了，用于验证请求来自 Telegram 官方，避免恶意调用，引用官方的解释：

> 如果您想确保 webhook 是您自己设置的，可以在参数**secret_token**中指定秘密数据。如果指定了该参数，请求将包含一个名为`X-Telegram-Bot-Api-Secret-Token`的标头，其内容为秘密令牌。


```ts title="src/app/api/telegram/webhook/route.ts"
import { webhookCallback } from "grammy";
import { bot } from "@/telegram/bot";

const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET_KEY;

if (!webhookSecret) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET_KEY is required for webhook security");
}

// 通过 secretToken 验证请求来自 Telegram 官方，避免恶意调用
const handleUpdate = webhookCallback(bot, "std/http", { secretToken: webhookSecret });

export async function POST(request: Request) {
  try {
    // Telegram 推送消息时会走到这里，我们把请求交给 grammY 处理
    return await handleUpdate(request);
  } catch (error) {
    console.error("[Webhook] Error processing update:", error);
    return new Response("OK", { status: 200 });
  }
}

export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
```

如果我们想在本地进行调试怎么办呢？那么就可以用到 [ngrok](https://ngrok.com/) 

### 利用 ngrok 进行本地调试

#### 安装 ngrok

- 前往**ngrok**官网 [下载](https://ngrok.com/download) 对应安装文件
- 注册 ngrok 账号，获取并保存自己的 `ngrok token`
- 首次运行后执行 `ngrok config add-authtoken <你的 ngrok token>` 添加自己刚刚获取的 Token

#### 本地调试

1. 在项目根目录启动 `pnpm dev`，确认浏览器访问 http://localhost:3000/api/telegram/webhook 能返回正确状态
2. 新建窗口，在终端运行 `ngrok http 3000` 记录输出的域名地址
3. 调用 Telegram 官方**setWebhook**接口，把临时域名与我们在 Next.js 中编写的 Webhook Route 绑定，同时附带 **secret_token**

```bash
    curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
        -H "Content-Type: application/json"
        -d "{"url": "https://<子域>.ngrok.app/api/telegram/webhook", "secret_token": "${TELEGRAM_WEBHOOK_SECRET_KEY}"}"
```

现在通过 Telegram Bot 输入指令 `/ping`，就可以看到 **"Telegram Bot 连通性检测成功"** 的成功返回信息了。

## 总结

当然，文章这里只做了简单的步骤和实现说明，主要是给后来者提供一种思路。

目前的功能也还尚未完善，如果你有任何问题，欢迎在 [issues](https://github.com/nafsifan/nafsi.me/issues) 中提出，或者直接查看该[项目源码](https://github.com/nafsifan/nafsi.me)。