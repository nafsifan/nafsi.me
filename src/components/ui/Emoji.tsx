import { cn } from '@/lib/utils'

export type EmojiName = 'wave' | 'clipboard' | 'camera' | 'bear'

interface EmojiProps {
	name: EmojiName
	alt?: string
	className?: string
}

export default function Emoji({ name, alt = '', className }: EmojiProps) {
	return (
		<span
			role="img"
			aria-label={alt || name}
			className={cn(
				'inline-flex shrink-0 items-center justify-center align-middle select-none',
				className || 'size-[1.15em]',
			)}
		>
			<img
				src={`/emojis/${name}.webp`}
				alt={alt}
				className="pointer-events-none size-full object-contain"
				draggable={false}
			/>
		</span>
	)
}
