import type { Locale } from './config'
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, localeCookieName, locales } from './config'

const resolveLocale = (value?: string): Locale => {
	return value && locales.includes(value as Locale) ? (value as Locale) : defaultLocale
}

export async function getUserLocale(): Promise<Locale> {
	const cookieStore = await cookies()
	return resolveLocale(cookieStore.get(localeCookieName)?.value)
}

export async function setUserLocale(locale: string) {
	const cookieStore = await cookies()
	cookieStore.set(localeCookieName, resolveLocale(locale))
}

export default getRequestConfig(async () => {
	const locale = await getUserLocale()
	const messages = (await import(`../messages/${locale}.json`)).default

	return {
		locale,
		messages,
	}
})
