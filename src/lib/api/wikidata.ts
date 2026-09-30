import type { Article } from '@/lib/utils/types'

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const WIKIPEDIA_API = 'https://fr.wikipedia.org/w/api.php'
/** Slices plus petits = SPARQL plus rapide, premiers résultats plus tôt. */
const SLICE_SIZE = 4_000
/** Taille max renvoyée d’un coup (le surplus reste en buffer). */
const PAGE_SIZE = 20
/** On renvoie dès qu’on a autant de résultats (pas besoin d’attendre PAGE_SIZE). */
const MIN_RESULTS_TO_RETURN = 8
/** Budget slices si le filtre pageimage est très sélectif. */
const MAX_SLICES_PER_FETCH = 3
const TITLE_BATCH = 50

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

type PageimagesQueryResponse = {
  query?: {
    normalized?: Array<{ from: string; to: string }>
    pages?: Record<
      string,
      {
        title?: string
        pageimage?: string
        missing?: string
      }
    >
  }
}

type ArticleDraft = Article & { fileName: string }

export type GifArticlesCursor = {
  sliceOffset: number
  /** Résultats déjà filtrés non encore affichés. */
  buffer: Article[]
  /** Slice SPARQL déjà récupéré, pas encore passé au filtre pageimage. */
  pendingDrafts: ArticleDraft[]
}

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

function isGifFileName(fileName: string): boolean {
  return /\.gif$/i.test(fileName)
}

