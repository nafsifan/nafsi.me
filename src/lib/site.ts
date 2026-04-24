const SITE_URL = 'https://nafsi.me'
const OG_IMAGE = `${SITE_URL}/avatar.jpeg`

export const siteConfig = {
	title: 'Nafsi',
	description: 'Nafsi\'s Blog',
	url: SITE_URL,
	locale: 'zh_CN',
	keywords: ['Nafsi', 'nafsi.me'],
	author: {
		name: 'Nafsi',
		email: 'i@nafsi.me',
		url: SITE_URL,
	},
	ogImage: {
		url: OG_IMAGE,
		width: 460,
		height: 460,
	},
}
