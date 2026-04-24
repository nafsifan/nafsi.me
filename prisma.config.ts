import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'

/**
 * Prisma ORM v7 Configuration
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 *
 * Breaking changes from v6 to v7:
 * - Removed: experimental.adapter field (adapters work automatically in v7)
 * - Removed: adapter() function (migrations work automatically)
 * - Added: datasource.url configuration (moved from schema.prisma)
 */
export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
	},
	datasource: {
		url: env('DATABASE_URL'),
	},
})
