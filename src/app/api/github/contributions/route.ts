// https://github.com/zpuckeridge/blog/blob/main/src/app/api/github/contributions/graph/route.ts

import type {
	Activity,
	GitHubContributionWeek,
	GitHubGraphQLResponse,
} from '@/types'
import type { NextRequest } from 'next/server'
import process from 'node:process'
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url)
	const username = searchParams.get('username')

	if (!username) {
		return NextResponse.json({ error: 'Username is required' }, { status: 400 })
	}

	// Check if GitHub token is configured
	if (!process.env.GITHUB_TOKEN) {
		return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 })
	}

	try {
		const response = await fetch('https://api.github.com/graphql', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
				'User-Agent': 'nafsi.me',
			},
			body: JSON.stringify({
				query: `
					query($username: String!) {
						user(login: $username) {
							contributionsCollection {
								contributionCalendar {
									totalContributions
									weeks {
										contributionDays {
											date
											contributionCount
											color
										}
									}
								}
							}
						}
					}
				`,
				variables: { username },
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()

			// Handle specific error cases
			if (response.status === 401) {
				return NextResponse.json({ error: 'GitHub token is invalid or expired' }, { status: 401 })
			}

			if (response.status === 403) {
				// Check if it's rate limiting
				const rateLimitRemaining = response.headers.get('x-ratelimit-remaining')
				const rateLimitReset = response.headers.get('x-ratelimit-reset')

				if (rateLimitRemaining === '0') {
					const resetTime = rateLimitReset
						? new Date(Number.parseInt(rateLimitReset, 10) * 1000)
						: null
					return NextResponse.json(
						{
							error: 'GitHub API rate limit exceeded',
							resetTime: resetTime?.toISOString(),
						},
						{ status: 429 },
					)
				}

				return NextResponse.json(
					{ error: 'GitHub API access forbidden - check token permissions' },
					{ status: 403 },
				)
			}

			if (response.status === 404) {
				return NextResponse.json({ error: `GitHub user '${username}' not found` }, { status: 404 })
			}

			throw new Error(`GitHub API error: ${response.status} - ${errorText}`)
		}

		const data: GitHubGraphQLResponse = await response.json()

		if (data.errors) {
			const errorMessage = data.errors[0]?.message || 'Unknown GraphQL error'

			// Handle specific GraphQL errors
			if (errorMessage.includes('Could not resolve to a User')) {
				return NextResponse.json({ error: `GitHub user '${username}' not found` }, { status: 404 })
			}

			throw new Error(`GitHub GraphQL error: ${errorMessage}`)
		}

		// Check if user exists
		if (!data.data?.user) {
			return NextResponse.json({ error: `GitHub user '${username}' not found` }, { status: 404 })
		}

		const weeks: GitHubContributionWeek[] = data.data.user.contributionsCollection.contributionCalendar.weeks

		// Calculate date 12 months ago
		const twelveMonthsAgo = new Date()
		twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

		// Format for react-activity-calendar
		const activities: Activity[] = []

		for (const week of weeks) {
			for (const day of week.contributionDays) {
				const dayDate = new Date(day.date)
				// Only include contributions from the last 12 months
				if (dayDate >= twelveMonthsAgo) {
					// Calculate level based on contribution count
					let level = 0
					if (day.contributionCount > 0) {
						level = 1
					}
					if (day.contributionCount >= 5) {
						level = 2
					}
					if (day.contributionCount >= 10) {
						level = 3
					}
					if (day.contributionCount >= 15) {
						level = 4
					}

					activities.push({
						date: day.date,
						count: day.contributionCount,
						level,
					})
				}
			}
		}

		return NextResponse.json(activities, {
			headers: {
				// Set cache control headers for 30 minutes (1800 seconds)
				'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600',
			},
		})
	}
	catch (error) {
		// Return a more specific error message
		if (error instanceof Error) {
			return NextResponse.json({ error: error.message }, { status: 500 })
		}

		return NextResponse.json({ error: 'Failed to fetch GitHub contributions' }, { status: 500 })
	}
}
