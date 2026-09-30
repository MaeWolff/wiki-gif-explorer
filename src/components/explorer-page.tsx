import { ArticleCard } from '@/components/article-card'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { useGifArticles } from '@/lib/api/use-gif-articles'
import { useDebouncedValue } from '@/lib/utils/use-debounced-value'
import { useEffect, useMemo, useRef, useState } from 'react'

export function ExplorerPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebouncedValue(query, 300)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
  } = useGifArticles()

  const articles = useMemo(() => {
    const pages = data?.pages ?? []
    const seen = new Set<string>()
    const merged = []

    for (const page of pages) {
      for (const article of page.articles) {
        if (seen.has(article.id)) continue
        seen.add(article.id)
        merged.push(article)
      }
    }

    return merged
  }, [data?.pages])

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase()
    if (!needle) return articles

    return articles.filter((article) => {
      const haystack = `${article.title} ${article.description}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [articles, debouncedQuery])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (!hasNextPage || isFetchingNextPage) return
        void fetchNextPage()
      },
      // Plus large : on précharge avant d’arriver en bas, avec des pages plus grosses.
      { rootMargin: '800px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const errorMessage =
    error instanceof Error
      ? error.message
      : 'Impossible de charger les articles.'

  return (
    <div className="flex min-h-dvh flex-col pb-4">
      <SiteHeader query={query} onQueryChange={setQuery} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
        {isPending && articles.length === 0 ? (
          <p className="animate-fade-up py-16 text-center text-ink-muted">
            Chargement des GIF Wikipédia…
          </p>
        ) : null}

        {!isPending && isError && articles.length === 0 ? (
          <p
            role="alert"
            className="animate-fade-up rounded-xl border border-border bg-surface-raised px-5 py-8 text-center text-ink"
          >
            {errorMessage}
          </p>
        ) : null}

        {!isPending && !isError && filtered.length === 0 ? (
          <p className="animate-fade-up py-16 text-center text-ink-muted">
            Aucun article ne correspond à ta recherche.
          </p>
        ) : null}

        {filtered.length > 0 ? (
          <div className="grid auto-rows-fr grid-cols-2 sm:grid-cols-3 gap-5 lg:grid-cols-5">
            {filtered.map((article, index) => (
              <ArticleCard key={article.id} article={article} index={index} />
            ))}
          </div>
        ) : null}

        <div
          ref={loadMoreRef}
          className="mt-10 flex justify-center"
          aria-hidden={!hasNextPage}
        >
          {isFetchingNextPage ? (
            <p className="text-sm text-ink-muted" aria-live="polite">
              Chargement…
            </p>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
