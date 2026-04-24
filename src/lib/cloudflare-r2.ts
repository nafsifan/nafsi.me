import type { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import process from 'node:process'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const endpoint = process.env.CLOUDFLARE_R2_URL
const bucket = process.env.CLOUDFLARE_R2_BUCKET
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? process.env.CLOUDFLARE_R2_TOKEN
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? process.env.CLOUDFLARE_R2_SECRET_KEY
const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL

if (!endpoint) {
	throw new Error('CLOUDFLARE_R2_URL is not configured')
}

if (!bucket) {
	throw new Error('CLOUDFLARE_R2_BUCKET is not configured')
}

if (!accessKeyId || !secretAccessKey) {
	throw new Error('CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY must be configured')
}

const r2Client = new S3Client({
	region: 'auto',
	endpoint,
	forcePathStyle: true,
	credentials: {
		accessKeyId,
		secretAccessKey,
	},
})

export interface UploadObjectParams {
	body: Buffer
	contentType?: string | null
	prefix?: string
	extension?: string
	filenameHint?: string
}

export interface UploadObjectResult {
	objectUrl: string
	publicUrl: string
	key: string
	etag: string | null
}

function buildObjectKey(params: UploadObjectParams): string {
	const rawExtension = params.extension ?? ''
	const extension = rawExtension
		? rawExtension.startsWith('.') ? rawExtension : `.${rawExtension}`
		: ''

	const baseName = params.filenameHint
		? params.filenameHint.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase()
		: createHash('sha1').update(params.body).digest('hex')

	const fileName = `${baseName}-${randomUUID()}${extension}`
	if (!params.prefix) {
		return fileName
	}

	const prefix = params.prefix.replace(/\/+$/, '')
	return `${prefix}/${fileName}`
}

function buildObjectUrl(key: string): string {
	return `${endpoint}/${bucket}/${key}`
}

function buildPublicUrl(key: string): string {
	if (publicBaseUrl) {
		return `${publicBaseUrl}/${key}`
	}

	return buildObjectUrl(key)
}

export async function uploadObjectToR2(params: UploadObjectParams): Promise<UploadObjectResult> {
	const contentType = params.contentType ?? 'application/octet-stream'
	const key = buildObjectKey(params)

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: params.body,
		ContentType: contentType,
	})

	const response = await r2Client.send(command)
	const etag = response.ETag ?? null

	return {
		objectUrl: buildObjectUrl(key),
		publicUrl: buildPublicUrl(key),
		key,
		etag,
	}
}
