import process from 'node:process'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined
}

/**
 * Prisma D1 Adapter Configuration (Prisma ORM v7)
 * Uses Cloudflare D1 REST API for both development and production
 *
 * In Prisma ORM v7, driver adapters work automatically without additional
 * configuration in prisma.config.ts. The adapter is initialized here and
 * passed to PrismaClient.
 *
 * @see https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1
 */
const adapter = new PrismaD1({
	CLOUDFLARE_D1_TOKEN: process.env.CLOUDFLARE_D1_TOKEN!,
	CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID!,
	CLOUDFLARE_DATABASE_ID: process.env.CLOUDFLARE_DATABASE_ID!,
})

export const prisma
	= globalForPrisma.prisma
		?? new PrismaClient({
			adapter,
			log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
		})

if (process.env.NODE_ENV !== 'production')
	globalForPrisma.prisma = prisma

export default prisma
