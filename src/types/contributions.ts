export interface Activity {
	date: string
	count: number
	level: number
}

export interface ContributionsCalendarProps {
	username: string
}

export interface GitHubContributionDay {
	date: string
	contributionCount: number
	color: string
}

export interface GitHubContributionWeek {
	contributionDays: GitHubContributionDay[]
}

export interface GitHubContributionCalendar {
	totalContributions: number
	weeks: GitHubContributionWeek[]
}

export interface GitHubContributionsCollection {
	contributionCalendar: GitHubContributionCalendar
}

export interface GitHubUserContributions {
	contributionsCollection: GitHubContributionsCollection
}

export interface GitHubGraphQLResponse {
	data?: {
		user?: GitHubUserContributions
	}
	errors?: Array<{
		message: string
		type?: string
		path?: string[]
	}>
}
