import { fetchGifArticlesPage, PAGE_SIZE } from '@/lib/api/wikidata'
import { useInfiniteQuery } from '@tanstack/react-query'

export { PAGE_SIZE }

export const gifArticlesQueryKey = ['gif-articles'] as const

export function useGifArticles() {
  return useInfiniteQuery({
    queryKey: gifArticlesQueryKey,
    queryFn: ({ pageParam }) => fetchGifArticlesPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}
