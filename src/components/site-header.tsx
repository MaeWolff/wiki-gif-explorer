import { GITHUB_REPO_URL } from '@/lib/utils/config'

type SiteHeaderProps = {
  query: string
  onQueryChange: (value: string) => void
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M12 2C6.477 2 2 6.486 2 12.021c0 4.425 2.865 8.18 6.839 9.504.5.093.682-.217.682-.483 0-.237-.009-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.622.069-.609.069-.609 1.004.071 1.532 1.033 1.532 1.033.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.952 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.56 9.56 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.203 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.31.678.922.678 1.858 0 1.34-.012 2.42-.012 2.75 0 .268.18.58.688.481A10.02 10.02 0 0 0 22 12.021C22 6.486 17.523 2 12 2Z" />
    </svg>
  )
}

export function SiteHeader({ query, onQueryChange }: SiteHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pt-6 pb-8 sm:px-8 sm:pt-8">
      <div className="flex items-center justify-between gap-4">
        <p className="font-display text-lg font-semibold tracking-tight text-ink">
          Wiki GIF Explorer
        </p>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Voir le projet sur GitHub"
          className="rounded-full p-2 text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <GitHubIcon className="size-5" />
        </a>
      </div>

      <div className="max-w-2xl">
        <p className="mb-3 text-sm font-medium text-accent">Wikipédia · FR</p>
        <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-5xl">
          Les articles dont l’image est un GIF
        </h1>
      </div>

      <label className="block w-full max-w-md">
        <span className="sr-only">Rechercher un article</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filtrer par titre ou description…"
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-[15px] text-ink transition-[border-color,background-color] duration-150 outline-none placeholder:text-ink-muted focus:border-accent/50 focus:bg-surface-raised"
        />
      </label>
    </header>
  )
}
