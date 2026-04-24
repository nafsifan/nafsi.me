export const locales = ['zh-CN', 'en'] as const

export type Locale = typeof locales[number]

export const defaultLocale: Locale = 'zh-CN'

export const localeCookieName = 'locale'

export const localeDictionary: Record<Locale, string> = {
	'zh-CN': '简体中文',
	'en': 'English',
}

export const localeOptions: Array<{ value: Locale, label: string }> = locales.map(locale => ({
	value: locale,
	label: localeDictionary[locale],
}))
