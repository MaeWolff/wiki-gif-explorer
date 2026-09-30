export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-6xl border-t border-border px-5 pt-8 pb-10 sm:px-8">
      <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
        Ce site n’est pas affilié à{' '}
        <a
          href="https://www.wiki-masters.com/"
          target="_blank"
          rel="noreferrer"
          className="text-ink underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-accent hover:decoration-accent"
        >
          WikiMasters
        </a>
        , ni à Wikimedia Foundation, Wikipédia ou Wikidata.
      </p>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
        Les articles et images restent sous licence de leurs contributeurs respectifs.</p>
    </footer>
  )
}
