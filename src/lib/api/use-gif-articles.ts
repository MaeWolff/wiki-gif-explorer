import {
  fetchGifArticlesPage,
  INITIAL_GIF_ARTICLES_CURSOR,
  PAGE_SIZE,
  type GifArticlesCursor,
} from '@/lib/api/wikidata'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export { PAGE_SIZE }

export const gifArticlesQueryKey = ['gif-articles', 'pageimage-v2'] as const

export function useGifArticles() {
  const didPrefetch = useRef(false)

  const query = useInfiniteQuery({
    queryKey: gifArticlesQueryKey,
    queryFn: ({ pageParam }) => fetchGifArticlesPage(pageParam),
    initialPageParam: INITIAL_GIF_ARTICLES_CURSOR satisfies GifArticlesCursor,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })

  const { isSuccess, hasNextPage, isFetchingNextPage, fetchNextPage } = query

  // Une seule page d’avance après le premier chargement (pas de chaîne greedy).
  useEffect(() => {
    if (didPrefetch.current) return
    if (!isSuccess || !hasNextPage || isFetchingNextPage) return
    didPrefetch.current = true
    void fetchNextPage()
  }, [isSuccess, hasNextPage, isFetchingNextPage, fetchNextPage])

  return query
}
