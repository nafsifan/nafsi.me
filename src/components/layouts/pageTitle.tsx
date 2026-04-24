export default function PageTitle({ title }: { title: string }) {
	return (
		<div className="space-y-3">
			<h2 className="flex-inline items-center text-2xl font-bold text-(--text-primary) sm:text-3xl">
				{ title }
			</h2>
			<div className="h-1 w-12 rounded-full bg-(--accent-strong)" aria-hidden="true" />
		</div>
	)
}
