import Script from 'next/script.js'

export interface UmamiProps {
	umamiAnalyticsId?: string
	umamiAnalyticsSrc?: string
}

export default function UmamiScript({
	umamiAnalyticsId = '9cb535c2-0112-4470-a444-68d069e7fecf',
	umamiAnalyticsSrc = 'https://analytics.umami.is/script.js',
}: UmamiProps) {
	return <Script async defer data-website-id={umamiAnalyticsId} src={umamiAnalyticsSrc} />
}