function titleFromArticleUrl(articleUrl: string): string {
  return decodeURIComponent(
    articleUrl.replace('https://fr.wikipedia.org/wiki/', ''),
  ).replaceAll('_', ' ')
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function bindingsToDrafts(bindings: SparqlBinding[]): ArticleDraft[] {
  const byId = new Map<string, ArticleDraft>()

  for (const binding of bindings) {
    const articleUrl = binding.article.value
    if (byId.has(articleUrl)) continue

    const fileName = fileNameFromImageUri(binding.image.value)
    const title = binding.itemLabel.value.startsWith('http')
      ? titleFromArticleUrl(articleUrl)
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

async function fetchPageImageChunk(
  titles: string[],
): Promise<Map<string, string>> {
  const pageImages = new Map<string, string>()
  if (titles.length === 0) return pageImages

  const url = new URL(WIKIPEDIA_API)
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  url.searchParams.set('prop', 'pageimages')
  url.searchParams.set('piprop', 'name')
  url.searchParams.set('titles', titles.join('|'))

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Wikipedia API error (${response.status})`)
  }

  const data = (await response.json()) as PageimagesQueryResponse
  const normalized = new Map(
    (data.query?.normalized ?? []).map((entry) => [
      entry.to.toLowerCase(),
      entry.from.toLowerCase(),
    ]),
  )

  for (const page of Object.values(data.query?.pages ?? {})) {
    if (!page.title || page.missing !== undefined || !page.pageimage) continue

    const key = page.title.toLowerCase()
    const requestedKey = normalized.get(key) ?? key
    pageImages.set(requestedKey, page.pageimage)
    pageImages.set(key, page.pageimage)
  }

  return pageImages
}

async function getPageImageFileNames(
  titles: string[],
): Promise<Map<string, string>> {
  const pageImages = new Map<string, string>()
  if (titles.length === 0) return pageImages

  const chunkResults = await Promise.all(
    chunkArray(titles, TITLE_BATCH).map((chunk) => fetchPageImageChunk(chunk)),
  )

  for (const chunkMap of chunkResults) {
    for (const [key, value] of chunkMap) {
      pageImages.set(key, value)
    }
  }

  return pageImages
}

async function keepPageImageGifs(
  articles: ArticleDraft[],
): Promise<ArticleDraft[]> {
  const titles = articles.map((article) =>
    titleFromArticleUrl(article.articleUrl),
  )
  const pageImages = await getPageImageFileNames(titles)
  const kept: ArticleDraft[] = []

  for (const article of articles) {
    const titleKey = titleFromArticleUrl(article.articleUrl).toLowerCase()
    const pageImage = pageImages.get(titleKey)
    if (!pageImage || !isGifFileName(pageImage)) continue

    kept.push({
      ...article,
      fileName: pageImage,
      imageUrl: toCommonsUrl(pageImage),
    })
  }

  return kept
}

async function fetchAnimatedChunk(fileNames: string[]): Promise<Set<string>> {
  const animated = new Set<string>()
  if (fileNames.length === 0) return animated

  const titles = fileNames.map((name) => `File:${name}`).join('|')

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

  for (const page of Object.values(data.query?.pages ?? {})) {
    const title = page.title
    if (!title?.startsWith('File:')) continue

    const fileName = title.slice('File:'.length)
    const metadata = page.imageinfo?.[0]?.metadata ?? []
    const frameCountEntry = metadata.find((entry) => entry.name === 'frameCount')
    const frameCount = Number(frameCountEntry?.value ?? 0)

    if (frameCount > 1) {
      animated.add(normalizeFileName(fileName))
    }
  }

  return animated
}

async function getAnimatedFileNames(fileNames: string[]): Promise<Set<string>> {
  const animated = new Set<string>()
  if (fileNames.length === 0) return animated

  const chunkResults = await Promise.all(
    chunkArray(fileNames, TITLE_BATCH).map((chunk) => fetchAnimatedChunk(chunk)),
  )

  for (const chunkSet of chunkResults) {
    for (const name of chunkSet) {
      animated.add(name)
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

async function filterDraftsToArticles(
  drafts: ArticleDraft[],
): Promise<Article[]> {
  if (drafts.length === 0) return []
  const pageImageGifs = await keepPageImageGifs(drafts)
  if (pageImageGifs.length === 0) return []
  return keepAnimatedArticles(pageImageGifs)
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
  nextCursor: GifArticlesCursor | null
}

export const INITIAL_GIF_ARTICLES_CURSOR: GifArticlesCursor = {
  sliceOffset: 0,
  buffer: [],
  pendingDrafts: [],
}

function buildPageResult(
  collected: Article[],
  sliceOffset: number,
  pendingDrafts: ArticleDraft[],
  exhausted: boolean,
): FetchGifArticlesPageResult {
  const articles = collected.slice(0, PAGE_SIZE)
  const buffer = collected.slice(PAGE_SIZE)
  const hasMore = !exhausted || buffer.length > 0 || pendingDrafts.length > 0

  if (!hasMore) {
    return { articles, nextCursor: null }
  }

  return {
    articles,
    nextCursor: { sliceOffset, buffer, pendingDrafts },
  }
}

export async function fetchGifArticlesPage(
  cursor: GifArticlesCursor = INITIAL_GIF_ARTICLES_CURSOR,
): Promise<FetchGifArticlesPageResult> {
  const collected: Article[] = [...cursor.buffer]
  const seen = new Set(collected.map((article) => article.id))
  let offset = cursor.sliceOffset
  let pendingDrafts = cursor.pendingDrafts
  let slicesProcessed = 0
  let exhausted = false
  let nextSlicePromise: Promise<ArticleDraft[]> | null = null

  // Déjà de quoi servir la page → réponse immédiate.
  if (collected.length >= MIN_RESULTS_TO_RETURN) {
    return buildPageResult(collected, offset, pendingDrafts, false)
  }

  while (
    collected.length < MIN_RESULTS_TO_RETURN &&
    slicesProcessed < MAX_SLICES_PER_FETCH &&
    !exhausted
  ) {
    let batch: ArticleDraft[]

    if (pendingDrafts.length > 0) {
      batch = pendingDrafts
      pendingDrafts = []
      // `pendingDrafts` correspond au slice qui commence à `offset`.
      offset += SLICE_SIZE
    } else if (nextSlicePromise) {
      batch = await nextSlicePromise
      nextSlicePromise = null
      offset += SLICE_SIZE
    } else {
      batch = await fetchSlice(offset)
      offset += SLICE_SIZE
    }

    slicesProcessed += 1

    if (batch.length === 0) {
      const hasMoreData = await sliceHasItems(offset - SLICE_SIZE)
      if (!hasMoreData) {
        exhausted = true
        break
      }
      continue
    }

    const uniqueBatch = batch.filter((article) => {
      if (seen.has(article.id)) return false
      seen.add(article.id)
      return true
    })

    // Pendant le filtre Wikipedia/Commons, on précharge déjà le slice SPARQL suivant.
    if (!nextSlicePromise && pendingDrafts.length === 0) {
      nextSlicePromise = fetchSlice(offset).catch(() => [])
    }

    if (uniqueBatch.length === 0) continue

    const animatedBatch = await filterDraftsToArticles(uniqueBatch)
    collected.push(...animatedBatch)
  }

  // Si le slice suivant est déjà là, on le garde pour le prochain fetch (0 SPARQL).
  if (nextSlicePromise) {
    pendingDrafts = await nextSlicePromise
    // offset pointe déjà sur ce slice « pending » ; on ne l’incrémente qu’à la conso.
  }

  // Si on n’a rien trouvé mais qu’il reste du pending, on continue une fois de plus
  // hors budget serait trop long — le curseur reporté gérera le scroll suivant.
  if (
    collected.length === 0 &&
    !exhausted &&
    pendingDrafts.length === 0 &&
    slicesProcessed >= MAX_SLICES_PER_FETCH
  ) {
    const hasMoreData = await sliceHasItems(offset)
    if (!hasMoreData) exhausted = true
  }

  return buildPageResult(collected, offset, pendingDrafts, exhausted)
}

export { PAGE_SIZE }
