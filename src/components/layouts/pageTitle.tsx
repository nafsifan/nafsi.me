import type { EmojiName } from '@/components/ui/Emoji'
import Emoji from '@/components/ui/Emoji'
import { cn } from '@/lib/utils'

interface PageTitleProps {
	title: string
	emoji?: EmojiName
	className?: string
}

export default function PageTitle({
	title,
	emoji,
	className,
}: PageTitleProps) {
	return (
		<div className={cn('space-y-3', className)}>
			<div className="flex items-center gap-2.5">
				{emoji && <Emoji name={emoji} className="size-7 sm:size-8" />}
				<h2 className="text-2xl font-bold text-(--text-primary) sm:text-3xl">
					{title}
				</h2>
			</div>
			<div className="h-1 w-12 rounded-full bg-(--accent-strong)" aria-hidden="true" />
		</div>
	)
}
