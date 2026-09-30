import type { Article } from '@/lib/utils/types'

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const SLICE_SIZE = 10_000
const PAGE_SIZE = 10
const COMMONS_TITLE_BATCH = 50

type SparqlBinding = {
  article: { value: string }
  itemLabel: { value: string }
  itemDescription?: { value: string }
  image: { value: string }
}

type SparqlResponse = {
  results: {
    bindings: SparqlBinding[]
  }
}

type CommonsImageInfo = {
  metadata?: Array<{ name: string; value: unknown }>
}

type CommonsQueryResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string
        imageinfo?: CommonsImageInfo[]
      }
    >
  }
}

type ArticleDraft = Article & { fileName: string }

async function runSparql(query: string): Promise<SparqlBinding[]> {
  const body = new URLSearchParams({
    format: 'json',
    query,
  })

  let lastStatus = 0

  // POST + 1 retry : les 500 WDQS sont souvent transitoires / query trop lourde en GET.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    lastStatus = response.status
    if (response.ok) {
      const data = (await response.json()) as SparqlResponse
      return data.results.bindings
    }

    if (response.status !== 500 && response.status !== 429) {
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
  }

  throw new Error(`Wikidata SPARQL error (${lastStatus})`)
}

function fileNameFromImageUri(imageUri: string): string {
  const filePathMatch = imageUri.match(/Special:FilePath\/(.+)$/i)
  return filePathMatch
    ? decodeURIComponent(filePathMatch[1])
    : decodeURIComponent(imageUri.split('/').pop() ?? '')
}

/** Sans `?width=` : Commons sinon renvoie une vignette PNG statique (plus d’animation). */
function toCommonsUrl(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`
}

function normalizeFileName(name: string): string {
  return name.replaceAll('_', ' ').trim().toLowerCase()
}

function bindingsToDrafts(bindings: SparqlBinding[]): ArticleDraft[] {
  const byId = new Map<string, ArticleDraft>()

  for (const binding of bindings) {
    const articleUrl = binding.article.value
    if (byId.has(articleUrl)) continue

    const fileName = fileNameFromImageUri(binding.image.value)
    const title = binding.itemLabel.value.startsWith('http')
      ? decodeURIComponent(
          articleUrl.replace('https://fr.wikipedia.org/wiki/', ''),
        ).replaceAll('_', ' ')
      : binding.itemLabel.value

    byId.set(articleUrl, {
      id: articleUrl,
      title,
      description: binding.itemDescription?.value ?? '',
      articleUrl,
      imageUrl: toCommonsUrl(fileName),
      fileName,
    })
  }

  return [...byId.values()]
}

async function getAnimatedFileNames(fileNames: string[]): Promise<Set<string>> {
  const animated = new Set<string>()
  if (fileNames.length === 0) return animated

  for (let i = 0; i < fileNames.length; i += COMMONS_TITLE_BATCH) {
    const chunk = fileNames.slice(i, i + COMMONS_TITLE_BATCH)
    const titles = chunk.map((name) => `File:${name}`).join('|')

    const url = new URL(COMMONS_API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')
    url.searchParams.set('prop', 'imageinfo')
    url.searchParams.set('iiprop', 'metadata')
    url.searchParams.set('titles', titles)

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`Commons API error (${response.status})`)
    }

    const data = (await response.json()) as CommonsQueryResponse
    const pages = data.query?.pages ?? {}

    for (const page of Object.values(pages)) {
      const title = page.title
      if (!title?.startsWith('File:')) continue

      const fileName = title.slice('File:'.length)
      const metadata = page.imageinfo?.[0]?.metadata ?? []
      const frameCountEntry = metadata.find(
        (entry) => entry.name === 'frameCount',
      )
      const frameCount = Number(frameCountEntry?.value ?? 0)

      if (frameCount > 1) {
        animated.add(normalizeFileName(fileName))
      }
    }
  }

  return animated
}

async function keepAnimatedArticles(
  articles: ArticleDraft[],
): Promise<Article[]> {
  const animatedNames = await getAnimatedFileNames(
    articles.map((article) => article.fileName),
  )

  return articles
    .filter((article) => animatedNames.has(normalizeFileName(article.fileName)))
    .map(({ fileName: _fileName, ...article }) => article)
}

async function fetchSlice(sliceOffset: number): Promise<ArticleDraft[]> {
  const query = `
    SELECT ?article ?itemLabel ?itemDescription ?image WHERE {
      SERVICE bd:slice {
        ?item wdt:P18 ?image .
        bd:serviceParam bd:slice.offset ${sliceOffset} .
        bd:serviceParam bd:slice.limit ${SLICE_SIZE} .
      }
      FILTER(STRENDS(STR(?image), ".gif") || STRENDS(STR(?image), ".GIF"))
      ?article schema:about ?item ;
               schema:isPartOf <https://fr.wikipedia.org/> .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
    }
  `

  const bindings = await runSparql(query)
  return bindingsToDrafts(bindings)
}

async function sliceHasItems(sliceOffset: number): Promise<boolean> {
  const query = `
    SELECT ?item WHERE {
      SERVICE bd:slice {
        ?item wdt:P18 ?image .
        bd:serviceParam bd:slice.offset ${sliceOffset} .
        bd:serviceParam bd:slice.limit 1 .
      }
    }
    LIMIT 1
  `

  const bindings = await runSparql(query)
  return bindings.length > 0
}

export type FetchGifArticlesPageResult = {
  articles: Article[]
  nextOffset: number | null
}

export async function fetchGifArticlesPage(
  sliceOffset = 0,
): Promise<FetchGifArticlesPageResult> {
  const articles: Article[] = []
  const seen = new Set<string>()
  let offset = sliceOffset

  while (articles.length < PAGE_SIZE) {
    const currentOffset = offset
    const batch = await fetchSlice(currentOffset)
    offset = currentOffset + SLICE_SIZE

    if (batch.length === 0) {
      const hasMoreData = await sliceHasItems(currentOffset)
      if (!hasMoreData) {
        return { articles, nextOffset: null }
      }
      continue
    }

    const animatedBatch = await keepAnimatedArticles(
      batch.filter((article) => {
        if (seen.has(article.id)) return false
        seen.add(article.id)
        return true
      }),
    )

    for (const article of animatedBatch) {
      articles.push(article)
      if (articles.length >= PAGE_SIZE) break
    }
  }

  const hasMoreData = await sliceHasItems(offset)
  return {
    articles,
    nextOffset: hasMoreData ? offset : null,
  }
}

export { PAGE_SIZE }
