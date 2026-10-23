---
title: "An Incomplete Guide to Integrating a Telegram Bot into Next.js"
slug: "nextjs-telegram-bot"
date: "2025-11-24"
description: "Notes on hacking together a Telegram Bot integration in Next.js"
category: "瞎折腾"
tags: ['moments','telegram-bot', 'grammy' ,'Cloudflare R2','Cloudflare D1']
summary: "To post quick updates to my blog's Moments page from anywhere, I decided to hook up a Telegram Bot—saving me the hassle of building a dedicated admin dashboard. Here, I walk through a minimal Next.js demo powered by grammY, along with the full workflow for Webhook handling and local debugging, making it effortless to capture fleeting thoughts whenever inspiration strikes."
---

## Introduction

The idea originated from the [Moments](https://nafsi.me/moments) page on my site. The original intention behind Moments was to capture and publish interesting snippets and ideas on the fly.

However, doing so requires a seamless, cross-platform method to post thoughts instantly from anywhere, at any time.

That led to the idea of integrating a Telegram Bot. It eliminates the need for a separate backend service or admin UI while still enabling fast publishing, editing, and deleting.

The tech stack powering Moments:

- grammy.js - The core framework for the Telegram Bot, handling conversation flows, webhook intake, and message forwarding.
- Cloudflare D1 - Used to store Moments data.
- Cloudflare R2 - Used for image storage and automated uploads sent through the Telegram Bot.

In this post, we will walk through a minimal demo of integrating a Telegram Bot into Next.js :)

## Implementation Steps

### Creating a Telegram Bot

1. Open a chat with [@BotFather](https://t.me/botfather) on Telegram, send the `/newbot` command, and follow the prompts to choose a display name and username for your bot.

2. Once created, you will receive a message like this. Keep the Token handy, as we'll need it shortly:

```bash {4}
Done! Congratulations on your new bot. You will find it at t.me/<botusername>. You can now add a description, about section and profile picture for your bot, see /help for a list of commands. By the way, when you've finished creating your cool bot, ping our Bot Support if you want a better username for it. Just make sure the bot is fully operational before you do this.

Use this token to access the HTTP API:
8249757183:AAH2-jYYA_PppSpqyODg3lJC3iMU3E_f7Rg
Keep your token secure and store it safely, it can be used by anyone to control your bot.

For a description of the Bot API, see this page: https://core.telegram.org/bots/api
```

For more details, check out the [Telegram Bots Documentation](https://core.telegram.org/bots).

### Installing grammY

> What is grammY?
> 
> A framework for creating Telegram bots. It works with TypeScript and JavaScript and runs on Node.js, Deno, and in the browser. — [grammy.js](https://grammy.dev/)

```bash {4}
pnpm add grammy
```

### Configuring Environment Variables

Create or update `.env.local` in the project root:

```bash
TELEGRAM_BOT_TOKEN=8249757183:AAH2-jYYA_PppSpqyODg3lJC3iMU3E_f7Rg // Bot Token obtained from BotFather
TELEGRAM_WEBHOOK_SECRET_KEY=<custom_random_string>
TELEGRAM_ALLOWED_CHAT_ID=123456789
```

### Building a Minimal Working Demo

#### Initialization

```ts title="src/telegram/bot.ts"
import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new Bot(token);
```

Instantiate a new `Bot` object and initialize it by passing in your Bot Token.

#### Registering a Command

```ts title="src/telegram/bot.ts"
import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new Bot(token);

bot.command("ping", async (ctx) => { // [!code ++]
    await ctx.reply("Telegram Bot connection test successful"); // [!code ++]
}); // [!code ++]
```

This alone isn't enough. We also need to configure a Webhook API endpoint so Telegram can push updates to our server, enabling us to process incoming messages and reply accordingly.

### Configuring the Telegram Webhook API

#### What is a Webhook?

A Webhook is the mechanism Telegram uses to deliver updates to our server. Every time a user sends a message to the bot, Telegram forwards that update payload to our specified HTTPS endpoint. Under the Next.js App Router, we can implement this endpoint effortlessly using a Route Handler.

The official grammY [Deployment Types Guide](https://grammy.dev/zh/guide/deployment-types) highlights two primary deployment strategies:

- **Long Polling**: Best suited for local development or temporary scripts. It requires no public domain but relies on a constantly running process to actively pull messages.
- **Webhook**: The approach adopted in this guide. Quoting the official docs: "The main advantage of webhooks over long polling is that they are **cheaper**."

##### Webhook Setup

This is where `TELEGRAM_WEBHOOK_SECRET_KEY` from our `.env.local` comes into play. It validates that incoming requests genuinely originate from Telegram, preventing malicious spoofing. Quoting the official documentation:

> If you'd like to make sure that the webhook was set by you, you can specify secret data in the **secret_token** parameter. If specified, the request will contain a header named `X-Telegram-Bot-Api-Secret-Token` with the secret token as its value.

```ts title="src/app/api/telegram/webhook/route.ts"
import { webhookCallback } from "grammy";
import { bot } from "@/telegram/bot";

const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET_KEY;

if (!webhookSecret) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET_KEY is required for webhook security");
}

// Verify requests originate from Telegram via secretToken to prevent unauthorized calls
const handleUpdate = webhookCallback(bot, "std/http", { secretToken: webhookSecret });

export async function POST(request: Request) {
  try {
    // Incoming updates pushed from Telegram reach here; pass the request to grammY
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

What if we want to debug this locally? That's where [ngrok](https://ngrok.com/) comes in handy.

### Local Debugging with ngrok

#### Installing ngrok

- Head to the official **ngrok** website to [download](https://ngrok.com/download) the installer for your operating system.
- Sign up for an ngrok account to obtain and save your `ngrok auth token`.
- On your first run, execute `ngrok config add-authtoken <your_ngrok_token>` to register your authentication token.

#### Debugging Locally

1. Run `pnpm dev` in the project root and confirm that visiting http://localhost:3000/api/telegram/webhook in your browser returns a valid status payload.
2. Open a new terminal window and run `ngrok http 3000`, noting down the generated public forwarding URL.
3. Call Telegram's official **setWebhook** API to bind the temporary domain to the Webhook Route Handler we wrote in Next.js, passing along the **secret_token**:

```bash
    curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
        -H "Content-Type: application/json"
        -d "{"url": "https://<subdomain>.ngrok.app/api/telegram/webhook", "secret_token": "${TELEGRAM_WEBHOOK_SECRET_KEY}"}"
```

Now, send the `/ping` command to your Telegram Bot, and you should receive the confirmation response: **"Telegram Bot connection test successful"**.

## Conclusion

Of course, this guide only covers the baseline steps and implementation to provide a starting point and reference for others.

The feature set is still evolving. If you run into any issues or have questions, feel free to open an issue in [issues](https://github.com/nafsifan/nafsi.me/issues), or explore the [project source code](https://github.com/nafsifan/nafsi.me) directly.
