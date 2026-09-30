import { TOOLBOX_LINKS } from '@/lib/utils/config'
import { useEffect, useId, useRef, useState } from 'react'

function ToolboxIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z" />
      <path d="M8 10V7.5A1.5 1.5 0 0 1 9.5 6h5A1.5 1.5 0 0 1 16 7.5V10" />
      <path d="M4 14.5h6.25v1.25a.75.75 0 0 0 .75.75h2a.75.75 0 0 0 .75-.75V14.5H20" />
    </svg>
  )
}

export function Toolbox() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-3"
      >
        <ToolboxIcon className="size-4" />
        <span className="max-sm:sr-only">Boîte à outils</span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute top-[calc(100%+0.5rem)] right-0 z-20 w-72 rounded-2xl border border-border bg-surface-raised p-2 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]"
        >
          <p className="px-3 pt-1.5 pb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">
            Outils
          </p>
          <ul>
            {TOOLBOX_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="block text-sm font-medium text-ink">
                    {link.title}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-ink-muted">
                    {link.description}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
