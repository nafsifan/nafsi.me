'use client'

import type { Activity, ContributionsCalendarProps } from '@/types'
import type { Props as ActivityCalendarProps, ThemeInput } from 'react-activity-calendar'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { ActivityCalendar } from 'react-activity-calendar'

export function ContributionsCalendar({ username }: ContributionsCalendarProps) {
	const t = useTranslations('calendar')
	const [data, setData] = useState<Activity[]>([])
	const [loading, setLoading] = useState(true)
	const [labelInfo, setLabelInfo] = useState(t('noContributions'))

	useEffect(() => {
		const fetchContributions = async (): Promise<void> => {
			try {
				setLoading(true)

				const response = await fetch(`/api/github/contributions?username=${username}`)

				if (response.ok) {
					const contributions: Activity[] = await response.json()
					setData(contributions)
					const totalCount = contributions.reduce((sum, item) => sum + item.count, 0)
					setLabelInfo(t('totalCount', { count: totalCount }))
				}
				else {
					const fallbackData: Activity[] = [
						{
							date: '2025-01-01',
							count: 0,
							level: 0,
						},
						{
							date: '2025-12-31',
							count: 0,
							level: 0,
						},
					]
					setData(fallbackData)
					setLabelInfo(t('noContributions'))
				}
			}
			catch (error: any) {
				setLabelInfo(error?.message ?? t('noContributions'))
			}
			finally {
				setLoading(false)
			}
		}

		fetchContributions()
	}, [username, t])

	const theme: ThemeInput = {
		light: [
			'var(--calendar-bg)',
			'var(--calendar-level-1)',
			'var(--calendar-level-2)',
			'var(--calendar-level-3)',
			'var(--calendar-level-4)',
		],
		dark: [
			'var(--calendar-bg)',
			'var(--calendar-level-1)',
			'var(--calendar-level-2)',
			'var(--calendar-level-3)',
			'var(--calendar-level-4)',
		],
	}

	const activityCalendarProps: ActivityCalendarProps = {
		data,
		loading,
		theme,
		showMonthLabels: false,
		labels: {
			totalCount: labelInfo,
		},
		tooltips: {
			activity: {
				text: activity => t('tooltip', { count: activity.count, date: activity.date }),
				withArrow: true,
			},
		},
	}

	return (
		<div className="isolate">
			<ActivityCalendar {...activityCalendarProps} />
		</div>
	)
}
