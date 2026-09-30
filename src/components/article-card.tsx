import type { Article } from '@/lib/utils/types'

type ArticleCardProps = {
  article: Article
  index: number
}

export function ArticleCard({ article, index }: ArticleCardProps) {
  return (
    <a
      href={article.articleUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full animate-fade-up flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-border transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.7)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
    >
      <div className="relative aspect-4/3 shrink-0 overflow-hidden bg-surface-raised">
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-1 border-t border-border bg-surface px-4 py-3.5">
        <h2 className="line-clamp-2 font-display text-base leading-snug font-semibold tracking-tight text-ink">
          {article.title}
        </h2>
        <p className="line-clamp-2 text-sm leading-snug text-ink-muted">
          {article.description || '\u00A0'}
        </p>
      </div>
    </a>
  )
}
