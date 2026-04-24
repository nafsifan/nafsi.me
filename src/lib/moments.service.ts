import type { Moment as PrismaMoment } from '@/generated/prisma'
import type { CreateMomentInput, GetMomentsQuery, UpdateMomentInput } from '@/lib/moments.schema'
import type { ImageMeta, Moment } from '@/types/moment'
import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'

function fromPrisma(prismaMoment: PrismaMoment): Moment {
	return {
		id: prismaMoment.id,
		content: prismaMoment.content,
		images: Array.isArray(prismaMoment.images) ? prismaMoment.images as unknown as ImageMeta[] : null,
		tags: Array.isArray(prismaMoment.tags) ? prismaMoment.tags as string[] : null,
		createdAt: prismaMoment.createdAt,
		updatedAt: prismaMoment.updatedAt,
	}
}

export class MomentService {
	static async findAll(query: GetMomentsQuery) {
		const { limit, offset, tag } = query
		const where: Prisma.MomentWhereInput = tag
			? { tags: { path: '$', string_contains: tag } }
			: {}

		const [moments, total] = await Promise.all([
			prisma.moment.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				take: limit,
				skip: offset,
			}),
			prisma.moment.count({ where }),
		])

		return {
			data: moments.map(fromPrisma),
			total,
			limit,
			offset,
		}
	}

	static async findById(id: string): Promise<Moment | null> {
		const moment = await prisma.moment.findUnique({
			where: { id },
		})

		return moment ? fromPrisma(moment) : null
	}

	static async create(data: CreateMomentInput): Promise<Moment> {
		const moment = await prisma.moment.create({
			data: {
				content: data.content,
				images: data.images ? (data.images as Prisma.InputJsonValue) : Prisma.JsonNull,
				tags: data.tags ? (data.tags as Prisma.InputJsonValue) : Prisma.JsonNull,
			},
		})

		return fromPrisma(moment)
	}

	static async update(id: string, data: UpdateMomentInput): Promise<Moment> {
		const moment = await prisma.moment.update({
			where: { id },
			data: {
				...(data.content !== undefined && { content: data.content }),
				...(data.images !== undefined && {
					images: data.images ? (data.images as Prisma.InputJsonValue) : Prisma.JsonNull,
				}),
				...(data.tags !== undefined && {
					tags: data.tags ? (data.tags as Prisma.InputJsonValue) : Prisma.JsonNull,
				}),
			},
		})

		return fromPrisma(moment)
	}

	static async delete(id: string): Promise<void> {
		await prisma.moment.delete({
			where: { id },
		})
	}
}
